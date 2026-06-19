import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/require-auth";
import { z } from "zod";

const ALL_EVENTS = ["post.created", "post.status_changed", "vote.created"] as const;

export const listWebhooks = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("@/lib/authz");
    await assertAdmin(context.userId);
    const { db } = await import("@/db");
    const { webhooks } = await import("@/db/schema");
    const { desc } = await import("drizzle-orm");
    return db.select().from(webhooks).orderBy(desc(webhooks.created_at));
  });

const CreateInput = z.object({
  name: z.string().trim().min(1).max(80),
  url: z.string().url(),
  events: z.array(z.enum(ALL_EVENTS)).min(1),
});

export const createWebhook = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/authz");
    await assertAdmin(context.userId);
    const { db } = await import("@/db");
    const { webhooks } = await import("@/db/schema");
    const [row] = await db
      .insert(webhooks)
      .values({
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
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/authz");
    await assertAdmin(context.userId);
    const { db } = await import("@/db");
    const { webhooks } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await db.delete(webhooks).where(eq(webhooks.id, data.id));
    return { ok: true };
  });

export const toggleWebhook = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/authz");
    await assertAdmin(context.userId);
    const { db } = await import("@/db");
    const { webhooks } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await db.update(webhooks).set({ active: data.active }).where(eq(webhooks.id, data.id));
    return { ok: true };
  });
