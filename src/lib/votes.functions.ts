import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const slugInput = z.object({ slug: z.string().max(40) });

/** Post ids the current voter (signed-in user OR guest cookie) has voted for. */
export const listMyVotesFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => slugInput.parse(input))
  .handler(async ({ data }) => {
    const { getVoter } = await import("@/lib/voter.server");
    const { key } = await getVoter();
    const { resolveWorkspace } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspace(data.slug);
    const { db } = await import("@/db");
    const { votes, posts } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");
    const rows = await db
      .select({ post_id: votes.post_id })
      .from(votes)
      .innerJoin(posts, eq(posts.id, votes.post_id))
      .where(and(eq(posts.workspace_id, ws.id), eq(votes.user_id, key)));
    return rows.map((r) => r.post_id);
  });

/**
 * Toggle a vote on a public board. No sign-in required — guests vote via an
 * httpOnly cookie identity (see voter.server); signed-in users vote as their
 * account. Either way a voter gets one vote per post.
 */
export const toggleVoteFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => slugInput.extend({ postId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { getVoter } = await import("@/lib/voter.server");
    const { key } = await getVoter();
    const { resolveWorkspace } = await import("@/lib/workspace.server");
    const { toggleVote } = await import("@/lib/posts.repo");
    const ws = await resolveWorkspace(data.slug);
    return toggleVote(ws.id, data.postId, key);
  });
