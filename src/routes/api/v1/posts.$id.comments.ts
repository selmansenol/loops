import { createFileRoute } from "@tanstack/react-router";
import {
  authenticateRequest,
  errorResponse,
  jsonResponse,
  optionsResponse,
  requireScope,
} from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/v1/posts/$id/comments")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),

      // List comments on a post (workspace-scoped). Read scope.
      GET: async ({ request, params }) => {
        const auth = await authenticateRequest(request);
        if (!auth.ok) return auth.response;
        const scopeErr = requireScope(auth.key, "read");
        if (scopeErr) return scopeErr;

        try {
          const { db } = await import("@/db");
          const { comments, posts, profiles } = await import("@/db/schema");
          const { and, asc, eq } = await import("drizzle-orm");
          const rows = await db
            .select({
              id: comments.id,
              body: comments.body,
              is_official: comments.is_official,
              created_at: comments.created_at,
              author: profiles.username,
            })
            .from(comments)
            .innerJoin(posts, eq(posts.id, comments.post_id))
            .leftJoin(profiles, eq(profiles.id, comments.author_id))
            .where(
              and(eq(comments.post_id, params.id), eq(posts.workspace_id, auth.key.workspace_id)),
            )
            .orderBy(asc(comments.created_at));
          return jsonResponse({ data: rows });
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
