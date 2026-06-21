import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/require-auth";

const StatusEnum = z.enum(["planned", "progress", "done"]);
const slugInput = z.object({ slug: z.string().max(40) });

export const listPostsFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => slugInput.parse(input))
  .handler(async ({ data }) => {
    const { resolveWorkspace } = await import("@/lib/workspace.server");
    const { listPosts } = await import("@/lib/posts.repo");
    const ws = await resolveWorkspace(data.slug);
    return listPosts(ws.id);
  });

export const getPostFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => slugInput.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { resolveWorkspace } = await import("@/lib/workspace.server");
    const { getPostById } = await import("@/lib/posts.repo");
    const ws = await resolveWorkspace(data.slug);
    return getPostById(ws.id, data.id);
  });

// Duplicate-detection hints for the composer (public board read).
export const findSimilarPostsFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => slugInput.extend({ query: z.string().max(140) }).parse(input))
  .handler(async ({ data }) => {
    const { resolveWorkspace } = await import("@/lib/workspace.server");
    const { findSimilarPosts } = await import("@/lib/posts.repo");
    const ws = await resolveWorkspace(data.slug);
    return findSimilarPosts(ws.id, data.query, { limit: 5 });
  });

const CreateInput = slugInput.extend({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().max(2000).optional().nullable(),
  tag: z.string().trim().max(40).optional().nullable(),
});

// Any signed-in user can post to a public board (community participation).
export const createPostFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { resolveWorkspace } = await import("@/lib/workspace.server");
    const { createPost } = await import("@/lib/posts.repo");
    const ws = await resolveWorkspace(data.slug);
    return createPost({
      workspace_id: ws.id,
      title: data.title,
      description: data.description ?? null,
      tag: data.tag ?? null,
      author_id: context.userId,
      source: "web",
    });
  });

// Status changes are a moderation action → workspace admin only.
export const updatePostStatusFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    slugInput.extend({ id: z.string().uuid(), status: StatusEnum }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const { updatePost } = await import("@/lib/posts.repo");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);
    return updatePost(ws.id, data.id, { status: data.status });
  });

// Delete: the author or a workspace admin.
export const deletePostFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => slugInput.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { resolveWorkspace, isWorkspaceAdmin } = await import("@/lib/workspace.server");
    const { getPostById, deletePost } = await import("@/lib/posts.repo");
    const ws = await resolveWorkspace(data.slug);
    const post = await getPostById(ws.id, data.id);
    if (!post) throw new Error("Post not found.");
    const admin = await isWorkspaceAdmin(context.userId, ws.id);
    if (!admin && post.author_id !== context.userId) {
      throw new Error("Forbidden: only the author or a workspace admin can delete this post.");
    }
    await deletePost(ws.id, data.id);
    return { ok: true };
  });
