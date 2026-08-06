import pino from "pino";

export const logger = pino({
  level: process.env.NODE_ENV === "test" ? "silent" : process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "authorization",
      "Authorization",
      "password",
      "passwordHash",
      "*.password",
      "*.passwordHash",
      "req.headers.cookie",
    ],
    censor: "[REDACTED]",
  },
});
