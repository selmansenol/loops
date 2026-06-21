import { createFileRoute } from "@tanstack/react-router";
import {
  authenticateRequest,
  errorResponse,
  jsonResponse,
  optionsResponse,
  requireScope,
} from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/v1/posts/$id")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),

      GET: async ({ request, params }) => {
        const auth = await authenticateRequest(request);
        if (!auth.ok) return auth.response;
        const scopeErr = requireScope(auth.key, "read");
        if (scopeErr) return scopeErr;

        const { getPostById } = await import("@/lib/posts.repo");
        try {
          const data = await getPostById(auth.key.workspace_id, params.id);
          if (!data) return errorResponse("not_found", "Post bulunamadı.", 404);
          return jsonResponse({ data });
        } catch (err) {
          return errorResponse(
            "server_error",
            err instanceof Error ? err.message : String(err),
            500,
          );
        }
      },

      PATCH: async ({ request, params }) => {
        const auth = await authenticateRequest(request);
        if (!auth.ok) return auth.response;
        const scopeErr = requireScope(auth.key, "admin");
        if (scopeErr) return scopeErr;

        let body: { status?: unknown; tag?: unknown };
        try {
          body = await request.json();
        } catch {
          return errorResponse("invalid_body", "Geçerli JSON gönder.", 400);
        }

        const update: { status?: "planned" | "progress" | "done"; tag?: string } = {};
        if (typeof body.status === "string") {
          if (!["planned", "progress", "done"].includes(body.status)) {
            return errorResponse("validation", "status: planned, progress veya done olmalı.", 400);
          }
          update.status = body.status as "planned" | "progress" | "done";
        }
        if (typeof body.tag === "string") {
          update.tag = body.tag.trim().slice(0, 40);
        }
        if (Object.keys(update).length === 0) {
          return errorResponse("validation", "Güncellenecek alan yok (status veya tag).", 400);
        }

        const { updatePost } = await import("@/lib/posts.repo");
        try {
          const data = await updatePost(auth.key.workspace_id, params.id, update);
          if (!data) return errorResponse("not_found", "Post bulunamadı.", 404);
          return jsonResponse({ data });
        } catch (err) {
          return errorResponse(
            "server_error",
            err instanceof Error ? err.message : String(err),
            500,
          );
        }
      },

      DELETE: async ({ request, params }) => {
        const auth = await authenticateRequest(request);
        if (!auth.ok) return auth.response;
        const scopeErr = requireScope(auth.key, "admin");
        if (scopeErr) return scopeErr;

        const { deletePost } = await import("@/lib/posts.repo");
        try {
          await deletePost(auth.key.workspace_id, params.id);
          return jsonResponse({ ok: true });
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
