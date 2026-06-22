/**
 * Voter identity for public boards — server-only.
 *
 * A vote is keyed by a stable "voter key" (votes.user_id is a plain text column,
 * no FK). Signed-in users vote as their account id; everyone else votes as a
 * guest identified by an httpOnly cookie we set server-side. A cookie survives
 * a normal cache clear and isn't reachable from JS, so it's much harder to game
 * than a localStorage id — though, honestly, no anonymous scheme is abuse-proof
 * (a determined user can clear cookies). Strong 1-person-1-vote needs sign-in.
 *
 * Never statically import `@tanstack/react-start/server` here (keeps this safe
 * to reference from `*.functions.ts`); pull it in dynamically.
 */
import { randomUUID } from "node:crypto";

export type Voter = { key: string; isGuest: boolean };

const GUEST_COOKIE = "loop_guest";

export async function getVoter(): Promise<Voter> {
  const { getOptionalUserId } = await import("@/lib/require-auth");
  const userId = await getOptionalUserId();
  if (userId) return { key: userId, isGuest: false };

  const { getCookie, setCookie } = await import("@tanstack/react-start/server");
  let gid = getCookie(GUEST_COOKIE);
  if (!gid) {
    gid = randomUUID();
    setCookie(GUEST_COOKIE, gid, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
  }
  return { key: `guest:${gid}`, isGuest: true };
}
