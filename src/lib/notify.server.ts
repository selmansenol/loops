/**
 * Email notifications — server-only, best-effort (never throws into the request).
 * Only fires when an email provider is configured (RESEND_API_KEY).
 */
import type { PostStatus } from "@/lib/posts.repo";

const STATUS_LABEL: Record<PostStatus, string> = {
  planned: "Planned",
  progress: "In progress",
  done: "Shipped 🎉",
};

/**
 * Notify the registered users who voted for a post that its status changed.
 * Guests (cookie/IP/external ids) have no email, so they're naturally excluded
 * by the join against the user table.
 */
export async function notifyStatusChange(
  workspaceId: string,
  post: { id: string; title: string },
  newStatus: PostStatus,
): Promise<void> {
  try {
    const { emailEnabled, sendEmail, emailLayout } = await import("@/lib/email.server");
    if (!emailEnabled()) return;

    const { db } = await import("@/db");
    const { votes, user, workspaces } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    const [ws] = await db
      .select({ slug: workspaces.slug, name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    if (!ws) return;

    const voters = await db
      .select({ email: user.email })
      .from(votes)
      .innerJoin(user, eq(user.id, votes.user_id))
      .where(eq(votes.post_id, post.id))
      .limit(2000);

    const emails = Array.from(new Set(voters.map((v) => v.email).filter(Boolean)));
    if (emails.length === 0) return;

    const base = (process.env.BETTER_AUTH_URL || "https://getloops.co").replace(/\/$/, "");
    const url = `${base}/${ws.slug}/posts/${post.id}`;
    const label = STATUS_LABEL[newStatus];
    const html = emailLayout({
      heading: `“${post.title}” is now ${label}`,
      body: `A post you voted for on ${ws.name} changed status to <strong>${label}</strong>.`,
      ctaLabel: "View post",
      ctaUrl: url,
    });

    await Promise.allSettled(
      emails.map((to) => sendEmail({ to, subject: `Update on “${post.title}”`, html })),
    );
  } catch (err) {
    console.error("[notify] status change failed:", err instanceof Error ? err.message : err);
  }
}
