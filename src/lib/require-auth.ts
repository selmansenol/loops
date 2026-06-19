/**
 * Auth helpers for TanStack server functions, replacing the Supabase
 * `requireSupabaseAuth` middleware.
 *
 * `requireAuth` middleware → guarantees a signed-in user and exposes
 * `context.userId` / `context.session` to the handler.
 * `getOptionalUserId()` → for public handlers that behave differently when
 * a user happens to be signed in (e.g. "have I voted?").
 *
 * Server-only APIs (`getRequest`, the better-auth instance) are pulled in via
 * dynamic import inside server-only code paths, so this module never statically
 * imports `@tanstack/react-start/server` — that keeps it safe to be referenced
 * from `*.functions.ts` files that the client bundle also touches.
 */
import { createMiddleware } from "@tanstack/react-start";

async function readSession() {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  if (!request?.headers) return null;
  const { auth } = await import("@/lib/auth.server");
  return auth.api.getSession({ headers: request.headers });
}

export async function getOptionalUserId(): Promise<string | null> {
  const session = await readSession();
  return session?.user?.id ?? null;
}

export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const session = await readSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized: sign in required.");
  }
  return next({
    context: {
      userId: session.user.id,
      session,
    },
  });
});
