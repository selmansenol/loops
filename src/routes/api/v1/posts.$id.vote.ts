import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import {
  authenticateRequest,
  errorResponse,
  jsonResponse,
  optionsResponse,
  requireScope,
} from "@/lib/api-auth.server";

/**
 * Anonim external user'lar için kararlı bir UUID üretir (votes.user_id UUID istiyor).
 * Aynı external_user_id her çağrıda aynı UUID'yi verir.
 */
function externalUserUuid(externalId: string): string {
  const hash = createHash("sha256").update(`loop-ext:${externalId}`).digest("hex");
  // 8-4-4-4-12 UUID formatı, sürüm bit'i UUID v4'e benzer
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export const Route = createFileRoute("/api/v1/posts/$id/vote")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),

      POST: async ({ request, params }) => {
        const auth = await authenticateRequest(request);
        if (!auth.ok) return auth.response;
        const scopeErr = requireScope(auth.key, "write");
        if (scopeErr) return scopeErr;

        const externalUser =
          request.headers.get("X-Loop-External-User") ??
          (await request
            .json()
            .then((b: { external_user_id?: unknown }) =>
              typeof b?.external_user_id === "string" ? b.external_user_id : null,
            )
            .catch(() => null));

        if (!externalUser) {
          return errorResponse(
            "validation",
            "X-Loop-External-User başlığı veya body.external_user_id gerekli.",
            400,
          );
        }

        const userUuid = externalUserUuid(externalUser);

        try {
          const { getPostById, toggleVote } = await import("@/lib/posts.repo");
          const post = await getPostById(params.id);
          if (!post) return errorResponse("not_found", "Post bulunamadı.", 404);

          const result = await toggleVote(params.id, userUuid, externalUser);
          return jsonResponse(result);
        } catch (err) {
          return errorResponse(
            "server_error",
            err instanceof Error ? err.message : String(err),
            500,
          );
        }
      },
    },
  },
});
