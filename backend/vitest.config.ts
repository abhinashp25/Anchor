import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Run tests sequentially to avoid DB conflicts between test files.
    fileParallelism: false,
    // Give each test 30 seconds -- some may wait for MongoDB.
    testTimeout: 30_000,
    // Load .env so DATABASE_URL and JWT_SECRET are available.
    env: { NODE_ENV: "test" },
  },
});
