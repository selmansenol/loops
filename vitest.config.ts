import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Integration tests hit a real Postgres (DATABASE_URL). They run serially in a
// single fork to avoid cross-test DB races; each test uses its own fixtures and
// cleans up after itself.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    pool: "forks",
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
