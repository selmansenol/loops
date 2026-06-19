import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/require-auth";
import { z } from "zod";

export type AiProviderStatus = {
  id: "openai" | "anthropic" | "google";
  label: string;
  envVar: string;
  defaultModel: string;
  keyHint: string;
  source: "db" | "env" | null;
  last4: string | null;
};

export type AiSettingsResult = {
  providers: AiProviderStatus[];
  active: { provider: string; modelId: string; source: "db" | "env" } | null;
  override: string | null;
  modelOverride: string | null;
};

async function assertAiAdmin(userId: string) {
  const { isAdmin } = await import("@/lib/authz");
  if (!(await isAdmin(userId))) {
    throw new Error("Only admins can manage AI provider settings.");
  }
}

export const getAiSettings = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<AiSettingsResult> => {
    await assertAiAdmin(context.userId);

    const { SUPPORTED_PROVIDERS, loadAllKeys, resolveAiModel } =
      await import("./ai-provider.server");
    const keys = await loadAllKeys();
    const providers: AiProviderStatus[] = SUPPORTED_PROVIDERS.map((p) => {
      const k = keys[p.id];
      return {
        id: p.id,
        label: p.label,
        envVar: p.envVar,
        defaultModel: p.defaultModel,
        keyHint: p.keyHint,
        source: k?.source ?? null,
        last4: k?.last4 ?? null,
      };
    });

    let active: AiSettingsResult["active"] = null;
    try {
      const r = await resolveAiModel();
      active = { provider: r.provider, modelId: r.modelId, source: r.source };
    } catch {
      active = null;
    }

    return {
      providers,
      active,
      override: process.env.LOOP_AI_PROVIDER || null,
      modelOverride: process.env.LOOP_AI_MODEL || null,
    };
  });

const SaveInput = z.object({
  provider: z.enum(["openai", "anthropic", "google"]),
  apiKey: z.string().trim().min(10).max(500),
});

export const saveAiProviderKey = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAiAdmin(context.userId);
    const { db } = await import("@/db");
    const { ai_provider_keys } = await import("@/db/schema");
    await db
      .insert(ai_provider_keys)
      .values({ provider: data.provider, api_key: data.apiKey, updated_by: context.userId })
      .onConflictDoUpdate({
        target: ai_provider_keys.provider,
        set: {
          api_key: data.apiKey,
          updated_by: context.userId,
          updated_at: new Date().toISOString(),
        },
      });
    return { ok: true };
  });

const DeleteInput = z.object({ provider: z.enum(["openai", "anthropic", "google"]) });

export const deleteAiProviderKey = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => DeleteInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAiAdmin(context.userId);
    const { db } = await import("@/db");
    const { ai_provider_keys } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await db.delete(ai_provider_keys).where(eq(ai_provider_keys.provider, data.provider));
    return { ok: true };
  });
