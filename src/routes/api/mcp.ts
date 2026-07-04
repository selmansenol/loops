import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, requireScope, type AuthedKey } from "@/lib/api-auth.server";

/**
 * MCP (Model Context Protocol) server — lets AI agents (Claude, Cursor, …)
 * search, triage and act on a board's feedback directly.
 *
 * Transport: stateless Streamable HTTP (JSON-RPC 2.0 over POST /api/mcp).
 * Auth: the same per-workspace API keys as the REST API
 * (`Authorization: Bearer loop_sk_…`); read tools need the `read` scope,
 * write tools need `write`. Everything is scoped to the key's workspace.
 *
 * Client config example:
 *   { "mcpServers": { "loops": {
 *       "type": "http", "url": "https://getloops.co/api/mcp",
 *       "headers": { "Authorization": "Bearer loop_sk_…" } } } }
 */

const PROTOCOL_VERSION = "2025-03-26";

type ToolArgs = {
  query?: string;
  status?: "planned" | "progress" | "done";
  tag?: string;
  limit?: number;
  id?: string;
  title?: string;
  description?: string;
};
type RpcParams = { protocolVersion?: string; name?: string; arguments?: ToolArgs };
type JsonRpcReq = {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: RpcParams;
};

const rpcResult = (id: JsonRpcReq["id"], result: unknown) =>
  json({ jsonrpc: "2.0", id: id ?? null, result });
const rpcError = (id: JsonRpcReq["id"], code: number, message: string) =>
  json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// ── tool definitions ─────────────────────────────────────────────────
const TOOLS = [
  {
    name: "search_posts",
    description:
      "Search feedback posts on the board. With `query`, finds posts similar to the text; without it, lists posts (optionally filtered by status/tag), ranked by votes.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text search (similarity match)" },
        status: { type: "string", enum: ["planned", "progress", "done"] },
        tag: { type: "string" },
        limit: { type: "number", description: "Max results (default 20, max 50)" },
      },
    },
  },
  {
    name: "get_post",
    description: "Get one post by id, including its comments.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Post id (uuid)" } },
      required: ["id"],
    },
  },
  {
    name: "create_post",
    description: "Create a new feedback post on the board (requires the write scope).",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "3-140 chars" },
        description: { type: "string" },
        tag: { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_post_status",
    description:
      "Move a post to planned / progress / done (requires write). Status changes notify voters and hit the changelog when done.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string", enum: ["planned", "progress", "done"] },
      },
      required: ["id", "status"],
    },
  },
  {
    name: "get_board_stats",
    description: "Board overview: post counts by status and the current top-voted posts.",
    inputSchema: { type: "object", properties: {} },
  },
] as const;

const asText = (data: unknown) => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
});

// ── tool implementations (all scoped to the key's workspace) ─────────
async function callTool(key: AuthedKey, name: string, args: ToolArgs) {
  const wsId = key.workspace_id;
  const needWrite = name === "create_post" || name === "update_post_status";
  const scopeErr = requireScope(key, needWrite ? "write" : "read");
  if (scopeErr) throw new Error(`Missing '${needWrite ? "write" : "read"}' scope for ${name}`);

  const repo = await import("@/lib/posts.repo");

  if (name === "search_posts") {
    const limit = Math.min(Number(args.limit ?? 20), 50);
    if (typeof args.query === "string" && args.query.trim().length >= 2) {
      // Looser threshold than the composer's dedup hint — agents want recall.
      const rows = await repo.findSimilarPosts(wsId, args.query.trim(), {
        limit,
        threshold: 0.12,
      });
      return asText(rows);
    }
    const rows = await repo.listPosts(wsId, {
      status: args.status,
      tag: args.tag,
      limit,
    });
    return asText(
      rows.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        tag: p.tag,
        votes: p.votes_count,
        created_at: p.created_at,
      })),
    );
  }

  if (name === "get_post") {
    const post = await repo.getPostById(wsId, String(args.id ?? ""));
    if (!post) throw new Error("Post not found");
    const { db } = await import("@/db");
    const { comments } = await import("@/db/schema");
    const { eq, asc } = await import("drizzle-orm");
    const rows = await db
      .select({ body: comments.body, is_official: comments.is_official, at: comments.created_at })
      .from(comments)
      .where(eq(comments.post_id, post.id))
      .orderBy(asc(comments.created_at))
      .limit(100);
    return asText({ ...post, comments: rows });
  }

  if (name === "create_post") {
    const title = String(args.title ?? "").trim();
    if (title.length < 3 || title.length > 140) throw new Error("title must be 3-140 chars");
    const post = await repo.createPost({
      workspace_id: wsId,
      title,
      description: typeof args.description === "string" ? args.description.slice(0, 2000) : null,
      tag: typeof args.tag === "string" ? args.tag.slice(0, 40) : null,
      source: "mcp",
    });
    return asText({ id: post.id, title: post.title, status: post.status });
  }

  if (name === "update_post_status") {
    const status = String(args.status ?? "");
    if (!["planned", "progress", "done"].includes(status)) throw new Error("invalid status");
    const post = await repo.updatePost(wsId, String(args.id ?? ""), {
      status: status as "planned" | "progress" | "done",
    });
    if (!post) throw new Error("Post not found");
    return asText({ id: post.id, title: post.title, status: post.status });
  }

  if (name === "get_board_stats") {
    const [total, planned, progress, done, top] = await Promise.all([
      repo.countPosts(wsId),
      repo.countPosts(wsId, { status: "planned" }),
      repo.countPosts(wsId, { status: "progress" }),
      repo.countPosts(wsId, { status: "done" }),
      repo.listPosts(wsId, { limit: 5 }),
    ]);
    return asText({
      posts: { total, planned, progress, done },
      top_voted: top.map((p) => ({ id: p.id, title: p.title, votes: p.votes_count })),
    });
  }

  throw new Error(`Unknown tool: ${name}`);
}

// ── transport ────────────────────────────────────────────────────────
export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      // Stateless server: no SSE stream to resume, so GET has nothing to offer.
      GET: async () => json({ error: "POST JSON-RPC to this endpoint (MCP Streamable HTTP)" }, 405),

      POST: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (!auth.ok) return auth.response;

        const { rateLimit } = await import("@/lib/rate-limit.server");
        if (!rateLimit(`mcp:${auth.key.id}`, 120, 60_000).ok) {
          return rpcError(null, -32000, "Rate limited — retry shortly.");
        }

        let req: JsonRpcReq;
        try {
          req = (await request.json()) as JsonRpcReq;
        } catch {
          return rpcError(null, -32700, "Parse error: body must be JSON");
        }
        const { id, method, params } = req;

        try {
          switch (method) {
            case "initialize":
              return rpcResult(id, {
                protocolVersion:
                  typeof params?.protocolVersion === "string"
                    ? params.protocolVersion
                    : PROTOCOL_VERSION,
                capabilities: { tools: {} },
                serverInfo: { name: "loops", version: "1.0.0" },
                instructions:
                  "Loops feedback board. Use search_posts/get_board_stats to explore, create_post to file feedback, update_post_status to triage.",
              });

            case "notifications/initialized":
            case "notifications/cancelled":
              return new Response(null, { status: 202 });

            case "ping":
              return rpcResult(id, {});

            case "tools/list":
              return rpcResult(id, { tools: TOOLS });

            case "tools/call": {
              const name = String(params?.name ?? "");
              const args = params?.arguments ?? {};
              try {
                return rpcResult(id, await callTool(auth.key, name, args));
              } catch (err) {
                // Tool-level failures are reported in-band per the MCP spec.
                return rpcResult(id, {
                  content: [
                    { type: "text", text: err instanceof Error ? err.message : String(err) },
                  ],
                  isError: true,
                });
              }
            }

            default:
              return rpcError(id, -32601, `Method not found: ${method}`);
          }
        } catch (err) {
          return rpcError(id, -32603, err instanceof Error ? err.message : "Internal error");
        }
      },
    },
  },
});
