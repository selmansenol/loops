import { createFileRoute } from "@tanstack/react-router";

const noContent = () => new Response(null, { status: 204 });

/**
 * First-party analytics beacon. Public board pages POST {slug, path, ref} here
 * (via navigator.sendBeacon). No cookies; the visitor is hashed server-side.
 * Honors Do-Not-Track. Always returns 204 — never blocks or errors the client.
 */
export const Route = createFileRoute("/api/track")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Respect Do-Not-Track / Global Privacy Control.
          if (request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1") {
            return noContent();
          }
          // Cap beacons per IP so analytics can't be inflated/abused (drop silently).
          const { rateLimit, clientIp } = await import("@/lib/rate-limit.server");
          if (!rateLimit(`track:${clientIp(request)}`, 120, 60_000).ok) return noContent();
          const body = (await request.json().catch(() => null)) as {
            slug?: string;
            path?: string;
            ref?: string;
          } | null;
          const slug = body?.slug?.trim();
          if (!slug) return noContent();

          const { getWorkspaceBySlug } = await import("@/lib/workspace.server");
          const ws = await getWorkspaceBySlug(slug);
          if (!ws) return noContent();

          const { getOptionalUserId } = await import("@/lib/require-auth");
          const userId = await getOptionalUserId().catch(() => null);

          const { recordView } = await import("@/lib/analytics.server");
          await recordView({
            workspaceId: ws.id,
            path: body?.path ?? null,
            referrer: body?.ref ?? null,
            isMember: !!userId,
          });
        } catch {
          /* best-effort */
        }
        return noContent();
      },
    },
  },
});
