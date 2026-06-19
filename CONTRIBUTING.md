# Contributing to Loops

Thanks for your interest in improving Loops! This document covers how to get set up and
the conventions we follow.

## Getting started

1. **Fork** the repository and clone your fork.
2. Install dependencies and start a database:
   ```bash
   npm install
   cp .env.example .env
   docker run -d --name loop-pg -p 5432:5432 \
     -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=loop postgres:16-alpine
   npm run db:migrate
   npm run dev
   ```
3. Create a branch: `git checkout -b feat/short-description`.

See the [README](README.md) for full setup details.

## Project conventions

These keep the codebase consistent — please skim [AGENTS.md](AGENTS.md) too.

- **The client never touches the database.** All reads/writes go through TanStack
  server functions (`src/lib/*.functions.ts`) or the REST API (`src/routes/api/v1`).
  Shared DB logic lives in `src/lib/*.repo.ts` and `src/db`.
- **Server-only code** stays out of the client bundle. Don't statically import the db
  client, `@/lib/auth.server`, or `@tanstack/react-start/server` from client-reachable
  modules — load them with a dynamic `import()` inside the handler.
- **Authorization is app-layer** (not RLS): use `isAdmin` / `assertAdmin` from
  `src/lib/authz.ts`, and `requireAuth` from `src/lib/require-auth.ts`.
- **Database changes:** edit `src/db/schema.ts`, run `npm run db:generate`, and put any
  functions/triggers in `src/db/triggers.sql` (must be idempotent).
- **i18n:** every user-facing string goes in `src/lib/i18n.ts` in **both** `tr` and `en`.

## Before opening a PR

Run and make sure these pass:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

- Keep PRs focused; one logical change per PR.
- Write a clear description of **what** and **why**.
- Link any related issue (e.g. `Closes #123`).
- Add/update docs when behavior changes.

## Commit messages

Conventional-ish prefixes are appreciated but not required: `feat:`, `fix:`, `docs:`,
`refactor:`, `chore:`.

## Reporting bugs & requesting features

Use the [issue templates](../../issues/new/choose). Include reproduction steps,
expected vs. actual behavior, and your environment for bugs.

## Code of Conduct

By participating you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

Happy hacking! 🚀
