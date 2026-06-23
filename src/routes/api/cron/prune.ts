import { createFileRoute } from "@tanstack/react-router";

/**
 * Analytics retention prune. Deletes page-view events older than ?days (default
 * 365). Guarded by CRON_SECRET. Run from cron, e.g. weekly:
 *   curl -fsS "https://getloops.co/api/cron/prune?key=$CRON_SECRET"
 */
export const Route = createFileRoute("/api/cron/prune")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const key = url.searchParams.get("key") || "";
        const secret = process.env.CRON_SECRET;
        if (!secret || key !== secret) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        const days = Math.min(3650, Math.max(30, Number(url.searchParams.get("days")) || 365));
        const { pruneOldEvents } = await import("@/lib/analytics.server");
        const removed = await pruneOldEvents(days);
        return new Response(JSON.stringify({ ok: true, removed, days }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
