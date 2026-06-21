import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/require-auth";

const slugInput = z.object({ slug: z.string().max(40) });

export const listCommentsFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => slugInput.extend({ postId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { resolveWorkspace } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspace(data.slug);
    const { db } = await import("@/db");
    const { comments, posts } = await import("@/db/schema");
    const { and, eq, asc } = await import("drizzle-orm");
    // Only return comments whose post belongs to this workspace.
    return db
      .select({
        id: comments.id,
        post_id: comments.post_id,
        author_id: comments.author_id,
        body: comments.body,
        is_official: comments.is_official,
        created_at: comments.created_at,
      })
      .from(comments)
      .innerJoin(posts, eq(posts.id, comments.post_id))
      .where(and(eq(comments.post_id, data.postId), eq(posts.workspace_id, ws.id)))
      .orderBy(asc(comments.created_at));
  });

// Any signed-in user can comment on a public board.
export const createCommentFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    slugInput
      .extend({ postId: z.string().uuid(), body: z.string().trim().min(1).max(4000) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { resolveWorkspace } = await import("@/lib/workspace.server");
    const { getPostById } = await import("@/lib/posts.repo");
    const ws = await resolveWorkspace(data.slug);
    const post = await getPostById(ws.id, data.postId);
    if (!post) throw new Error("Post not found.");
    const { db } = await import("@/db");
    const { comments } = await import("@/db/schema");
    const [row] = await db
      .insert(comments)
      .values({ post_id: data.postId, author_id: context.userId, body: data.body })
      .returning();
    return row;
  });

export const deleteCommentFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => slugInput.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { resolveWorkspace, isWorkspaceAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspace(data.slug);
    const { db } = await import("@/db");
    const { comments, posts } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");
    const [c] = await db
      .select({ id: comments.id, author_id: comments.author_id })
      .from(comments)
      .innerJoin(posts, eq(posts.id, comments.post_id))
      .where(and(eq(comments.id, data.id), eq(posts.workspace_id, ws.id)))
      .limit(1);
    if (!c) throw new Error("Comment not found.");
    const admin = await isWorkspaceAdmin(context.userId, ws.id);
    if (!admin && c.author_id !== context.userId) {
      throw new Error("Forbidden: only the author or a workspace admin can delete this comment.");
    }
    await db.delete(comments).where(eq(comments.id, data.id));
    return { ok: true };
  });

// Marking a comment "official" is a workspace-admin action.
export const toggleOfficialFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    slugInput.extend({ id: z.string().uuid(), isOfficial: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);
    const { db } = await import("@/db");
    const { comments, posts } = await import("@/db/schema");
    const { and, eq, inArray } = await import("drizzle-orm");
    // Ensure the comment's post is in this workspace before updating.
    const owned = await db
      .select({ id: comments.id })
      .from(comments)
      .innerJoin(posts, eq(posts.id, comments.post_id))
      .where(and(eq(comments.id, data.id), eq(posts.workspace_id, ws.id)))
      .limit(1);
    if (owned.length === 0) throw new Error("Comment not found.");
    await db
      .update(comments)
      .set({ is_official: data.isOfficial })
      .where(inArray(comments.id, [data.id]));
    return { ok: true };
  });
