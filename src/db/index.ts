/**
 * Server-only Postgres connection (Drizzle + postgres.js).
 *
 * Never import this from client/route component code — it ships only to the
 * server. Use it from `*.server.ts`, `*.functions.ts` handlers and API routes.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "Missing DATABASE_URL environment variable. See .env.example for the expected format.",
  );
}

// A single pooled client, reused across hot reloads in dev.
const globalForDb = globalThis as unknown as { __loopSql?: ReturnType<typeof postgres> };

const client =
  globalForDb.__loopSql ??
  postgres(connectionString, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__loopSql = client;
}

export const db = drizzle(client, { schema });
export { schema };
