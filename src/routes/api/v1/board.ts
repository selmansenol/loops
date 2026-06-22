import { createFileRoute } from "@tanstack/react-router";
import {
  authenticateRequest,
  errorResponse,
  jsonResponse,
  optionsResponse,
  requireScope,
} from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/v1/board")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),

      // Info about the board this key belongs to, with status counts. Read scope.
      GET: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (!auth.ok) return auth.response;
        const scopeErr = requireScope(auth.key, "read");
        if (scopeErr) return scopeErr;

        try {
          const { db } = await import("@/db");
          const { workspaces, posts } = await import("@/db/schema");
          const { eq, sql } = await import("drizzle-orm");
          const wsId = auth.key.workspace_id;

          const [ws] = await db
            .select({ slug: workspaces.slug, name: workspaces.name })
            .from(workspaces)
            .where(eq(workspaces.id, wsId))
            .limit(1);
          if (!ws) return errorResponse("not_found", "Board not found.", 404);

          const [counts] = await db
            .select({
              total: sql<number>`count(*)::int`,
              planned: sql<number>`count(*) filter (where ${posts.status} = 'planned')::int`,
              progress: sql<number>`count(*) filter (where ${posts.status} = 'progress')::int`,
              done: sql<number>`count(*) filter (where ${posts.status} = 'done')::int`,
            })
            .from(posts)
            .where(eq(posts.workspace_id, wsId));

          return jsonResponse({
            board: ws,
            counts: counts ?? { total: 0, planned: 0, progress: 0, done: 0 },
          });
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
