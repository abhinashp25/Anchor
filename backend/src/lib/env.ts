export function validateEnv() {
  const errors: string[] = [];

  const DATABASE_URL = process.env.DATABASE_URL?.trim();
  if (!DATABASE_URL) {
    errors.push("DATABASE_URL is missing.");
  } else if (!DATABASE_URL.startsWith("mongodb://") && !DATABASE_URL.startsWith("mongodb+srv://")) {
    errors.push(`DATABASE_URL is malformed ("${DATABASE_URL}"). Must start with mongodb:// or mongodb+srv://.`);
  }

  const JWT_SECRET = process.env.JWT_SECRET?.trim();
  if (!JWT_SECRET) {
    errors.push("JWT_SECRET is missing.");
  } else if (JWT_SECRET.length < 8) {
    errors.push("JWT_SECRET is malformed (too short, must be at least 8 characters).");
  }

  const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN?.trim();
  if (!CLIENT_ORIGIN) {
    errors.push("CLIENT_ORIGIN is missing.");
  } else {
    try {
      new URL(CLIENT_ORIGIN);
    } catch {
      errors.push(`CLIENT_ORIGIN is malformed ("${CLIENT_ORIGIN}"). Must be a valid URL (e.g. http://localhost:5173).`);
    }
  }

  if (errors.length > 0) {
    console.error("FATAL: Environment configuration validation failed:\n" + errors.map((e) => `  - ${e}`).join("\n"));
    if (process.env.NODE_ENV !== "test") {
      process.exit(1);
    }
    throw new Error(`Environment validation failed: ${errors.join("; ")}`);
  }
}
