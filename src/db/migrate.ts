/**
 * Applies pending Drizzle migrations, then runs idempotent SQL for the bits
 * Drizzle can't express (triggers, functions, trigram indexes, extensions).
 *
 * Run with: `npm run db:migrate` (uses tsx). Invoked on container start.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import postgres from "postgres";

// Load .env for local runs (`npm run db:migrate`). In Docker the env is provided
// directly and no .env file exists, so the missing-file error is ignored.
try {
  process.loadEnvFile?.(".env");
} catch {
  /* no .env file — rely on the real environment */
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Missing DATABASE_URL environment variable.");
}

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  // A dedicated single connection for migrations.
  const sql = postgres(connectionString!, { max: 1 });
  const db = drizzle(sql);

  // Required before the schema migration: webhooks.secret defaults to
  // encode(gen_random_bytes(...)), which Postgres resolves at CREATE TABLE time.
  console.log("[migrate] ensuring extensions…");
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;

  console.log("[migrate] applying Drizzle migrations…");
  await migrate(db, { migrationsFolder: join(__dirname, "../../drizzle") });

  console.log("[migrate] applying functions & triggers…");
  const triggersSql = readFileSync(join(__dirname, "triggers.sql"), "utf8");
  await sql.unsafe(triggersSql);

  console.log("[migrate] done.");
  await sql.end();
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
