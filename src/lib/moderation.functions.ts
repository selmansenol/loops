import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/require-auth";

export type ModPost = {
  id: string;
  title: string;
  status: "planned" | "progress" | "done";
  hidden: boolean;
  votes_count: number;
  tag: string | null;
  created_at: string;
};

/** All posts (including hidden) for the moderation table. Admin only. */
export const listModerationPostsFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((input: unknown) => z.object({ slug: z.string().max(40) }).parse(input))
  .handler(async ({ data, context }): Promise<ModPost[]> => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);
    const { db } = await import("@/db");
    const { posts } = await import("@/db/schema");
    const { eq, desc } = await import("drizzle-orm");
    const rows = await db
      .select({
        id: posts.id,
        title: posts.title,
        status: posts.status,
        hidden: posts.hidden,
        votes_count: posts.votes_count,
        tag: posts.tag,
        created_at: posts.created_at,
      })
      .from(posts)
      .where(eq(posts.workspace_id, ws.id))
      .orderBy(desc(posts.created_at))
      .limit(500);
    return rows as ModPost[];
  });

/** Bulk status change (admin). Routes through updatePost so webhooks/emails fire. */
export const bulkUpdateStatusFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z
      .object({
        slug: z.string().max(40),
        ids: z.array(z.string().uuid()).min(1).max(200),
        status: z.enum(["planned", "progress", "done"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ updated: number }> => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);
    const { updatePost } = await import("@/lib/posts.repo");
    let updated = 0;
    for (const id of data.ids) {
      const row = await updatePost(ws.id, id, { status: data.status });
      if (row) updated++;
    }
    return { updated };
  });

/** Hide or unhide posts (admin). Hidden posts stay in the DB but leave the board. */
export const setPostsHiddenFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z
      .object({
        slug: z.string().max(40),
        ids: z.array(z.string().uuid()).min(1).max(200),
        hidden: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);
    const { db } = await import("@/db");
    const { posts } = await import("@/db/schema");
    const { and, eq, inArray } = await import("drizzle-orm");
    await db
      .update(posts)
      .set({ hidden: data.hidden })
      .where(and(eq(posts.workspace_id, ws.id), inArray(posts.id, data.ids)));
    return { ok: true };
  });

/** Bulk delete posts (admin). */
export const bulkDeletePostsFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z
      .object({ slug: z.string().max(40), ids: z.array(z.string().uuid()).min(1).max(200) })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);
    const { db } = await import("@/db");
    const { posts } = await import("@/db/schema");
    const { and, eq, inArray } = await import("drizzle-orm");
    await db.delete(posts).where(and(eq(posts.workspace_id, ws.id), inArray(posts.id, data.ids)));
    return { ok: true };
  });
