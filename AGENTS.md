# Working in this repo

Loop is a TanStack Start (React 19) app on Postgres + Drizzle + better-auth.

## Architecture rules

- **The client never touches the database.** All reads/writes go through TanStack
  server functions (`src/lib/*.functions.ts`) or the REST API (`src/routes/api/v1`).
  Shared DB logic lives in `src/lib/*.repo.ts` and `src/db`.
- **Server-only modules** end in `.server.ts` or live under a `server/` dir, and
  must only be reached from server code (handlers, other server modules). Don't
  statically import the db client, `@/lib/auth.server`, or `@tanstack/react-start/server`
  from anything the client bundle can reach — use a dynamic `import()` inside the
  handler/`.server()` body instead.
- **Authorization is app-layer**, not RLS. Use `isAdmin` / `assertAdmin` from
  `src/lib/authz.ts`. Auth is `requireAuth` middleware / `getOptionalUserId` from
  `src/lib/require-auth.ts`.
- **Webhooks** are dispatched in the app (`src/lib/webhooks.server.ts`) from every
  write path — there are no DB triggers for delivery.

## Database changes

1. Edit `src/db/schema.ts`.
2. `npm run db:generate` to create a migration in `drizzle/`.
3. For functions/triggers/extensions, edit `src/db/triggers.sql` (idempotent).
4. `npm run db:migrate` to apply.

## Routing

File-based via TanStack Router (`src/routes`). `routeTree.gen.ts` is generated —
don't edit it by hand. The only root layout is `src/routes/__root.tsx`.

## Before committing

Run `npm run lint` and `npm run build`. Keep new user-facing strings in both
locales in `src/lib/i18n.ts`.
