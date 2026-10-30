import { defineConfig } from "vitest/config";
import path from "node:path";
import "dotenv/config";
if (process.env.TEST_DATABASE_URL)
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
