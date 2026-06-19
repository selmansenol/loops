import { createFileRoute } from "@tanstack/react-router";

/**
 * Conversational feedback capture (#2). A short, tool-using chat that helps a
 * signed-in user turn a vague problem into a structured post — checking for
 * duplicates first. Non-streaming: each request runs one multi-step turn.
 *
 * Body: { messages: { role: "user" | "assistant"; content: string }[] }
 * Returns: { reply: string; createdPostId?: string; similar?: SimilarPost[] }
 */
const jsonError = (code: string, message: string, status: number) =>
  new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const Route = createFileRoute("/api/feedback-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Require a signed-in user (posts are created as them).
        const { auth } = await import("@/lib/auth.server");
        const session = await auth.api.getSession({ headers: request.headers });
        const userId = session?.user?.id;
        if (!userId) return jsonError("unauthorized", "Sign in to use the assistant.", 401);

        let body: { messages?: unknown };
        try {
          body = await request.json();
        } catch {
          return jsonError("invalid_body", "Expected JSON.", 400);
        }
        const rawMessages = Array.isArray(body.messages) ? body.messages : [];
        const messages = rawMessages
          .filter(
            (m): m is { role: "user" | "assistant"; content: string } =>
              !!m &&
              typeof (m as { content?: unknown }).content === "string" &&
              ((m as { role?: unknown }).role === "user" ||
                (m as { role?: unknown }).role === "assistant"),
          )
          .slice(-20);
        if (messages.length === 0) return jsonError("invalid_body", "No messages.", 400);

        const { generateText, tool, stepCountIs } = await import("ai");
        const { z } = await import("zod");
        const { resolveAiModel, NoAiProviderError } = await import("@/lib/ai-provider.server");
        const { findSimilarPosts, createPost } = await import("@/lib/posts.repo");

        let model;
        try {
          ({ model } = await resolveAiModel());
        } catch (e) {
          if (e instanceof NoAiProviderError) {
            return jsonError("no_ai_provider", "No AI provider configured.", 503);
          }
          throw e;
        }

        let createdPostId: string | undefined;
        let lastSimilar: unknown;

        const tools = {
          find_similar: tool({
            description:
              "Search existing feedback posts for ones similar to a query. Always call this before submitting, to avoid duplicates.",
            inputSchema: z.object({ query: z.string() }),
            execute: async ({ query }) => {
              const rows = await findSimilarPosts(query, { limit: 5 });
              lastSimilar = rows;
              return rows;
            },
          }),
          submit_post: tool({
            description:
              "Create a new feedback post once the user has confirmed the title and there is no good existing match.",
            inputSchema: z.object({
              title: z.string().min(3).max(140),
              description: z.string().max(2000).optional(),
              tag: z.string().max(40).optional(),
            }),
            execute: async ({ title, description, tag }) => {
              const post = await createPost({
                title,
                description: description ?? null,
                tag: tag ?? null,
                author_id: userId,
                source: "chat",
              });
              createdPostId = post.id;
              return { id: post.id, title: post.title };
            },
          }),
        };

        const system = [
          "You help a user file a single high-quality product feedback post for the 'Loops' board.",
          "Keep replies short and friendly. Ask at most 1-2 clarifying questions if the request is vague.",
          "Before creating anything, call find_similar to check for duplicates; if a close match exists, suggest the user upvote it instead and ask whether to proceed.",
          "Only call submit_post after the user confirms. After submitting, confirm in one sentence.",
          "Always answer in the same language the user writes in.",
        ].join(" ");

        try {
          const result = await generateText({
            model,
            system,
            messages,
            tools,
            stopWhen: stepCountIs(5),
          });
          return new Response(
            JSON.stringify({ reply: result.text, createdPostId, similar: lastSimilar }),
            { headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          return jsonError("server_error", err instanceof Error ? err.message : String(err), 500);
        }
      },
    },
  },
});
