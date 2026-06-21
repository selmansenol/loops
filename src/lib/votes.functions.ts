import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/require-auth";

const slugInput = z.object({ slug: z.string().max(40) });

/** Post ids the current user has voted for, within a workspace. */
export const listMyVotesFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => slugInput.parse(input))
  .handler(async ({ data }) => {
    const { getOptionalUserId } = await import("@/lib/require-auth");
    const userId = await getOptionalUserId();
    if (!userId) return [] as string[];
    const { resolveWorkspace } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspace(data.slug);
    const { db } = await import("@/db");
    const { votes, posts } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");
    const rows = await db
      .select({ post_id: votes.post_id })
      .from(votes)
      .innerJoin(posts, eq(posts.id, votes.post_id))
      .where(and(eq(posts.workspace_id, ws.id), eq(votes.user_id, userId)));
    return rows.map((r) => r.post_id);
  });

// Any signed-in user can vote on a public board.
export const toggleVoteFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => slugInput.extend({ postId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { resolveWorkspace } = await import("@/lib/workspace.server");
    const { toggleVote } = await import("@/lib/posts.repo");
    const ws = await resolveWorkspace(data.slug);
    return toggleVote(ws.id, data.postId, context.userId);
  });
