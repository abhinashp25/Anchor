import jwt from "jsonwebtoken";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not set. Copy .env.example to .env and set it before starting the server.");
}
const SECRET: string = process.env.JWT_SECRET;

export interface JwtPayload {
  userId: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, SECRET);
    if (typeof decoded === "string" || !("userId" in decoded)) return null;
    return { userId: (decoded as { userId: string }).userId };
  } catch {
    return null;
  }
}
