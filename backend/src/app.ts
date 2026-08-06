// This file builds and exports the Express app WITHOUT calling app.listen().
// Keeping app creation separate from server startup lets integration tests import
// the app directly -- supertest creates its own server so there's no port conflict.

import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import * as Sentry from "@sentry/node";
import { logger } from "./lib/logger.js";
import { db } from "./lib/db.js";
import { authRouter } from "./routes/auth.routes.js";
import { collectionsRouter } from "./routes/collections.routes.js";
import { environmentsRouter } from "./routes/environments.routes.js";
import { historyRouter } from "./routes/history.routes.js";
import { proxyRouter } from "./routes/proxy.routes.js";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
  });
}

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

export const app = express();

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

// Structured request logging middleware using pino.
// Logs method, path, status, duration, and user ID if authenticated.
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: duration,
      userId: req.userId ?? null,
    });
  });
  next();
});

// --- CSRF protection via custom header ---
// Any cross-origin browser request that tries to POST/PATCH/DELETE cannot attach
// a custom header without triggering a CORS preflight. Since our CORS policy only
// allows CLIENT_ORIGIN, preflight from any other origin will be blocked here.
// So requiring this header stops CSRF attacks with zero extra tokens or cookies.
const CSRF_SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
app.use((req, res, next) => {
  if (!CSRF_SAFE_METHODS.has(req.method) && req.headers["x-anchor-csrf"] !== "1") {
    return res.status(403).json({ error: "CSRF check failed" });
  }
  next();
});

// Health check endpoint -- verifies database connectivity before returning ok: true.
// Returns HTTP 503 if the database is unreachable so load balancers/deploy platforms accurately know server health.
app.get("/health", async (_req, res) => {
  try {
    await db.$runCommandRaw({ ping: 1 });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Health check failed: database unreachable");
    res.status(503).json({ ok: false, error: "Database unreachable" });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/collections", collectionsRouter);
app.use("/api/environments", environmentsRouter);
app.use("/api/history", historyRouter);
app.use("/api/proxy", proxyRouter);

// Fallback error handler -- logs unhandled errors with stack trace using pino & Sentry
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }
  logger.error(
    {
      err: err instanceof Error ? { message: err.message, stack: err.stack, name: err.name } : err,
      method: req.method,
      path: req.originalUrl || req.url,
      userId: req.userId ?? null,
    },
    "Unhandled error in request pipeline",
  );
  res.status(500).json({ error: "Internal server error" });
});
