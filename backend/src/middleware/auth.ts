import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : null;
  const token = req.cookies?.anchor_token || bearer;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  req.userId = payload.userId;
  next();
}
