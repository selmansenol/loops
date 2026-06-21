/**
 * Application-layer webhook delivery — the replacement for the old
 * `dispatch_webhook` Postgres function that used the Supabase `pg_net`
 * extension. Server-only.
 *
 * Call `dispatchWebhook(workspaceId, event, payload)` from every write path
 * that should notify subscribers (post created / status changed / vote
 * created). It fans out to all active webhooks of that workspace subscribed to
 * the event, signs the body with HMAC-SHA256, POSTs it, and records the attempt
 * in `webhook_deliveries`.
 *
 * Delivery is best-effort and fire-and-forget: failures are logged, never
 * thrown back into the request that triggered them.
 */
import { createHmac } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { webhooks, webhook_deliveries } from "@/db/schema";

export type WebhookEvent = "post.created" | "post.status_changed" | "vote.created";

export async function dispatchWebhook(
  workspaceId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  let hooks: { id: string; url: string; secret: string }[];
  try {
    hooks = await db
      .select({ id: webhooks.id, url: webhooks.url, secret: webhooks.secret })
      .from(webhooks)
      .where(
        and(
          eq(webhooks.workspace_id, workspaceId),
          eq(webhooks.active, true),
          sql`${event} = ANY(${webhooks.events})`,
        ),
      );
  } catch (err) {
    console.error("[webhooks] failed to load subscribers:", err);
    return;
  }
  if (hooks.length === 0) return;

  const body = JSON.stringify({
    event,
    timestamp: Math.floor(Date.now() / 1000),
    data: payload,
  });

  await Promise.allSettled(
    hooks.map(async (hook) => {
      const signature = createHmac("sha256", hook.secret).update(body).digest("hex");
      try {
        const res = await fetch(hook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Loop-Event": event,
            "X-Loop-Signature": signature,
            "User-Agent": "Loop-Webhooks/1.0",
          },
          body,
          // Don't let a slow consumer hang the worker.
          signal: AbortSignal.timeout(10_000),
        });
        const snippet = (await res.text().catch(() => "")).slice(0, 500);
        await db.insert(webhook_deliveries).values({
          webhook_id: hook.id,
          event,
          payload,
          status: res.status,
          response_snippet: snippet,
        });
        await db
          .update(webhooks)
          .set({
            last_delivery_at: new Date().toISOString(),
            last_status: res.status,
            last_error: null,
          })
          .where(eq(webhooks.id, hook.id));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db
          .insert(webhook_deliveries)
          .values({ webhook_id: hook.id, event, payload, status: -1, response_snippet: message })
          .catch(() => {});
        await db
          .update(webhooks)
          .set({ last_error: message })
          .where(eq(webhooks.id, hook.id))
          .catch(() => {});
      }
    }),
  );
}
