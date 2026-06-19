import { createServerFn } from "@tanstack/react-start";
import { getOptionalUserId } from "@/lib/require-auth";

/**
 * Returns the current user's admin flag. Used by the client AuthProvider, which
 * can no longer query the DB directly. Safe for anonymous callers (returns false).
 */
export const getMyRole = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ isAdmin: boolean }> => {
    const userId = await getOptionalUserId();
    if (!userId) return { isAdmin: false };
    const { isAdmin } = await import("@/lib/authz");
    return { isAdmin: await isAdmin(userId) };
  },
);
