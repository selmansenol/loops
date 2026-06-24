import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/require-auth";
import { z } from "zod";

export type AiProviderStatus = {
  id: "openai" | "anthropic" | "google" | "ollama";
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
  /** OpenAI-compatible (Ollama/LM Studio/vLLM): needs a base URL, key optional. */
  openaiCompatible: boolean;
  defaultBaseUrl: string | null;
  /** The configured base URL (OpenAI-compatible providers only). */
  baseUrl: string | null;
};

export type AiSettingsResult = {
  providers: AiProviderStatus[];
  active: { provider: string; modelId: string; source: "db" | "env" } | null;
  override: string | null;
  modelOverride: string | null;
};

const slugInput = z.object({ slug: z.string().max(40) });
const providerEnum = z.enum(["openai", "anthropic", "google", "ollama"]);

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
        openaiCompatible: !!p.openaiCompatible,
        defaultBaseUrl: p.defaultBaseUrl ?? null,
        baseUrl: k?.baseUrl ?? null,
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

// Save a provider config. Native providers (openai/anthropic/google) require an
// API key; OpenAI-compatible ones (ollama) require a base URL, key optional.
const SaveInput = slugInput
  .extend({
    provider: providerEnum,
    apiKey: z.string().trim().max(500).optional(),
    baseUrl: z.string().trim().max(300).optional(),
    model: z.string().trim().max(80).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.provider === "ollama") {
      if (!v.baseUrl || !/^https?:\/\//i.test(v.baseUrl)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["baseUrl"],
          message: "BASE_URL_REQUIRED",
        });
      }
    } else if (!v.apiKey || v.apiKey.length < 10) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["apiKey"], message: "API_KEY_REQUIRED" });
    }
  });

export const saveAiProviderKey = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);
    const model = data.model?.trim() || null;
    const apiKey = data.apiKey?.trim() || "";
    const baseUrl = data.provider === "ollama" ? data.baseUrl!.trim().replace(/\/$/, "") : null;
    const { db } = await import("@/db");
    const { ai_provider_keys } = await import("@/db/schema");
    await db
      .insert(ai_provider_keys)
      .values({
        workspace_id: ws.id,
        provider: data.provider,
        api_key: apiKey,
        base_url: baseUrl,
        model,
        updated_by: context.userId,
      })
      .onConflictDoUpdate({
        target: [ai_provider_keys.workspace_id, ai_provider_keys.provider],
        set: {
          api_key: apiKey,
          base_url: baseUrl,
          model,
          updated_by: context.userId,
          updated_at: new Date().toISOString(),
        },
      });
    return { ok: true };
  });

// List the models the given config can actually use (live, from the provider).
const ListModelsInput = slugInput.extend({
  provider: providerEnum,
  apiKey: z.string().trim().max(500).optional(),
  baseUrl: z.string().trim().max(300).optional(),
});

export const listProviderModels = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => ListModelsInput.parse(input))
  .handler(async ({ data, context }): Promise<{ models: string[] }> => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);
    const { fetchProviderModels, getDbKey } = await import("./ai-provider.server");

    if (data.provider === "ollama") {
      // Base URL drives Ollama; key is optional.
      let baseUrl = data.baseUrl?.trim();
      if (!baseUrl) {
        const { db } = await import("@/db");
        const { ai_provider_keys } = await import("@/db/schema");
        const { and, eq } = await import("drizzle-orm");
        const [row] = await db
          .select({ base_url: ai_provider_keys.base_url })
          .from(ai_provider_keys)
          .where(
            and(eq(ai_provider_keys.workspace_id, ws.id), eq(ai_provider_keys.provider, "ollama")),
          )
          .limit(1);
        baseUrl = row?.base_url ?? undefined;
      }
      if (!baseUrl) throw new Error("NO_BASE_URL");
      const models = await fetchProviderModels("ollama", data.apiKey?.trim() || "", baseUrl);
      return { models };
    }

    const key = data.apiKey?.trim() || (await getDbKey(ws.id, data.provider));
    if (!key) throw new Error("NO_KEY");
    const models = await fetchProviderModels(data.provider, key);
    return { models };
  });

// Change just the model for an already-configured provider (no re-entering the key).
const ModelInput = slugInput.extend({
  provider: providerEnum,
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

const DeleteInput = slugInput.extend({ provider: providerEnum });

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
