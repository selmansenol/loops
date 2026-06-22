import { createFileRoute } from "@tanstack/react-router";

const BASE = (process.env.BETTER_AUTH_URL || "https://getloops.co").replace(/\/$/, "");

/**
 * Weekly digest — emailed to each board's owners/admins: how many new posts
 * arrived in the last 7 days + the top ones. Triggered by the server crontab:
 *   curl -fsS "https://getloops.co/api/cron/digest?key=$CRON_SECRET"
 * Guarded by CRON_SECRET; only sends when email (Resend) is configured.
 */
export const Route = createFileRoute("/api/cron/digest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = new URL(request.url).searchParams.get("key") || "";
        const secret = process.env.CRON_SECRET;
        if (!secret || key !== secret) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { emailEnabled, sendEmail, emailLayout } = await import("@/lib/email.server");
        if (!emailEnabled()) {
          return new Response(JSON.stringify({ skipped: "email not configured" }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        const { db } = await import("@/db");
        const { workspaces, posts, workspace_members, user, notification_optouts } =
          await import("@/db/schema");
        const { and, desc, eq, gt, inArray, isNull, sql } = await import("drizzle-orm");
        const { unsubscribeUrl } = await import("@/lib/notify.server");

        const allWs = await db
          .select({ id: workspaces.id, slug: workspaces.slug, name: workspaces.name })
          .from(workspaces);
        let sent = 0;

        for (const ws of allWs) {
          const recent = await db
            .select({ title: posts.title, votes_count: posts.votes_count })
            .from(posts)
            .where(
              and(
                eq(posts.workspace_id, ws.id),
                gt(posts.created_at, sql`now() - interval '7 days'`),
              ),
            )
            .orderBy(desc(posts.votes_count))
            .limit(5);
          if (recent.length === 0) continue;

          const admins = await db
            .select({ userId: user.id, email: user.email })
            .from(workspace_members)
            .innerJoin(user, eq(user.id, workspace_members.user_id))
            .leftJoin(notification_optouts, eq(notification_optouts.user_id, user.id))
            .where(
              and(
                eq(workspace_members.workspace_id, ws.id),
                inArray(workspace_members.role, ["owner", "admin"]),
                isNull(notification_optouts.user_id),
              ),
            );
          if (admins.length === 0) continue;

          const items = recent
            .map(
              (p) =>
                `<li style="margin:4px 0">${escapeHtml(p.title)} <span style="color:#9ca3af">▲ ${p.votes_count}</span></li>`,
            )
            .join("");
          const body = `New feedback this week on <strong>${escapeHtml(ws.name)}</strong>:<ul style="padding-left:18px;margin:12px 0">${items}</ul>`;
          const url = `${BASE}/${ws.slug}`;

          for (const a of admins) {
            if (!a.email) continue;
            await sendEmail({
              to: a.email,
              subject: `Your weekly Loops digest — ${ws.name}`,
              html: emailLayout({
                heading: "Your weekly digest",
                body,
                ctaLabel: "Open your board",
                ctaUrl: url,
                unsubscribeUrl: unsubscribeUrl(a.userId),
              }),
            });
            sent++;
          }
        }

        return new Response(JSON.stringify({ ok: true, boards: allWs.length, sent }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}
