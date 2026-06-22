/**
 * Voter identity for public boards — server-only.
 *
 * A vote is keyed by a stable "voter key" (votes.user_id is plain text, no FK).
 * - Signed-in users vote as their account id (strong: 1 account = 1 vote).
 * - Guests are keyed by a hash of their real client IP. IP survives incognito
 *   and cookie-clearing, so it blocks the easy "open a new private window and
 *   vote again" abuse. Trade-off: people sharing one IP (office/CGNAT) share a
 *   guest vote — acceptable for abuse resistance; signed-in users aren't capped.
 *   When the IP can't be determined (e.g. self-host with no proxy) we fall back
 *   to an httpOnly guest cookie.
 *
 * Behind Caddy the real client IP is the last entry of X-Forwarded-For (Caddy
 * appends it); we never trust a single proxy/socket IP, which would collapse
 * every visitor onto one identity.
 *
 * Never statically import `@tanstack/react-start/server` here — pull it in
 * dynamically so this stays safe to reference from `*.functions.ts`.
 */
import { randomUUID, createHash } from "node:crypto";

export type Voter = { key: string; isGuest: boolean };

const GUEST_COOKIE = "loop_guest";

function hashIp(ip: string): string {
  return createHash("sha256")
    .update(`${ip}:${process.env.BETTER_AUTH_SECRET ?? "loops"}`)
    .digest("hex")
    .slice(0, 40);
}

// A private/loopback address means we're seeing the proxy, not a real client —
// don't key on it (that would collapse every visitor onto one identity).
function isPublicIp(ip: string): boolean {
  if (/^(127\.|10\.|192\.168\.|169\.254\.|::1$|fc|fd|fe80)/i.test(ip)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return false;
  return true;
}

export async function getVoter(): Promise<Voter> {
  const { getOptionalUserId } = await import("@/lib/require-auth");
  const userId = await getOptionalUserId();
  if (userId) return { key: userId, isGuest: false };

  const srv = await import("@tanstack/react-start/server");

  // Real client IP = last entry of X-Forwarded-For (the one the proxy appended).
  let ip: string | null = null;
  try {
    const xff = srv.getRequestHeader("x-forwarded-for");
    if (xff) {
      const parts = xff
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      ip = parts[parts.length - 1] ?? null;
    }
  } catch {
    /* ignore */
  }
  if (ip && isPublicIp(ip)) return { key: `guest:ip:${hashIp(ip)}`, isGuest: true };

  // No proxy / unknown IP → fall back to an httpOnly cookie identity.
  let gid = srv.getCookie(GUEST_COOKIE);
  if (!gid) {
    gid = randomUUID();
    srv.setCookie(GUEST_COOKIE, gid, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return { key: `guest:ck:${gid}`, isGuest: true };
}
