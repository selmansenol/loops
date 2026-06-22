import { createFileRoute } from "@tanstack/react-router";
import {
  authenticateRequest,
  errorResponse,
  jsonResponse,
  optionsResponse,
  requireScope,
} from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/v1/changelog")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),

      // Shipped (done) posts, newest first. Read scope.
      GET: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (!auth.ok) return auth.response;
        const scopeErr = requireScope(auth.key, "read");
        if (scopeErr) return scopeErr;

        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

        try {
          const { db } = await import("@/db");
          const { posts } = await import("@/db/schema");
          const { and, desc, eq } = await import("drizzle-orm");
          const rows = await db
            .select({
              id: posts.id,
              title: posts.title,
              description: posts.description,
              tag: posts.tag,
              votes_count: posts.votes_count,
              shipped_at: posts.shipped_at,
            })
            .from(posts)
            .where(and(eq(posts.workspace_id, auth.key.workspace_id), eq(posts.status, "done")))
            .orderBy(desc(posts.shipped_at), desc(posts.created_at))
            .limit(limit);
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
