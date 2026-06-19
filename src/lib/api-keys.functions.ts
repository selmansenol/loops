import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/require-auth";
import { z } from "zod";
import { generateApiKey, type KeyType } from "./api-auth.server";

export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("@/lib/authz");
    await assertAdmin(context.userId);
    const { db } = await import("@/db");
    const { api_keys } = await import("@/db/schema");
    const { desc } = await import("drizzle-orm");
    return db
      .select({
        id: api_keys.id,
        name: api_keys.name,
        key_prefix: api_keys.key_prefix,
        key_type: api_keys.key_type,
        scopes: api_keys.scopes,
        last_used_at: api_keys.last_used_at,
        revoked_at: api_keys.revoked_at,
        created_at: api_keys.created_at,
      })
      .from(api_keys)
      .orderBy(desc(api_keys.created_at));
  });

const CreateInput = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(["secret", "publishable"]),
  scopes: z.array(z.enum(["read", "write", "admin"])).min(1),
});

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/authz");
    await assertAdmin(context.userId);

    const generated = generateApiKey(data.type as KeyType);
    const { db } = await import("@/db");
    const { api_keys } = await import("@/db/schema");
    const [row] = await db
      .insert(api_keys)
      .values({
        name: data.name,
        key_type: data.type,
        scopes: data.scopes,
        key_prefix: generated.prefix,
        key_hash: generated.hash,
        created_by: context.userId,
      })
      .returning({
        id: api_keys.id,
        name: api_keys.name,
        key_prefix: api_keys.key_prefix,
        key_type: api_keys.key_type,
        scopes: api_keys.scopes,
        created_at: api_keys.created_at,
      });

    // The plaintext key is only returned here, once — never shown again.
    return { ...row, plain_key: generated.plain };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/authz");
    await assertAdmin(context.userId);
    const { db } = await import("@/db");
    const { api_keys } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await db
      .update(api_keys)
      .set({ revoked_at: new Date().toISOString() })
      .where(eq(api_keys.id, data.id));
    return { ok: true };
  });
