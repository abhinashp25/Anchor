/**
 * Integration tests for the Anchor backend.
 *
 * These tests run against the REAL local MongoDB (from docker-compose.yml).
 * They do NOT mock the database.
 *
 * Prerequisites:
 *   docker-compose up -d   (starts MongoDB on localhost:27017)
 *
 * Run with:
 *   npm test
 */

import { describe, it, expect, afterAll, beforeAll, vi } from "vitest";
import request from "supertest";
import http from "node:http";
import { app } from "../app.js";
import { db } from "../lib/db.js";

// All state-changing requests need the CSRF header (matches middleware in app.ts).
const CSRF = { "x-anchor-csrf": "1" };

// Generate a unique email for each test run so repeated runs don't collide.
const timestamp = Date.now();
const TEST_EMAIL = `test-${timestamp}@anchor-test.local`;
const TEST_PASSWORD = "correct-horse-battery";
const TEST_NAME = "Integration Test User";

// ─── cleanup ─────────────────────────────────────────────────────────────────

afterAll(async () => {
  // Delete the test user (and cascading data) so re-runs start clean.
  await db.user.deleteMany({ where: { email: TEST_EMAIL } });
  await db.$disconnect();
});

// ─── Health Endpoint Tests ───────────────────────────────────────────────────

describe("Health Endpoint", () => {
  it("GET /health — returns 200 { ok: true } when DB is connected", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("GET /health — returns 503 { ok: false, error } when DB is unreachable", async () => {
    const spy = vi.spyOn(db, "$runCommandRaw").mockRejectedValueOnce(new Error("DB connection lost"));
    const res = await request(app).get("/health");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ ok: false, error: "Database unreachable" });
    spy.mockRestore();
  });
});

// ─── Auth Tests ──────────────────────────────────────────────────────────────

describe("Auth", () => {
  it("POST /api/auth/register — creates a new account and returns 201", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set(CSRF)
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD, name: TEST_NAME });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: TEST_EMAIL, name: TEST_NAME });
    expect(res.body.user.id).toBeTruthy();
  });

  it("POST /api/auth/login — wrong password returns 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set(CSRF)
      .send({ email: TEST_EMAIL, password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });

  it("POST /api/auth/login — correct password returns 200 and sets cookie", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set(CSRF)
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: TEST_EMAIL });

    const cookies = res.headers["set-cookie"] as string[] | string | undefined;
    expect(cookies).toBeTruthy();
    const cookieStr = Array.isArray(cookies) ? cookies.join("; ") : cookies;
    expect(cookieStr).toContain("anchor_token");
  });

  it("DELETE /api/auth/me — deletes account and cascades collections, environments, history", async () => {
    // 1. Create a dedicated user for deletion test
    const delEmail = `del-${Date.now()}@anchor-test.local`;
    const regRes = await request(app)
      .post("/api/auth/register")
      .set(CSRF)
      .send({ email: delEmail, password: TEST_PASSWORD, name: "To Delete" });

    expect(regRes.status).toBe(201);
    const userId = regRes.body.user.id;
    const cookieHeader = Array.isArray(regRes.headers["set-cookie"])
      ? (regRes.headers["set-cookie"] as string[]).join("; ")
      : (regRes.headers["set-cookie"] as string);

    // 2. Add a history entry to verify history cascade
    await db.historyEntry.create({
      data: { userId, method: "GET", url: "http://example.com/test" },
    });

    // 3. Verify user and related items exist in DB
    expect(await db.user.findUnique({ where: { id: userId } })).toBeTruthy();
    expect(await db.collection.findMany({ where: { userId } })).not.toHaveLength(0);
    expect(await db.environment.findMany({ where: { userId } })).not.toHaveLength(0);
    expect(await db.historyEntry.findMany({ where: { userId } })).not.toHaveLength(0);

    // 4. Call DELETE /api/auth/me
    const delRes = await request(app)
      .delete("/api/auth/me")
      .set(CSRF)
      .set("Cookie", cookieHeader);

    expect(delRes.status).toBe(200);
    expect(delRes.body).toEqual({ ok: true });

    // 5. Assert cascading deletion removed everything for this user
    expect(await db.user.findUnique({ where: { id: userId } })).toBeNull();
    expect(await db.collection.findMany({ where: { userId } })).toHaveLength(0);
    expect(await db.environment.findMany({ where: { userId } })).toHaveLength(0);
    expect(await db.historyEntry.findMany({ where: { userId } })).toHaveLength(0);
  });
});

// ─── Collections Tests ────────────────────────────────────────────────────────

describe("Collections", () => {
  it("POST /api/collections — without auth returns 401", async () => {
    const res = await request(app)
      .post("/api/collections")
      .set(CSRF)
      .send({ name: "Should Fail" });

    expect(res.status).toBe(401);
  });

  it("POST /api/collections — with valid auth returns 201", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .set(CSRF)
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(loginRes.status).toBe(200);
    const cookie = loginRes.headers["set-cookie"] as string[] | string;
    const cookieHeader = Array.isArray(cookie) ? cookie.join("; ") : cookie;

    const res = await request(app)
      .post("/api/collections")
      .set(CSRF)
      .set("Cookie", cookieHeader)
      .send({ name: "My Integration Test Collection" });

    expect(res.status).toBe(201);
    expect(res.body.collection).toMatchObject({ name: "My Integration Test Collection" });
  });
});

// ─── Proxy Tests ──────────────────────────────────────────────────────────────

describe("Proxy", () => {
  let mockServer: http.Server;
  let mockPort: number;

  beforeAll(
    () =>
      new Promise<void>((resolve) => {
        mockServer = http.createServer((_req, res) => {
          if (_req.url?.includes("large=true")) {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.write("X".repeat(2048));
            res.end();
            return;
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ hello: "from mock server" }));
        });
        mockServer.listen(0, "127.0.0.1", () => {
          const addr = mockServer.address() as { port: number };
          mockPort = addr.port;
          resolve();
        });
      }),
  );

  afterAll(
    () =>
      new Promise<void>((resolve) => {
        mockServer.close(() => resolve());
      }),
  );

  it("POST /api/proxy — blocks loopback request via SSRF guard by default", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .set(CSRF)
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    const cookie = loginRes.headers["set-cookie"] as string[] | string;
    const cookieHeader = Array.isArray(cookie) ? cookie.join("; ") : cookie;

    const targetUrl = `http://127.0.0.1:${mockPort}/`;
    const res = await request(app)
      .post("/api/proxy")
      .set(CSRF)
      .set("Cookie", cookieHeader)
      .send({ method: "GET", url: targetUrl });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/private|internal|localhost/i);
  });

  it("POST /api/proxy — enforces response body size limit when payload exceeds cap", async () => {
    process.env.ALLOW_TEST_LOOPBACK = "true";
    process.env.MAX_PROXY_BODY_BYTES = "1024";

    try {
      const loginRes = await request(app)
        .post("/api/auth/login")
        .set(CSRF)
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      const cookie = loginRes.headers["set-cookie"] as string[] | string;
      const cookieHeader = Array.isArray(cookie) ? cookie.join("; ") : cookie;

      const targetUrl = `http://127.0.0.1:${mockPort}/?large=true`;
      const res = await request(app)
        .post("/api/proxy")
        .set(CSRF)
        .set("Cookie", cookieHeader)
        .send({ method: "GET", url: targetUrl });

      expect(res.status).toBe(200);
      expect(res.body.error).toMatch(/exceeded 20MB limit|exceeded.*limit/i);
    } finally {
      delete process.env.ALLOW_TEST_LOOPBACK;
      delete process.env.MAX_PROXY_BODY_BYTES;
    }
  });
});
