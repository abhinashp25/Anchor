import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { requireAuth } from "../middleware/auth.js";

export const proxyRouter = Router();
proxyRouter.use(requireAuth);

// 60 requests per minute, keyed by authenticated user ID.
// requireAuth runs first (above), so req.userId is always set here.
const proxyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId ?? req.ip ?? "unknown",
  validate: { default: false },
  message: { error: "Too many proxy requests — please wait before trying again" },
});

const bodySchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  body: z.string().optional(),
});

// Blocks requests to loopback, private, and cloud-metadata addresses. This is a
// hosted multi-tenant proxy, not a local app — without this, any signed-in user
// could use it to probe your internal network or cloud metadata endpoint (SSRF).
function isBlockedIp(ip: string): boolean {
  if (process.env.ALLOW_TEST_LOOPBACK === "true") return false;
  if (ip === "127.0.0.1" || ip === "::1" || ip === "169.254.169.254") return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("169.254.")) return true;
  const parts = ip.split(".").map(Number);
  if (parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  return false;
}

proxyRouter.post("/", proxyLimiter, async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  const { method, url, headers, body } = parsed.data;

  // Parse the target URL so we can work with its parts individually.
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  const { hostname, protocol, port, pathname, search } = parsedUrl;

  // Block "localhost" by name before we even hit DNS.
  if (hostname === "localhost") {
    return res.status(400).json({ error: "Requests to localhost are blocked by the proxy" });
  }

  // --- SSRF fix: resolve DNS exactly once, check the IP, then pin the connection ---
  //
  // The old code did: dns.lookup() → check IP → fetch(url)  
  // fetch() runs its own DNS lookup, so an attacker can flip the DNS record between
  // the check and the actual connection (DNS rebinding attack).
  //
  // The fix: resolve once, block if private, then pass a custom `lookup` function to
  // Node’s http/https module that always returns the IP we already verified —
  // so no second DNS query ever happens.
  let resolvedIp: string;
  let resolvedFamily: 4 | 6;
  try {
    const result = await dns.lookup(hostname);
    resolvedIp = result.address;
    resolvedFamily = result.family as 4 | 6;
  } catch {
    return res.status(400).json({ error: "Could not resolve host" });
  }

  if (isBlockedIp(resolvedIp)) {
    return res.status(400).json({ error: "Requests to private or internal addresses are blocked by the proxy" });
  }

  // Build the request options. We use the original hostname for the Host header and
  // TLS SNI (servername), but we connect to resolvedIp so the socket never re-resolves.
  const isHttps = protocol === "https:";
  const defaultPort = isHttps ? 443 : 80;
  const targetPort = port ? Number(port) : defaultPort;

  const requestOptions: http.RequestOptions = {
    // Connect to the IP we already checked — not the hostname.
    host: resolvedIp,
    port: targetPort,
    // Keep original Host header so the server responds correctly.
    setHost: false,
    method,
    path: pathname + search,
    headers: {
      ...(headers ?? {}),
      Host: hostname + (port ? `:${port}` : ""),
    },
    // Pass the custom lookup function so Node never calls DNS again.
    // The callback signature is: (hostname, options, callback) but the simplified
    // version (hostname, callback) is also supported by Node internals.
    lookup: (_host: string, _opts: unknown, callback: (err: Error | null, addr: string, fam: number) => void) => {
      // Always return the IP we already resolved and validated.
      callback(null, resolvedIp, resolvedFamily);
    },
  };

  // For HTTPS, also set servername so TLS SNI uses the original hostname (not the IP).
  if (isHttps) {
    (requestOptions as https.RequestOptions).servername = hostname;
  }

  const start = Date.now();

  const MAX_RESPONSE_BYTES = process.env.MAX_PROXY_BODY_BYTES
    ? Number(process.env.MAX_PROXY_BODY_BYTES)
    : 20 * 1024 * 1024; // 20 MB default max response size limit

  // Wrap Node’s callback-based http/https.request in a Promise so we can await it.
  // This mirrors the shape the frontend expects: { status, statusText, headers, body, timeMs, sizeBytes }.
  await new Promise<void>((resolve) => {
    let handled = false;
    const finish = () => {
      if (!handled) {
        handled = true;
        resolve();
      }
    };

    const timeoutId = setTimeout(() => {
      outgoingReq.destroy(new Error("Request timed out after 30 seconds"));
    }, 30_000);

    const outgoingReq = (isHttps ? https : http).request(requestOptions, (upstream) => {
      clearTimeout(timeoutId);
      const timeMs = Date.now() - start;

      const chunks: Buffer[] = [];
      let totalBytes = 0;

      upstream.on("data", (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_RESPONSE_BYTES) {
          upstream.destroy(new Error("Response body exceeded 20MB limit"));
          return;
        }
        chunks.push(chunk);
      });

      upstream.on("end", () => {
        if (totalBytes > MAX_RESPONSE_BYTES) return; // Destroy event handles error response
        const text = Buffer.concat(chunks).toString("utf8");

        // Collect response headers into a plain object.
        const responseHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(upstream.headers)) {
          if (v !== undefined) {
            responseHeaders[k] = Array.isArray(v) ? v.join(", ") : v;
          }
        }

        res.json({
          status: upstream.statusCode ?? 0,
          statusText: upstream.statusMessage ?? "",
          headers: responseHeaders,
          body: text,
          timeMs,
          sizeBytes: Buffer.byteLength(text),
        });
        finish();
      });
    });

    outgoingReq.setTimeout(30_000, () => {
      outgoingReq.destroy(new Error("Request timed out after 30 seconds"));
    });

    outgoingReq.on("error", (e) => {
      clearTimeout(timeoutId);
      const timeMs = Date.now() - start;
      const message = e.message.includes("timed out")
        ? "Request timed out after 30 seconds"
        : e.message;
      res.json({
        status: 0,
        statusText: "Error",
        headers: {},
        body: "",
        timeMs,
        sizeBytes: 0,
        error: message,
      });
      finish();
    });

    // Send request body for methods that support it.
    if (method !== "GET" && method !== "HEAD" && body) {
      outgoingReq.write(body);
    }
    outgoingReq.end();
  });
});
