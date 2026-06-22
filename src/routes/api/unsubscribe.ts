import { createFileRoute } from "@tanstack/react-router";

const BASE = (process.env.BETTER_AUTH_URL || "https://getloops.co").replace(/\/$/, "");

function page(title: string, body: string): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:-apple-system,system-ui,sans-serif;background:#f5f5f7;color:#1c1c1e;display:grid;place-items:center;min-height:100vh;margin:0"><div style="text-align:center;max-width:420px;padding:32px"><h1 style="font-size:22px">${title}</h1><p style="color:#6b7280">${body}</p><a href="${BASE}" style="color:#7c9cff">← getloops.co</a></div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

// One-click email unsubscribe (no login). Token is signed; see notify.server.
export const Route = createFileRoute("/api/unsubscribe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("t") || "";
        const { verifyUnsubscribeToken } = await import("@/lib/notify.server");
        const userId = verifyUnsubscribeToken(token);
        if (!userId) return page("Invalid link", "This unsubscribe link is invalid or expired.");
        try {
          const { db } = await import("@/db");
          const { notification_optouts } = await import("@/db/schema");
          await db.insert(notification_optouts).values({ user_id: userId }).onConflictDoNothing();
        } catch {
          /* ignore */
        }
        return page("Unsubscribed", "You won't receive Loops notification emails anymore.");
      },
    },
  },
});
