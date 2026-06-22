/**
 * Email notifications — server-only, best-effort (never throws into the request).
 * Only fires when an email provider is configured (RESEND_API_KEY).
 *
 * Model: registered users "subscribe" to a post when they vote / comment /
 * author it. Notifications go to a post's subscribers (minus anyone who used
 * the one-click unsubscribe, stored in notification_optouts). Guests have no
 * account, so they're never emailed.
 */
import { createHmac } from "node:crypto";
import type { PostStatus } from "@/lib/posts.repo";

const STATUS_LABEL: Record<PostStatus, string> = {
  planned: "Planned",
  progress: "In progress",
  done: "Shipped 🎉",
};

function baseUrl(): string {
  return (process.env.BETTER_AUTH_URL || "https://getloops.co").replace(/\/$/, "");
}

// ── one-click unsubscribe token ──────────────────────────────────────
function sign(userId: string): string {
  return createHmac("sha256", process.env.BETTER_AUTH_SECRET ?? "loops")
    .update(`unsub:${userId}`)
    .digest("hex")
    .slice(0, 32);
}
function b64url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}
export function unsubscribeUrl(userId: string): string {
  return `${baseUrl()}/api/unsubscribe?t=${b64url(userId)}.${sign(userId)}`;
}
export function verifyUnsubscribeToken(token: string): string | null {
  const [enc, sig] = token.split(".");
  if (!enc || !sig) return null;
  let userId: string;
  try {
    userId = Buffer.from(enc, "base64url").toString("utf8");
  } catch {
    return null;
  }
  return sig === sign(userId) ? userId : null;
}

// ── subscriptions ────────────────────────────────────────────────────
/** Subscribe a registered user to a post (no-op for guests / duplicates). */
export async function subscribeToPost(postId: string, userId: string): Promise<void> {
  if (!userId || userId.startsWith("guest:") || userId.startsWith("ext_")) return;
  try {
    const { db } = await import("@/db");
    const { post_subscriptions } = await import("@/db/schema");
    await db
      .insert(post_subscriptions)
      .values({ post_id: postId, user_id: userId })
      .onConflictDoNothing();
  } catch {
    /* best-effort */
  }
}

/** Subscriber emails for a post, minus opted-out users and an optional excludee. */
async function recipients(
  postId: string,
  excludeUserId?: string,
): Promise<Array<{ userId: string; email: string }>> {
  const { db } = await import("@/db");
  const { post_subscriptions, user, notification_optouts } = await import("@/db/schema");
  const { and, eq, isNull } = await import("drizzle-orm");
  const rows = await db
    .select({ userId: user.id, email: user.email })
    .from(post_subscriptions)
    .innerJoin(user, eq(user.id, post_subscriptions.user_id))
    .leftJoin(notification_optouts, eq(notification_optouts.user_id, user.id))
    .where(and(eq(post_subscriptions.post_id, postId), isNull(notification_optouts.user_id)))
    .limit(2000);
  return rows.filter((r) => r.email && r.userId !== excludeUserId);
}

async function send(
  list: Array<{ userId: string; email: string }>,
  subject: string,
  build: (unsub: string) => { heading: string; body: string; ctaLabel: string; ctaUrl: string },
): Promise<void> {
  const { sendEmail, emailLayout } = await import("@/lib/email.server");
  await Promise.allSettled(
    list.map((r) => {
      const u = unsubscribeUrl(r.userId);
      return sendEmail({
        to: r.email,
        subject,
        html: emailLayout({ ...build(u), unsubscribeUrl: u }),
      });
    }),
  );
}

// ── triggers ─────────────────────────────────────────────────────────
export async function notifyStatusChange(
  workspaceId: string,
  post: { id: string; title: string },
  newStatus: PostStatus,
): Promise<void> {
  try {
    const { emailEnabled } = await import("@/lib/email.server");
    if (!emailEnabled()) return;
    const { db } = await import("@/db");
    const { workspaces } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const [ws] = await db
      .select({ slug: workspaces.slug, name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    if (!ws) return;
    const list = await recipients(post.id);
    if (!list.length) return;
    const url = `${baseUrl()}/${ws.slug}/posts/${post.id}`;
    const label = STATUS_LABEL[newStatus];
    await send(list, `Update on “${post.title}”`, () => ({
      heading: `“${post.title}” is now ${label}`,
      body: `A post you follow on ${ws.name} changed status to <strong>${label}</strong>.`,
      ctaLabel: "View post",
      ctaUrl: url,
    }));
  } catch (err) {
    console.error("[notify] status change:", err instanceof Error ? err.message : err);
  }
}

export async function notifyNewComment(
  workspaceId: string,
  post: { id: string; title: string },
  commenterUserId: string,
  isOfficial: boolean,
): Promise<void> {
  try {
    const { emailEnabled } = await import("@/lib/email.server");
    if (!emailEnabled()) return;
    const { db } = await import("@/db");
    const { workspaces } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const [ws] = await db
      .select({ slug: workspaces.slug, name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    if (!ws) return;
    const list = await recipients(post.id, commenterUserId);
    if (!list.length) return;
    const url = `${baseUrl()}/${ws.slug}/posts/${post.id}`;
    const lead = isOfficial ? "An official reply was posted on" : "There's a new comment on";
    await send(list, `New comment on “${post.title}”`, () => ({
      heading: `New comment on “${post.title}”`,
      body: `${lead} a post you follow on ${ws.name}.`,
      ctaLabel: "Read it",
      ctaUrl: url,
    }));
  } catch (err) {
    console.error("[notify] new comment:", err instanceof Error ? err.message : err);
  }
}
