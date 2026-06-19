import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/require-auth";

/** Post ids the current user has voted for. Empty for anonymous callers. */
export const listMyVotesFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getOptionalUserId } = await import("@/lib/require-auth");
  const userId = await getOptionalUserId();
  if (!userId) return [] as string[];
  const { db } = await import("@/db");
  const { votes } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const rows = await db
    .select({ post_id: votes.post_id })
    .from(votes)
    .where(eq(votes.user_id, userId));
  return rows.map((r) => r.post_id);
});

export const toggleVoteFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => z.object({ postId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { toggleVote } = await import("@/lib/posts.repo");
    return toggleVote(data.postId, context.userId);
  });
