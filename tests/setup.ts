// Load .env locally so DATABASE_URL is available (CI provides it via the env,
// where no .env file exists and this no-ops). Runs before any test imports @/db.
try {
  process.loadEnvFile?.(".env");
} catch {
  /* no .env (CI) — rely on the real environment */
}
