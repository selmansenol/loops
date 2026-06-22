import { createFileRoute } from "@tanstack/react-router";

// TEMP diagnostic: shows what client IP the app resolves behind the proxy.
export const Route = createFileRoute("/api/_ipcheck")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const xff = request.headers.get("x-forwarded-for");
        const last = xff
          ?.split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .pop();
        return new Response(JSON.stringify({ xff, resolved: last ?? null }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
