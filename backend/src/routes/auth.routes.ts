import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../lib/db.js";
import { signToken } from "../lib/jwt.js";
import { requireAuth } from "../middleware/auth.js";

// 5 attempts per 15 minutes per IP — applies only to login and register.
// This slows down credential-stuffing attacks without affecting other auth routes.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "test" ? 1000 : 5,
  standardHeaders: true,  // sends standard RateLimit-* response headers
  legacyHeaders: false,   // disables old X-RateLimit-* headers
  message: { error: "Too many attempts — please try again in 15 minutes" },
});

export const authRouter = Router();

const isProd = process.env.NODE_ENV === "production";
const COOKIE_OPTS = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

// bcrypt silently truncates passwords at 72 bytes. Two different passwords that both
// exceed 72 bytes would produce the same hash — a subtle security bug.
// We reject at the schema level so users see a clear error instead of silent truncation.
const MAX_PASSWORD_BYTES = 72;

const registerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .refine(
      (v) => Buffer.byteLength(v, "utf8") <= MAX_PASSWORD_BYTES,
      "Password must be at most 72 bytes",
    ),
  name: z.string().min(1).max(80),
});

authRouter.post("/register", authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const { email, password, name } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.user.create({
    data: { email, passwordHash, name },
  });

  // Seed a default collection and environment so a new account isn't empty
  await db.collection.create({ data: { userId: user.id, name: "My Collection", nodes: [] } });
  await db.environment.create({
    data: { userId: user.id, name: "No Environment", variables: [], isActive: true },
  });

  const token = signToken({ userId: user.id });
  res.cookie("anchor_token", token, COOKIE_OPTS);
  res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

const loginSchema = z.object({
  email: z.string().email(),
  // Apply the same 72-byte limit on login so we reject before bcrypt even runs.
  password: z
    .string()
    .min(1)
    .refine(
      (v) => Buffer.byteLength(v, "utf8") <= MAX_PASSWORD_BYTES,
      "Password must be at most 72 bytes",
    ),
});

authRouter.post("/login", authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid email or password" });
  }
  const { email, password } = parsed.data;

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken({ userId: user.id });
  res.cookie("anchor_token", token, COOKIE_OPTS);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("anchor_token");
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await db.user.findUnique({ where: { id: req.userId! } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: { id: user.id, email: user.email, name: user.name } });
});

// Deletes the authenticated user account and explicitly cascades their collections,
// environments, and history entries in a Prisma transaction (MongoDB has no DB-level cascade).
authRouter.delete("/me", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "User not found" });

  await db.$transaction([
    db.collection.deleteMany({ where: { userId } }),
    db.environment.deleteMany({ where: { userId } }),
    db.historyEntry.deleteMany({ where: { userId } }),
    db.user.delete({ where: { id: userId } }),
  ]);

  res.clearCookie("anchor_token");
  res.json({ ok: true });
});
