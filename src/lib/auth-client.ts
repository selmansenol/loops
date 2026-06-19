/**
 * better-auth browser client. Talks to the `/api/auth/*` route handler.
 *
 * `baseURL` is left to default (same origin) so it works in dev, Docker and
 * any deployment without extra config.
 */
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
