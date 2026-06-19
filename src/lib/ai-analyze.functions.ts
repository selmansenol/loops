import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/require-auth";
import { generateText } from "ai";
import { z } from "zod";

const ClusterSchema = z.object({
  clusters: z
    .array(
      z.object({
        theme: z.string(),
        summary: z.string(),
        priority: z.enum(["high", "medium", "low"]),
        priority_reason: z.string(),
        post_ids: z.array(z.string()),
        suggested_tag: z.string(),
      }),
    )
    .min(1)
    .max(8),
  overall_insight: z.string(),
});

export type AnalyzeResult = z.infer<typeof ClusterSchema> & {
  _provider?: string;
  _model?: string;
};

export const analyzeFeedback = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<AnalyzeResult> => {
    const { isAdmin } = await import("@/lib/authz");
    if (!(await isAdmin(context.userId))) {
      throw new Error("Only admins can run AI analysis.");
    }

    const { db } = await import("@/db");
    const { posts: postsTable } = await import("@/db/schema");
    const { desc } = await import("drizzle-orm");
    const posts = await db
      .select({
        id: postsTable.id,
        title: postsTable.title,
        description: postsTable.description,
        tag: postsTable.tag,
        status: postsTable.status,
        votes_count: postsTable.votes_count,
      })
      .from(postsTable)
      .orderBy(desc(postsTable.votes_count))
      .limit(200);
    if (!posts || posts.length === 0) {
      return { clusters: [], overall_insight: "No feedback yet to analyze." };
    }

    // Load provider helper inside the handler (server-only module).
    const { resolveAiModel, NoAiProviderError } = await import("./ai-provider.server");
    let resolved: Awaited<ReturnType<typeof resolveAiModel>>;
    try {
      resolved = await resolveAiModel();
    } catch (e) {
      if (e instanceof NoAiProviderError) {
        const err = new Error("NO_AI_PROVIDER") as Error & { code?: string };
        err.code = "NO_AI_PROVIDER";
        throw err;
      }
      throw e;
    }

    const corpus = posts
      .map(
        (p) =>
          `[id:${p.id}] (▲${p.votes_count}, ${p.status}${p.tag ? `, ${p.tag}` : ""}) ${p.title}${
            p.description ? ` — ${p.description}` : ""
          }`,
      )
      .join("\n");

    const schemaHint = `{
  "clusters": [
    {
      "theme": "short title, 3-7 words",
      "summary": "1-2 sentences describing what users want",
      "priority": "high | medium | low",
      "priority_reason": "short justification",
      "post_ids": ["only ids from the provided [id:...] list"],
      "suggested_tag": "single word tag"
    }
  ],
  "overall_insight": "2-3 sentence overall takeaway"
}`;

    const { text } = await generateText({
      model: resolved.model,
      system:
        "You are a product manager. Cluster, summarize and prioritize user feedback. Reply with ONLY valid JSON — no prose, no markdown fences. Match the user-facing language of the feedback in your output. In post_ids, use ONLY ids that appear in the provided [id:...] list.",
      prompt: `Cluster the following ${posts.length} feedback items into 1-8 meaningful themes. Vote counts and frequency influence priority.\n\nReply strictly in this JSON shape:\n${schemaHint}\n\nFeedback:\n${corpus}`,
    });

    const parsed = extractJson(text);
    const result = ClusterSchema.parse(parsed) as AnalyzeResult;
    result._provider = resolved.provider;
    result._model = resolved.modelId;
    return result;
  });

function extractJson(raw: string): unknown {
  let cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  const start = cleaned.search(/[{[]/);
  const lastBrace = cleaned.lastIndexOf("}");
  const lastBracket = cleaned.lastIndexOf("]");
  const end = Math.max(lastBrace, lastBracket);
  if (start === -1 || end === -1) throw new Error("No JSON found in AI response.");
  cleaned = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(cleaned);
  } catch {
    cleaned = cleaned
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]")
      // eslint-disable-next-line no-control-regex -- strip stray control chars the model may emit
      .replace(/[\x00-\x1F\x7F]/g, "");
    return JSON.parse(cleaned);
  }
}

const TagInput = z.object({
  post_ids: z.array(z.string().uuid()).min(1).max(200),
  tag: z.string().trim().min(1).max(40),
});

export const applyClusterTag = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => TagInput.parse(input))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await import("@/lib/authz");
    if (!(await isAdmin(context.userId))) throw new Error("Only admins can run this action.");
    const { db } = await import("@/db");
    const { posts } = await import("@/db/schema");
    const { inArray } = await import("drizzle-orm");
    await db.update(posts).set({ tag: data.tag }).where(inArray(posts.id, data.post_ids));
    return { ok: true, updated: data.post_ids.length };
  });

const MergeInput = z.object({
  post_ids: z.array(z.string().uuid()).min(2).max(50),
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().max(2000).optional(),
  tag: z.string().trim().max(40).optional(),
});

export const mergeClusterPosts = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => MergeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await import("@/lib/authz");
    if (!(await isAdmin(context.userId))) throw new Error("Only admins can run this action.");

    const { db } = await import("@/db");
    const { posts, votes } = await import("@/db/schema");
    const { inArray } = await import("drizzle-orm");

    const [created] = await db
      .insert(posts)
      .values({
        title: data.title,
        description: data.description ?? null,
        tag: data.tag ?? null,
        author_id: context.userId,
        status: "planned",
      })
      .returning({ id: posts.id });
    if (!created) throw new Error("Failed to create merged post.");

    const oldVotes = await db
      .select({ user_id: votes.user_id })
      .from(votes)
      .where(inArray(votes.post_id, data.post_ids));
    const uniqueVoters = Array.from(new Set(oldVotes.map((v) => v.user_id)));
    if (uniqueVoters.length > 0) {
      await db
        .insert(votes)
        .values(uniqueVoters.map((user_id) => ({ post_id: created.id, user_id })))
        .onConflictDoNothing();
    }

    await db.delete(posts).where(inArray(posts.id, data.post_ids));

    return { ok: true, merged_into: created.id, transferred_votes: uniqueVoters.length };
  });
