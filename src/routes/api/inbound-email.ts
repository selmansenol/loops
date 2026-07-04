import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Inbound email capture — turns an email into a feedback post.
 *
 * Point Resend Inbound (or any svix-signed forwarder) at this endpoint.
 * The board is picked from the recipient's local part:
 *   acme@<your-inbound-domain>            → board "acme"
 *   feedback+acme@<your-inbound-domain>   → board "acme"  (plus addressing)
 *
 * Subject → title, text body → description, source = "email".
 * Enabled only when RESEND_INBOUND_SECRET (the webhook signing secret,
 * whsec_…) is set; every request's svix signature is verified.
 */

const ok = (body: Record<string, unknown> = { ok: true }, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Verify a svix-style webhook signature (Resend uses svix). */
function verifySvix(secret: string, request: Request, rawBody: string): boolean {
  const id = request.headers.get("svix-id");
  const ts = request.headers.get("svix-timestamp");
  const sigs = request.headers.get("svix-signature");
  if (!id || !ts || !sigs) return false;
  // Reject stale timestamps (>5 min) to prevent replay.
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${rawBody}`).digest("base64");
  // Header holds space-separated "v1,<base64>" entries.
  return sigs.split(" ").some((part) => {
    const val = part.split(",")[1] ?? "";
    try {
      const a = Buffer.from(val, "base64");
      const b = Buffer.from(expected, "base64");
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}

/** "Feedback <feedback+acme@in.example.com>" → "acme" */
function slugFromRecipient(to: string): string | null {
  const addr = (to.match(/<([^>]+)>/)?.[1] ?? to).trim().toLowerCase();
  const local = addr.split("@")[0] ?? "";
  const plus = local.split("+");
  const candidate = (plus.length > 1 ? plus[plus.length - 1] : local).trim();
  return /^[a-z0-9-]{2,40}$/.test(candidate) ? candidate : null;
}

export const Route = createFileRoute("/api/inbound-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RESEND_INBOUND_SECRET;
        if (!secret) return ok({ error: "inbound email not configured" }, 503);

        const rawBody = await request.text();
        if (!verifySvix(secret, request, rawBody)) {
          return ok({ error: "invalid signature" }, 401);
        }

        let evt: {
          type?: string;
          data?: {
            to?: string[] | string;
            from?: string;
            subject?: string;
            text?: string;
            html?: string;
          };
        };
        try {
          evt = JSON.parse(rawBody);
        } catch {
          return ok({ error: "invalid json" }, 400);
        }
        if (evt.type && !/email.*(received|inbound)/i.test(evt.type)) return ok({ ignored: true });

        const d = evt.data ?? {};
        const recipients = Array.isArray(d.to) ? d.to : [d.to ?? ""];
        let slug: string | null = null;
        for (const r of recipients) {
          slug = slugFromRecipient(String(r));
          if (slug) break;
        }
        if (!slug) return ok({ ignored: "no board recipient" });

        const { getWorkspaceBySlug } = await import("@/lib/workspace.server");
        const ws = await getWorkspaceBySlug(slug);
        if (!ws) return ok({ ignored: `no board '${slug}'` });

        // One post per address per minute — an email loop can't flood a board.
        const { rateLimit } = await import("@/lib/rate-limit.server");
        const sender = (d.from?.match(/<([^>]+)>/)?.[1] ?? d.from ?? "unknown").toLowerCase();
        if (!rateLimit(`inbound:${ws.id}:${sender}`, 1, 60_000).ok) {
          return ok({ ignored: "rate limited" });
        }

        const subject = (d.subject ?? "").trim().slice(0, 140);
        if (subject.length < 3) return ok({ ignored: "subject too short" });
        const text = (d.text ?? "").trim().slice(0, 2000) || null;

        const { createPost } = await import("@/lib/posts.repo");
        const post = await createPost({
          workspace_id: ws.id,
          title: subject,
          description: text,
          tag: null,
          source: "email",
          external_user_id: sender.slice(0, 200),
        });
        return ok({ ok: true, post_id: post.id });
      },
    },
  },
});
