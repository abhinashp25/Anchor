import "dotenv/config";
import { validateEnv } from "./lib/env.js";
import { logger } from "./lib/logger.js";

// Fail fast at boot if DATABASE_URL, JWT_SECRET, or CLIENT_ORIGIN is missing or malformed.
validateEnv();

import { app } from "./app.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
  logger.info(`Anchor backend listening on http://localhost:${PORT}`);
});
