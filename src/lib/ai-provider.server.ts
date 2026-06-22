/**
 * Provider-agnostic AI selection for Loops — scoped per workspace.
 *
 * Each workspace stores its own keys in `ai_provider_keys` (Settings → AI).
 * Env-var fallback (OPENAI_API_KEY / ANTHROPIC_API_KEY /
 * GOOGLE_GENERATIVE_AI_API_KEY, alias GEMINI_API_KEY) only applies in
 * single-tenant self-host mode — in multi-tenant hosting the operator's env
 * keys must not leak across tenants, so each workspace brings its own.
 *
 * Optional override (single-tenant): LOOP_AI_PROVIDER, LOOP_AI_MODEL.
 */

import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

export type AiProviderId = "openai" | "anthropic" | "google";

export type AiProviderInfo = {
  id: AiProviderId;
  label: string;
  envVar: string;
  defaultModel: string;
  keyHint: string;
  /** Suggested models shown in the picker; users can also type any model id. */
  models: string[];
};

export const SUPPORTED_PROVIDERS: AiProviderInfo[] = [
  {
    id: "openai",
    label: "OpenAI (ChatGPT)",
    envVar: "OPENAI_API_KEY",
    defaultModel: "gpt-4o-mini",
    keyHint: "sk-...",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1", "o4-mini"],
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    envVar: "ANTHROPIC_API_KEY",
    defaultModel: "claude-3-5-haiku-latest",
    keyHint: "sk-ant-...",
    models: ["claude-3-5-haiku-latest", "claude-3-5-sonnet-latest", "claude-3-7-sonnet-latest"],
  },
  {
    id: "google",
    label: "Google Gemini",
    envVar: "GOOGLE_GENERATIVE_AI_API_KEY",
    defaultModel: "gemini-2.5-flash",
    keyHint: "AIza...",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-2.0-flash-lite"],
  },
];

// Env keys only count in single-tenant mode (self-host).
function envAllowed(): boolean {
  return !!process.env.SINGLE_TENANT_SLUG?.trim();
}

function envKey(p: AiProviderId): string | undefined {
  if (!envAllowed()) return undefined;
  if (p === "openai") return process.env.OPENAI_API_KEY || undefined;
  if (p === "anthropic") return process.env.ANTHROPIC_API_KEY || undefined;
  return process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || undefined;
}

export type ResolvedKey = {
  provider: AiProviderId;
  apiKey: string;
  source: "db" | "env";
  model: string | null;
};

export type KeyStatus = { source: "db" | "env"; last4: string; model: string | null };

export async function loadAllKeys(
  workspaceId: string,
): Promise<Record<AiProviderId, KeyStatus | null>> {
  const { db } = await import("@/db");
  const { ai_provider_keys } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const data = await db
    .select({
      provider: ai_provider_keys.provider,
      api_key: ai_provider_keys.api_key,
      model: ai_provider_keys.model,
    })
    .from(ai_provider_keys)
    .where(eq(ai_provider_keys.workspace_id, workspaceId));
  const dbMap = new Map<string, { api_key: string; model: string | null }>();
  for (const row of data ?? []) dbMap.set(row.provider, { api_key: row.api_key, model: row.model });

  const out = {} as Record<AiProviderId, KeyStatus | null>;
  for (const p of SUPPORTED_PROVIDERS) {
    const dbKey = dbMap.get(p.id);
    if (dbKey) out[p.id] = { source: "db", last4: dbKey.api_key.slice(-4), model: dbKey.model };
    else {
      const ev = envKey(p.id);
      out[p.id] = ev ? { source: "env", last4: ev.slice(-4), model: null } : null;
    }
  }
  return out;
}

/**
 * Ask the provider which models THIS key can use, so the UI can show a real
 * dropdown instead of guesses. Returns chat/generation-capable model ids.
 */
export async function fetchProviderModels(
  provider: AiProviderId,
  apiKey: string,
): Promise<string[]> {
  const signal = AbortSignal.timeout(12_000);
  if (provider === "google") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=200`,
      { signal },
    );
    if (!res.ok) throw new Error(`Provider returned ${res.status}`);
    const json = (await res.json()) as {
      models?: { name: string; supportedGenerationMethods?: string[] }[];
    };
    return (json.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""))
      // Keep current Gemini chat models; drop legacy 1.x, experimental and
      // non-chat (vision/thinking/tuning/embedding) variants.
      .filter(
        (id) =>
          id.startsWith("gemini-") &&
          !/gemini-1\./.test(id) &&
          !/(exp|vision|thinking|tuning|embedding)/i.test(id),
      )
      .sort();
  }
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal,
    });
    if (!res.ok) throw new Error(`Provider returned ${res.status}`);
    const json = (await res.json()) as { data?: { id: string }[] };
    // Keep current chat families (gpt-4o, gpt-4.1, gpt-5, o1/o3/o4, chatgpt-4o);
    // drop legacy (gpt-3.5, old gpt-4), dated snapshots and non-chat models.
    const keep = /^(gpt-4o|gpt-4\.1|gpt-5|chatgpt-4o|o[1345])/;
    const exclude =
      /(audio|realtime|transcribe|tts|image|embedding|moderation|search|dall-e|whisper|\d{4})/;
    return (json.data ?? [])
      .map((m) => m.id)
      .filter((id) => keep.test(id) && !exclude.test(id))
      .sort();
  }
  // anthropic
  const res = await fetch("https://api.anthropic.com/v1/models?limit=100", {
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    signal,
  });
  if (!res.ok) throw new Error(`Provider returned ${res.status}`);
  const json = (await res.json()) as { data?: { id: string }[] };
  return (json.data ?? []).map((m) => m.id).sort();
}

/** Read just the stored key for a provider (for model listing). Null if none. */
export async function getDbKey(
  workspaceId: string,
  provider: AiProviderId,
): Promise<string | null> {
  try {
    return (await loadRawDbKey(workspaceId, provider)).api_key;
  } catch {
    return null;
  }
}

export class NoAiProviderError extends Error {
  readonly code = "NO_AI_PROVIDER";
  constructor() {
    super("NO_AI_PROVIDER");
  }
}

async function resolveKey(workspaceId: string): Promise<ResolvedKey> {
  const all = await loadAllKeys(workspaceId);
  const overrideRaw = envAllowed() ? process.env.LOOP_AI_PROVIDER?.toLowerCase() : undefined;
  const override = SUPPORTED_PROVIDERS.find((p) => p.id === overrideRaw)?.id;

  if (override && all[override]) {
    const src = all[override]!.source;
    if (src === "db") {
      const { api_key, model } = await loadRawDbKey(workspaceId, override);
      return { provider: override, apiKey: api_key, source: "db", model };
    }
    return { provider: override, apiKey: envKey(override)!, source: "env", model: null };
  }

  // preference order = SUPPORTED_PROVIDERS order, prefer DB over env
  for (const p of SUPPORTED_PROVIDERS) {
    if (all[p.id]?.source === "db") {
      const { api_key, model } = await loadRawDbKey(workspaceId, p.id);
      return { provider: p.id, apiKey: api_key, source: "db", model };
    }
  }
  for (const p of SUPPORTED_PROVIDERS) {
    if (all[p.id]?.source === "env") {
      return { provider: p.id, apiKey: envKey(p.id)!, source: "env", model: null };
    }
  }
  throw new NoAiProviderError();
}

async function loadRawDbKey(
  workspaceId: string,
  provider: AiProviderId,
): Promise<{ api_key: string; model: string | null }> {
  const { db } = await import("@/db");
  const { ai_provider_keys } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const rows = await db
    .select({ api_key: ai_provider_keys.api_key, model: ai_provider_keys.model })
    .from(ai_provider_keys)
    .where(
      and(eq(ai_provider_keys.workspace_id, workspaceId), eq(ai_provider_keys.provider, provider)),
    )
    .limit(1);
  if (!rows[0]) throw new NoAiProviderError();
  return rows[0];
}

export async function resolveAiModel(workspaceId: string): Promise<{
  model: LanguageModel;
  provider: AiProviderId;
  modelId: string;
  source: "db" | "env";
}> {
  const { provider, apiKey, source, model: storedModel } = await resolveKey(workspaceId);
  const info = SUPPORTED_PROVIDERS.find((p) => p.id === provider)!;
  // Priority: single-tenant env override → the workspace's chosen model → default.
  const modelId = (envAllowed() && process.env.LOOP_AI_MODEL) || storedModel || info.defaultModel;

  let model: LanguageModel;
  if (provider === "openai") model = createOpenAI({ apiKey })(modelId);
  else if (provider === "anthropic") model = createAnthropic({ apiKey })(modelId);
  else model = createGoogleGenerativeAI({ apiKey })(modelId);

  return { model, provider, modelId, source };
}
