import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/require-auth";
import { z } from "zod";

export type RoadmapBucketItem = { id: string; title: string; votes_count: number; reason: string };
export type RoadmapProposal = {
  now: RoadmapBucketItem[];
  next: RoadmapBucketItem[];
  later: RoadmapBucketItem[];
  summary: string;
};

const slugInput = z.object({ slug: z.string().max(40) });

/**
 * AI Roadmap Generator. Buckets the most-voted open posts into Now/Next/Later.
 * Returns a proposal only — `applyRoadmapFn` persists it. Workspace admin only.
 */
export const generateRoadmapFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => slugInput.parse(input))
  .handler(async ({ data, context }): Promise<RoadmapProposal> => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);

    const { db } = await import("@/db");
    const { posts } = await import("@/db/schema");
    const { and, desc, eq, ne } = await import("drizzle-orm");

    const rows = await db
      .select({
        id: posts.id,
        title: posts.title,
        description: posts.description,
        tag: posts.tag,
        votes_count: posts.votes_count,
      })
      .from(posts)
      .where(and(eq(posts.workspace_id, ws.id), ne(posts.status, "done")))
      .orderBy(desc(posts.votes_count))
      .limit(60);

    if (rows.length === 0) {
      return { now: [], next: [], later: [], summary: "No open feedback to plan yet." };
    }

    const byId = new Map(rows.map((r) => [r.id, r]));
    const { resolveAiModel, classifyAiError } = await import("@/lib/ai-provider.server");
    let model;
    try {
      ({ model } = await resolveAiModel(ws.id));
    } catch (e) {
      throw new Error(`AI_ERR:${classifyAiError(e)}`);
    }

    const { generateObject } = await import("ai");
    const itemSchema = z.object({ id: z.string(), reason: z.string() });
    const schema = z.object({
      now: z.array(itemSchema),
      next: z.array(itemSchema),
      later: z.array(itemSchema),
      summary: z.string(),
    });

    const corpus = rows
      .map(
        (p) =>
          `[id:${p.id}] (▲${p.votes_count}${p.tag ? `, ${p.tag}` : ""}) ${p.title}${
            p.description ? ` — ${p.description.slice(0, 200)}` : ""
          }`,
      )
      .join("\n");

    let object;
    try {
      ({ object } = await generateObject({
        model,
        schema,
        system:
          "You are a head of product planning a roadmap. Sort feedback into three buckets: 'now' (highest impact, do immediately), 'next' (soon), 'later' (backlog). Weigh vote counts heavily but also coherence of themes. Use ONLY the provided ids; do not invent ids. Keep each reason to one short sentence. Write reasons and summary in the language most of the feedback uses.",
        prompt: `Plan a roadmap from these ${rows.length} feedback items. Put the most important in 'now' (cap ~6), the rest across 'next' and 'later'.\n\n${corpus}`,
      }));
    } catch (e) {
      throw new Error(`AI_ERR:${classifyAiError(e)}`);
    }

    const map = (items: { id: string; reason: string }[]): RoadmapBucketItem[] =>
      items
        .filter((i) => byId.has(i.id))
        .map((i) => {
          const p = byId.get(i.id)!;
          return { id: p.id, title: p.title, votes_count: p.votes_count, reason: i.reason };
        });

    return {
      now: map(object.now),
      next: map(object.next),
      later: map(object.later),
      summary: object.summary,
    };
  });

const ApplyInput = slugInput.extend({
  now: z.array(z.string().uuid()).max(200),
  next: z.array(z.string().uuid()).max(200),
  later: z.array(z.string().uuid()).max(200),
});

/** Persists the chosen buckets onto posts.priority_bucket. Workspace admin only. */
export const applyRoadmapFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => ApplyInput.parse(input))
  .handler(async ({ data, context }) => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);

    const { db } = await import("@/db");
    const { posts } = await import("@/db/schema");
    const { and, eq, inArray } = await import("drizzle-orm");

    const setBucket = (ids: string[], bucket: "now" | "next" | "later") =>
      ids.length
        ? db
            .update(posts)
            .set({ priority_bucket: bucket })
            .where(and(eq(posts.workspace_id, ws.id), inArray(posts.id, ids)))
        : Promise.resolve();

    await Promise.all([
      setBucket(data.now, "now"),
      setBucket(data.next, "next"),
      setBucket(data.later, "later"),
    ]);

    return { ok: true, updated: data.now.length + data.next.length + data.later.length };
  });
