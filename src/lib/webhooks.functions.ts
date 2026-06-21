import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/require-auth";
import { z } from "zod";

const ALL_EVENTS = ["post.created", "post.status_changed", "vote.created"] as const;
const slugInput = z.object({ slug: z.string().max(40) });

export const listWebhooks = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((input: unknown) => slugInput.parse(input))
  .handler(async ({ data, context }) => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);
    const { db } = await import("@/db");
    const { webhooks } = await import("@/db/schema");
    const { desc, eq } = await import("drizzle-orm");
    return db
      .select()
      .from(webhooks)
      .where(eq(webhooks.workspace_id, ws.id))
      .orderBy(desc(webhooks.created_at));
  });

const CreateInput = slugInput.extend({
  name: z.string().trim().min(1).max(80),
  url: z.string().url(),
  events: z.array(z.enum(ALL_EVENTS)).min(1),
});

export const createWebhook = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);
    const { db } = await import("@/db");
    const { webhooks } = await import("@/db/schema");
    const [row] = await db
      .insert(webhooks)
      .values({
        workspace_id: ws.id,
        name: data.name,
        url: data.url,
        events: data.events,
        created_by: context.userId,
      })
      .returning();
    return row;
  });

export const deleteWebhook = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => slugInput.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);
    const { db } = await import("@/db");
    const { webhooks } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");
    await db
      .delete(webhooks)
      .where(and(eq(webhooks.id, data.id), eq(webhooks.workspace_id, ws.id)));
    return { ok: true };
  });

export const toggleWebhook = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    slugInput.extend({ id: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);
    const { db } = await import("@/db");
    const { webhooks } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");
    await db
      .update(webhooks)
      .set({ active: data.active })
      .where(and(eq(webhooks.id, data.id), eq(webhooks.workspace_id, ws.id)));
    return { ok: true };
  });
