#!/usr/bin/env node
/**
 * create-loops — scaffold a self-hosted Loops feedback board in one command.
 *
 *   npx create-loops my-board
 *
 * It shallow-clones the repo, drops the git history, writes a ready-to-run
 * `.env` (with a freshly generated auth secret and single-board mode on), and
 * prints the next steps. Zero runtime dependencies — Node built-ins only.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

// Override with LOOPS_REPO for testing against a local clone.
const REPO = process.env.LOOPS_REPO || "https://github.com/selmansenol/loops.git";

// --- tiny ANSI helpers (no deps) ------------------------------------------
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (useColor ? `[${code}m${s}[0m` : s);
const bold = (s) => paint("1", s);
const dim = (s) => paint("2", s);
const green = (s) => paint("32", s);
const cyan = (s) => paint("36", s);
const red = (s) => paint("31", s);
const yellow = (s) => paint("33", s);

function die(msg) {
  console.error(`\n${red("✗")} ${msg}\n`);
  process.exit(1);
}

function hasGit() {
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// --- arg parsing ----------------------------------------------------------
const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help")) {
  console.log(`
${bold("create-loops")} — scaffold a self-hosted Loops feedback board

${bold("Usage")}
  npx create-loops ${dim("[directory]")} ${dim("[options]")}

${bold("Options")}
  --multi          Multi-tenant mode (boards live at /<slug>); default is a
                   single board served at /.
  -h, --help       Show this help.

${bold("Example")}
  npx create-loops my-board
  cd my-board && docker compose up --build
`);
  process.exit(0);
}

const multi = args.includes("--multi");
const positional = args.filter((a) => !a.startsWith("-"));
const targetName = positional[0] || "loops-board";
const targetDir = resolve(process.cwd(), targetName);

// --- preflight ------------------------------------------------------------
console.log(`\n${cyan("◆")} ${bold("Creating a Loops feedback board")} in ${bold(targetName)}\n`);

if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
  die(`Directory ${bold(targetName)} already exists and is not empty.`);
}
if (!hasGit()) {
  die(
    `Git is required but was not found on your PATH.\n  Install git, or clone manually:\n  ${dim(`git clone ${REPO} ${targetName}`)}`,
  );
}

// --- clone ----------------------------------------------------------------
try {
  console.log(`${dim("›")} Downloading the latest Loops…`);
  execFileSync("git", ["clone", "--depth", "1", "--quiet", REPO, targetDir], {
    stdio: "inherit",
  });
} catch {
  die("Failed to clone the repository. Check your network connection and try again.");
}

// Drop git history and the scaffolder itself so the copy is a clean project.
rmSync(join(targetDir, ".git"), { recursive: true, force: true });
rmSync(join(targetDir, "packages", "create-loops"), { recursive: true, force: true });

// --- write .env -----------------------------------------------------------
const examplePath = join(targetDir, ".env.example");
const envPath = join(targetDir, ".env");
let secretGenerated = false;
try {
  let env = readFileSync(examplePath, "utf8");

  // Generate a real auth secret.
  const secret = randomBytes(32).toString("base64");
  env = env.replace(/^BETTER_AUTH_SECRET=.*$/m, `BETTER_AUTH_SECRET="${secret}"`);
  secretGenerated = true;

  // Default to single-board (self-host) mode unless --multi was passed.
  if (!multi) {
    env = env.replace(/^#\s*SINGLE_TENANT_SLUG=.*$/m, `SINGLE_TENANT_SLUG="main"`);
  }

  writeFileSync(envPath, env);
} catch {
  console.log(
    `${yellow("!")} Couldn't auto-create .env — copy .env.example to .env manually after setup.`,
  );
}

// --- done -----------------------------------------------------------------
console.log(`\n${green("✔")} ${bold("Ready!")} Your board is in ${bold(targetName)}.\n`);
console.log(`${bold("Next steps")}`);
console.log(`  ${cyan(`cd ${targetName}`)}`);
if (secretGenerated) {
  console.log(`  ${dim("# .env is ready (auth secret generated" + (multi ? "" : ", single-board mode") + ")")}`);
} else {
  console.log(`  ${cyan("cp .env.example .env")}   ${dim("# then set BETTER_AUTH_SECRET")}`);
}
console.log(`  ${cyan("docker compose up --build")}   ${dim("# app + Postgres on http://localhost:3000")}`);
console.log(`\n${dim("Prefer Node directly? See the README → Local development.")}`);
if (multi) {
  console.log(
    `${dim("Multi-tenant mode: visit / for the landing, create a board, then open /<slug>.")}`,
  );
}
console.log("");
