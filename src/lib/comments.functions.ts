import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/require-auth";

export const listCommentsFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ postId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { db } = await import("@/db");
    const { comments } = await import("@/db/schema");
    const { eq, asc } = await import("drizzle-orm");
    return db
      .select()
      .from(comments)
      .where(eq(comments.post_id, data.postId))
      .orderBy(asc(comments.created_at));
  });

export const createCommentFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z.object({ postId: z.string().uuid(), body: z.string().trim().min(1).max(4000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
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
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { db } = await import("@/db");
    const { comments } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const { isAdmin } = await import("@/lib/authz");
    const [c] = await db.select().from(comments).where(eq(comments.id, data.id)).limit(1);
    if (!c) throw new Error("Comment not found.");
    const admin = await isAdmin(context.userId);
    if (!admin && c.author_id !== context.userId) {
      throw new Error("Forbidden: only the author or an admin can delete this comment.");
    }
    await db.delete(comments).where(eq(comments.id, data.id));
    return { ok: true };
  });

export const toggleOfficialFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z.object({ id: z.string().uuid(), isOfficial: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/authz");
    await assertAdmin(context.userId);
    const { db } = await import("@/db");
    const { comments } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await db.update(comments).set({ is_official: data.isOfficial }).where(eq(comments.id, data.id));
    return { ok: true };
  });
