/**
 * Public REST API yardımcıları.
 * Bu dosya tamamen sunucu tarafıdır (service_role kullanır).
 */
import { createHash, randomBytes } from "crypto";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Loop-External-User",
  "Access-Control-Max-Age": "86400",
} as const;

export function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
      ...init.headers,
    },
  });
}

export function errorResponse(code: string, message: string, status: number) {
  return jsonResponse({ error: { code, message } }, { status });
}

export function optionsResponse() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function hashKey(plainKey: string): string {
  return createHash("sha256").update(plainKey).digest("hex");
}

export type KeyType = "secret" | "publishable";

export function generateApiKey(type: KeyType): { plain: string; prefix: string; hash: string } {
  const prefix = type === "secret" ? "loop_sk_" : "loop_pk_";
  const random = randomBytes(24).toString("base64url");
  const plain = `${prefix}${random}`;
  return {
    plain,
    prefix: plain.slice(0, prefix.length + 6), // örn: loop_sk_a1b2c3 — sadece görünür kısım
    hash: hashKey(plain),
  };
}

export type AuthedKey = {
  id: string;
  scopes: string[];
  key_type: KeyType;
  created_by: string;
};

export async function authenticateRequest(
  request: Request,
): Promise<{ ok: true; key: AuthedKey } | { ok: false; response: Response }> {
  const header = request.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return {
      ok: false,
      response: errorResponse("unauthorized", "Authorization: Bearer <key> başlığı gerekli.", 401),
    };
  }
  const plain = match[1].trim();
  if (!plain.startsWith("loop_sk_") && !plain.startsWith("loop_pk_")) {
    return { ok: false, response: errorResponse("invalid_key", "Geçersiz key formatı.", 401) };
  }

  const keyHash = hashKey(plain);
  let row: AuthedKey | undefined;
  try {
    const { db } = await import("@/db");
    const { api_keys } = await import("@/db/schema");
    const { and, eq, isNull } = await import("drizzle-orm");

    const rows = await db
      .select({
        id: api_keys.id,
        scopes: api_keys.scopes,
        key_type: api_keys.key_type,
        created_by: api_keys.created_by,
      })
      .from(api_keys)
      .where(and(eq(api_keys.key_hash, keyHash), isNull(api_keys.revoked_at)))
      .limit(1);
    row = rows[0] as AuthedKey | undefined;

    if (row) {
      // Best-effort last-used bookkeeping; never block auth on it.
      await db
        .update(api_keys)
        .set({ last_used_at: new Date().toISOString() })
        .where(eq(api_keys.key_hash, keyHash))
        .catch(() => {});
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, response: errorResponse("server_error", message, 500) };
  }

  if (!row) {
    return {
      ok: false,
      response: errorResponse("invalid_key", "Key bulunamadı veya iptal edilmiş.", 401),
    };
  }
  return { ok: true, key: row };
}

export function requireScope(key: AuthedKey, scope: string): Response | null {
  if (key.scopes.includes(scope) || key.scopes.includes("admin")) return null;
  return errorResponse("forbidden", `Bu işlem için '${scope}' scope'u gerekli.`, 403);
}
