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
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

export type AiProviderId = "openai" | "anthropic" | "google" | "ollama";

export type AiProviderInfo = {
  id: AiProviderId;
  label: string;
  envVar: string;
  defaultModel: string;
  keyHint: string;
  /** Suggested models shown in the picker; users can also type any model id. */
  models: string[];
  /** OpenAI-compatible providers (Ollama, LM Studio, vLLM…) need a base URL and
   *  the API key is optional; native providers use the vendor SDK + a key. */
  openaiCompatible?: boolean;
  defaultBaseUrl?: string;
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
  {
    id: "ollama",
    label: "Ollama / OpenAI-compatible",
    envVar: "OLLAMA_BASE_URL",
    defaultModel: "llama3.1",
    keyHint: "(optional)",
    models: ["llama3.1", "llama3.2", "qwen2.5", "mistral", "gemma2", "phi3"],
    openaiCompatible: true,
    defaultBaseUrl: "http://localhost:11434/v1",
  },
];

export function providerInfo(id: AiProviderId): AiProviderInfo {
  return SUPPORTED_PROVIDERS.find((p) => p.id === id)!;
}
export function isOpenAICompatible(id: AiProviderId): boolean {
  return !!providerInfo(id).openaiCompatible;
}

// Env keys only count in single-tenant mode (self-host).
function envAllowed(): boolean {
  return !!process.env.SINGLE_TENANT_SLUG?.trim();
}

function envKey(p: AiProviderId): string | undefined {
  if (!envAllowed()) return undefined;
  if (p === "openai") return process.env.OPENAI_API_KEY || undefined;
  if (p === "anthropic") return process.env.ANTHROPIC_API_KEY || undefined;
  if (p === "google")
    return process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || undefined;
  return undefined; // ollama: keyless
}

/** Base URL for OpenAI-compatible providers, from env (single-tenant only). */
function envBaseUrl(p: AiProviderId): string | undefined {
  if (!envAllowed() || !isOpenAICompatible(p)) return undefined;
  return process.env.OLLAMA_BASE_URL?.trim() || undefined;
}

export type ResolvedKey = {
  provider: AiProviderId;
  apiKey: string;
  baseUrl: string | null;
  source: "db" | "env";
  model: string | null;
};

export type KeyStatus = {
  source: "db" | "env";
  last4: string;
  model: string | null;
  baseUrl: string | null;
};

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
      base_url: ai_provider_keys.base_url,
      model: ai_provider_keys.model,
    })
    .from(ai_provider_keys)
    .where(eq(ai_provider_keys.workspace_id, workspaceId));
  const dbMap = new Map<
    string,
    { api_key: string; base_url: string | null; model: string | null }
  >();
  for (const row of data ?? [])
    dbMap.set(row.provider, { api_key: row.api_key, base_url: row.base_url, model: row.model });

  const out = {} as Record<AiProviderId, KeyStatus | null>;
  for (const p of SUPPORTED_PROVIDERS) {
    const dbKey = dbMap.get(p.id);
    if (dbKey) {
      out[p.id] = {
        source: "db",
        last4: dbKey.api_key.slice(-4),
        model: dbKey.model,
        baseUrl: dbKey.base_url,
      };
    } else if (isOpenAICompatible(p.id)) {
      const url = envBaseUrl(p.id);
      out[p.id] = url ? { source: "env", last4: "", model: null, baseUrl: url } : null;
    } else {
      const ev = envKey(p.id);
      out[p.id] = ev ? { source: "env", last4: ev.slice(-4), model: null, baseUrl: null } : null;
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
  baseUrl?: string,
): Promise<string[]> {
  const signal = AbortSignal.timeout(12_000);
  if (provider === "ollama") {
    const url = (baseUrl || providerInfo("ollama").defaultBaseUrl!).replace(/\/$/, "");
    const res = await fetch(`${url}/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal,
    });
    if (!res.ok) throw new Error(`Provider returned ${res.status}`);
    const json = (await res.json()) as { data?: { id: string }[] };
    return (json.data ?? []).map((m) => m.id).sort();
  }
  if (provider === "google") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=200`,
      { signal },
    );
    if (!res.ok) throw new Error(`Provider returned ${res.status}`);
    const json = (await res.json()) as {
      models?: { name: string; supportedGenerationMethods?: string[] }[];
    };
    return (
      (json.models ?? [])
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
        .sort()
    );
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

export type AiErrorCode =
  | "no_provider"
  | "quota"
  | "rate_limit"
  | "invalid_key"
  | "model_not_found"
  | "server";

/**
 * Turn a raw provider/SDK error into a stable, user-meaningful code. The UI
 * maps these to friendly, localized messages — so customers see "your AI quota
 * is exhausted" instead of a wall of provider JSON.
 */
export function classifyAiError(err: unknown): AiErrorCode {
  if (err instanceof NoAiProviderError) return "no_provider";
  const e = err as {
    message?: string;
    statusCode?: number;
    status?: number;
    responseBody?: string;
  };
  const status = e.statusCode ?? e.status ?? 0;
  const msg = `${e.message ?? ""} ${e.responseBody ?? ""}`.toLowerCase();

  if (msg.includes("quota") || msg.includes("resource_exhausted") || msg.includes("billing")) {
    return "quota";
  }
  if (
    status === 429 ||
    status === 529 ||
    msg.includes("rate limit") ||
    msg.includes("rate_limit") ||
    msg.includes("too many requests") ||
    msg.includes("overloaded")
  ) {
    return "rate_limit";
  }
  if (
    status === 401 ||
    status === 403 ||
    msg.includes("api key not valid") ||
    msg.includes("invalid api key") ||
    msg.includes("incorrect api key") ||
    msg.includes("permission_denied") ||
    msg.includes("unauthorized") ||
    msg.includes("invalid x-api-key") ||
    msg.includes("authentication")
  ) {
    return "invalid_key";
  }
  if (
    status === 404 ||
    msg.includes("not found") ||
    msg.includes("does not exist") ||
    msg.includes("not supported for")
  ) {
    return "model_not_found";
  }
  return "server";
}

async function buildResolved(
  workspaceId: string,
  provider: AiProviderId,
  source: "db" | "env",
): Promise<ResolvedKey> {
  if (source === "db") {
    const { api_key, base_url, model } = await loadRawDbKey(workspaceId, provider);
    return { provider, apiKey: api_key, baseUrl: base_url, source: "db", model };
  }
  return {
    provider,
    apiKey: envKey(provider) ?? "",
    baseUrl: envBaseUrl(provider) ?? null,
    source: "env",
    model: null,
  };
}

async function resolveKey(workspaceId: string): Promise<ResolvedKey> {
  const all = await loadAllKeys(workspaceId);
  const overrideRaw = envAllowed() ? process.env.LOOP_AI_PROVIDER?.toLowerCase() : undefined;
  const override = SUPPORTED_PROVIDERS.find((p) => p.id === overrideRaw)?.id;

  if (override && all[override]) {
    return buildResolved(workspaceId, override, all[override]!.source);
  }

  // preference order = SUPPORTED_PROVIDERS order, prefer DB over env
  for (const p of SUPPORTED_PROVIDERS) {
    if (all[p.id]?.source === "db") return buildResolved(workspaceId, p.id, "db");
  }
  for (const p of SUPPORTED_PROVIDERS) {
    if (all[p.id]?.source === "env") return buildResolved(workspaceId, p.id, "env");
  }
  throw new NoAiProviderError();
}

async function loadRawDbKey(
  workspaceId: string,
  provider: AiProviderId,
): Promise<{ api_key: string; base_url: string | null; model: string | null }> {
  const { db } = await import("@/db");
  const { ai_provider_keys } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const rows = await db
    .select({
      api_key: ai_provider_keys.api_key,
      base_url: ai_provider_keys.base_url,
      model: ai_provider_keys.model,
    })
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
  const { provider, apiKey, baseUrl, source, model: storedModel } = await resolveKey(workspaceId);
  const info = providerInfo(provider);
  // Priority: single-tenant env override → the workspace's chosen model → default.
  const modelId = (envAllowed() && process.env.LOOP_AI_MODEL) || storedModel || info.defaultModel;

  let model: LanguageModel;
  if (provider === "openai") model = createOpenAI({ apiKey })(modelId);
  else if (provider === "anthropic") model = createAnthropic({ apiKey })(modelId);
  else if (provider === "google") model = createGoogleGenerativeAI({ apiKey })(modelId);
  else {
    // OpenAI-compatible (Ollama / LM Studio / vLLM): needs a base URL; key optional.
    const url = baseUrl || info.defaultBaseUrl!;
    model = createOpenAICompatible({ name: provider, baseURL: url, apiKey: apiKey || "ollama" })(
      modelId,
    );
  }

  return { model, provider, modelId, source };
}
