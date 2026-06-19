import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/require-auth";

const StatusEnum = z.enum(["planned", "progress", "done"]);

export const listPostsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { listPosts } = await import("@/lib/posts.repo");
  return listPosts();
});

export const getPostFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { getPostById } = await import("@/lib/posts.repo");
    return getPostById(data.id);
  });

// Duplicate-detection hints for the composer (#1). Public — board reads are public.
export const findSimilarPostsFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ query: z.string().max(140) }).parse(input))
  .handler(async ({ data }) => {
    const { findSimilarPosts } = await import("@/lib/posts.repo");
    return findSimilarPosts(data.query, { limit: 5 });
  });

const CreateInput = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().max(2000).optional().nullable(),
  tag: z.string().trim().max(40).optional().nullable(),
});

export const createPostFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { createPost } = await import("@/lib/posts.repo");
    return createPost({
      title: data.title,
      description: data.description ?? null,
      tag: data.tag ?? null,
      author_id: context.userId,
      source: "web",
    });
  });

export const updatePostStatusFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: StatusEnum }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/authz");
    await assertAdmin(context.userId);
    const { updatePost } = await import("@/lib/posts.repo");
    return updatePost(data.id, { status: data.status });
  });

export const deletePostFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { getPostById, deletePost } = await import("@/lib/posts.repo");
    const { isAdmin } = await import("@/lib/authz");
    const post = await getPostById(data.id);
    if (!post) throw new Error("Post not found.");
    const admin = await isAdmin(context.userId);
    if (!admin && post.author_id !== context.userId) {
      throw new Error("Forbidden: only the author or an admin can delete this post.");
    }
    await deletePost(data.id);
    return { ok: true };
  });
