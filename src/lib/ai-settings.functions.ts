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
  /** The workspace's chosen model for this provider (null = use default). */
  model: string | null;
  /** Suggested model ids for the picker. */
  models: string[];
};

export type AiSettingsResult = {
  providers: AiProviderStatus[];
  active: { provider: string; modelId: string; source: "db" | "env" } | null;
  override: string | null;
  modelOverride: string | null;
};

const slugInput = z.object({ slug: z.string().max(40) });

export const getAiSettings = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((input: unknown) => slugInput.parse(input))
  .handler(async ({ data, context }): Promise<AiSettingsResult> => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);

    const { SUPPORTED_PROVIDERS, loadAllKeys, resolveAiModel } =
      await import("./ai-provider.server");
    const keys = await loadAllKeys(ws.id);
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
        model: k?.model ?? null,
        models: p.models,
      };
    });

    let active: AiSettingsResult["active"] = null;
    try {
      const r = await resolveAiModel(ws.id);
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

const SaveInput = slugInput.extend({
  provider: z.enum(["openai", "anthropic", "google"]),
  apiKey: z.string().trim().min(10).max(500),
  model: z.string().trim().max(80).optional(),
});

export const saveAiProviderKey = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);
    const model = data.model?.trim() || null;
    const { db } = await import("@/db");
    const { ai_provider_keys } = await import("@/db/schema");
    await db
      .insert(ai_provider_keys)
      .values({
        workspace_id: ws.id,
        provider: data.provider,
        api_key: data.apiKey,
        model,
        updated_by: context.userId,
      })
      .onConflictDoUpdate({
        target: [ai_provider_keys.workspace_id, ai_provider_keys.provider],
        set: {
          api_key: data.apiKey,
          model,
          updated_by: context.userId,
          updated_at: new Date().toISOString(),
        },
      });
    return { ok: true };
  });

// Change just the model for an already-configured provider (no re-entering the key).
const ModelInput = slugInput.extend({
  provider: z.enum(["openai", "anthropic", "google"]),
  model: z.string().trim().max(80),
});

export const updateProviderModel = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => ModelInput.parse(input))
  .handler(async ({ data, context }) => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);
    const { db } = await import("@/db");
    const { ai_provider_keys } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");
    await db
      .update(ai_provider_keys)
      .set({ model: data.model.trim() || null, updated_at: new Date().toISOString() })
      .where(
        and(eq(ai_provider_keys.workspace_id, ws.id), eq(ai_provider_keys.provider, data.provider)),
      );
    return { ok: true };
  });

const DeleteInput = slugInput.extend({ provider: z.enum(["openai", "anthropic", "google"]) });

export const deleteAiProviderKey = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => DeleteInput.parse(input))
  .handler(async ({ data, context }) => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);
    const { db } = await import("@/db");
    const { ai_provider_keys } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");
    await db
      .delete(ai_provider_keys)
      .where(
        and(eq(ai_provider_keys.workspace_id, ws.id), eq(ai_provider_keys.provider, data.provider)),
      );
    return { ok: true };
  });
