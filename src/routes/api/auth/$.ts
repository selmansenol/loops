import { createFileRoute } from "@tanstack/react-router";

/**
 * Catch-all route that hands every `/api/auth/*` request to better-auth.
 * Covers sign-in/up, sign-out, session, OAuth callbacks, etc.
 */
const handle = async ({ request }: { request: Request }) => {
  const { auth } = await import("@/lib/auth.server");
  return auth.handler(request);
};

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
    },
  },
});
