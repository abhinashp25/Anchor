import type { ApiRequest, Environment, ResponseData } from "../types";
import { api } from "./api";

function substitute(str: string, env: Environment | null): string {
  if (!env) return str;
  return str.replace(/\{\{(.*?)\}\}/g, (_, key) => {
    const trimmed = key.trim();
    const found = env.variables.find((v) => v.key === trimmed && v.enabled);
    return found ? found.value : `{{${trimmed}}}`;
  });
}

export function buildUrl(req: ApiRequest, env: Environment | null): string {
  let url = substitute(req.url, env);
  const enabledParams = req.params.filter((p) => p.enabled && p.key);
  if (enabledParams.length) {
    const usp = new URLSearchParams();
    for (const p of enabledParams) usp.append(substitute(p.key, env), substitute(p.value, env));
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}${usp.toString()}`;
  }
  return url;
}

// Requests are executed server-side via the backend proxy, not fetch() directly from
// the browser. This is the whole reason a backend exists here: browser fetch() is
// blocked by CORS for any API that doesn't explicitly allow this origin, which is most
// of them. Running it server-side sidesteps that entirely (same trick Postman's desktop
// app uses by not being a browser at all).
export async function executeRequest(req: ApiRequest, env: Environment | null): Promise<ResponseData> {
  const url = buildUrl(req, env);
  const headers: Record<string, string> = {};
  for (const h of req.headers) {
    if (h.enabled && h.key) headers[substitute(h.key, env)] = substitute(h.value, env);
  }

  let body: string | undefined;
  if (req.body.mode === "json" && req.body.json) {
    body = substitute(req.body.json, env);
    if (!Object.keys(headers).some((k) => k.toLowerCase() === "content-type")) {
      headers["Content-Type"] = "application/json";
    }
  } else if (req.body.mode === "raw" && req.body.raw) {
    body = substitute(req.body.raw, env);
  } else if (req.body.mode === "form" && req.body.form) {
    // Sent as URL-encoded since the proxy forwards a plain string body over JSON transport
    const usp = new URLSearchParams();
    for (const f of req.body.form) {
      if (f.enabled && f.key) usp.append(substitute(f.key, env), substitute(f.value, env));
    }
    body = usp.toString();
    if (!Object.keys(headers).some((k) => k.toLowerCase() === "content-type")) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }
  }

  try {
    const result = await api.proxy({ method: req.method, url, headers, body });
    return result;
  } catch (e) {
    return {
      status: 0,
      statusText: "Error",
      headers: {},
      body: "",
      timeMs: 0,
      sizeBytes: 0,
      error: e instanceof Error ? e.message : "Could not reach the backend proxy. Is it running?",
    };
  }
}
