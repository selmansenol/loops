/**
 * Transactional email — server-only. Sends via the Resend HTTP API (no SDK, no
 * extra dependency). Configured with two env vars:
 *
 *   RESEND_API_KEY   — your Resend API key. When unset, email is disabled and
 *                      sends are skipped (so self-host installs work without it).
 *   EMAIL_FROM       — the From address, e.g. "Loops <noreply@getloops.co>".
 *                      Falls back to Resend's shared onboarding sender.
 *
 * Auth email verification and password reset are only enabled when
 * RESEND_API_KEY is present (see auth.server.ts).
 */
const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

function fromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || "Loops <onboarding@resend.dev>";
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY not set — skipping email to", opts.to);
    return;
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[email] Resend ${res.status}:`, body.slice(0, 300));
    }
  } catch (err) {
    console.error("[email] send failed:", err instanceof Error ? err.message : err);
  }
}

/** Minimal branded HTML wrapper shared by all transactional emails. */
export function emailLayout(opts: {
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1c1e;">
    <div style="max-width:480px;margin:0 auto;padding:40px 24px;">
      <div style="font-size:20px;font-weight:600;letter-spacing:-0.02em;margin-bottom:24px;">Loops</div>
      <div style="background:#ffffff;border:1px solid #e5e5ea;border-radius:16px;padding:28px;">
        <h1 style="font-size:20px;margin:0 0 12px;">${opts.heading}</h1>
        <p style="font-size:14px;line-height:1.6;color:#3a3a3c;margin:0 0 24px;">${opts.body}</p>
        <a href="${opts.ctaUrl}" style="display:inline-block;background:#1c1c1e;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:12px 20px;border-radius:10px;">${opts.ctaLabel}</a>
        <p style="font-size:12px;line-height:1.6;color:#8e8e93;margin:24px 0 0;">
          If the button doesn't work, copy and paste this link:<br/>
          <a href="${opts.ctaUrl}" style="color:#7c9cff;word-break:break-all;">${opts.ctaUrl}</a>
        </p>
      </div>
      <p style="font-size:12px;color:#8e8e93;margin-top:20px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  </body>
</html>`;
}
