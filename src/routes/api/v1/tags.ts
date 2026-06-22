import { createFileRoute } from "@tanstack/react-router";
import {
  authenticateRequest,
  errorResponse,
  jsonResponse,
  optionsResponse,
  requireScope,
} from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/v1/tags")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),

      // Distinct tags used on the board, with post counts. Read scope.
      GET: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (!auth.ok) return auth.response;
        const scopeErr = requireScope(auth.key, "read");
        if (scopeErr) return scopeErr;

        try {
          const { db } = await import("@/db");
          const { posts } = await import("@/db/schema");
          const { and, desc, eq, isNotNull, sql } = await import("drizzle-orm");
          const rows = await db
            .select({ tag: posts.tag, count: sql<number>`count(*)::int` })
            .from(posts)
            .where(and(eq(posts.workspace_id, auth.key.workspace_id), isNotNull(posts.tag)))
            .groupBy(posts.tag)
            .orderBy(desc(sql`count(*)`));
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
