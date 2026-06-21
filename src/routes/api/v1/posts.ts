import { createFileRoute } from "@tanstack/react-router";
import {
  authenticateRequest,
  errorResponse,
  jsonResponse,
  optionsResponse,
  requireScope,
} from "@/lib/api-auth.server";

type PostStatus = "planned" | "progress" | "done";

export const Route = createFileRoute("/api/v1/posts")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),

      GET: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (!auth.ok) return auth.response;
        const scopeErr = requireScope(auth.key, "read");
        if (scopeErr) return scopeErr;

        const url = new URL(request.url);
        const status = (url.searchParams.get("status") as PostStatus | null) ?? undefined;
        const tag = url.searchParams.get("tag") ?? undefined;
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
        const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

        const { listPosts, countPosts } = await import("@/lib/posts.repo");
        const wsId = auth.key.workspace_id;
        try {
          const [data, total] = await Promise.all([
            listPosts(wsId, { status, tag, limit, offset }),
            countPosts(wsId, { status, tag }),
          ]);
          return jsonResponse({ data, total, limit, offset });
        } catch (err) {
          return errorResponse(
            "server_error",
            err instanceof Error ? err.message : String(err),
            500,
          );
        }
      },

      POST: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (!auth.ok) return auth.response;
        const scopeErr = requireScope(auth.key, "write");
        if (scopeErr) return scopeErr;

        let body: {
          title?: unknown;
          description?: unknown;
          tag?: unknown;
          source?: unknown;
          external_user_id?: unknown;
        };
        try {
          body = await request.json();
        } catch {
          return errorResponse("invalid_body", "Geçerli JSON gönder.", 400);
        }
        const title = typeof body.title === "string" ? body.title.trim() : "";
        if (title.length < 3 || title.length > 140) {
          return errorResponse("validation", "title 3-140 karakter olmalı.", 400);
        }
        const description =
          typeof body.description === "string" ? body.description.trim().slice(0, 2000) : null;
        const tag = typeof body.tag === "string" ? body.tag.trim().slice(0, 40) : null;
        const source = typeof body.source === "string" ? body.source.trim().slice(0, 40) : "api";
        const externalUser =
          typeof body.external_user_id === "string" ? body.external_user_id.slice(0, 200) : null;

        const { createPost } = await import("@/lib/posts.repo");
        try {
          const data = await createPost({
            workspace_id: auth.key.workspace_id,
            title,
            description,
            tag,
            source,
            external_user_id: externalUser,
            author_id: null,
            status: "planned",
          });
          return jsonResponse({ data }, { status: 201 });
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
