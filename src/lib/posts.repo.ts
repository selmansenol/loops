/**
 * Shared, server-only data access for posts/votes. Used by both the web server
 * functions (`posts.functions.ts`, `votes.functions.ts`) and the public REST
 * API (`/api/v1/*`), so webhook dispatch lives here in one place — it replaces
 * the old DB triggers (`posts_webhook_trigger` / `votes_webhook_trigger`).
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { posts, votes, type NewPost, type Post } from "@/db/schema";
import { dispatchWebhook } from "@/lib/webhooks.server";

export type PostStatus = "planned" | "progress" | "done";

const PUBLIC_COLUMNS = {
  id: posts.id,
  title: posts.title,
  description: posts.description,
  tag: posts.tag,
  status: posts.status,
  votes_count: posts.votes_count,
  source: posts.source,
  author_id: posts.author_id,
  created_at: posts.created_at,
  shipped_at: posts.shipped_at,
} as const;

export async function listPosts(opts?: {
  status?: PostStatus;
  tag?: string;
  limit?: number;
  offset?: number;
}): Promise<Post[]> {
  const conditions = [];
  if (opts?.status) conditions.push(eq(posts.status, opts.status));
  if (opts?.tag) conditions.push(eq(posts.tag, opts.tag));

  let q = db
    .select(PUBLIC_COLUMNS)
    .from(posts)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(posts.votes_count), desc(posts.created_at))
    .$dynamic();

  if (opts?.limit != null) q = q.limit(opts.limit);
  if (opts?.offset != null) q = q.offset(opts.offset);

  return q as unknown as Promise<Post[]>;
}

export async function countPosts(opts?: { status?: PostStatus; tag?: string }): Promise<number> {
  const conditions = [];
  if (opts?.status) conditions.push(eq(posts.status, opts.status));
  if (opts?.tag) conditions.push(eq(posts.tag, opts.tag));
  const rows = await db
    .select({ id: posts.id })
    .from(posts)
    .where(conditions.length ? and(...conditions) : undefined);
  return rows.length;
}

export async function getPostById(id: string): Promise<Post | null> {
  const rows = await db.select(PUBLIC_COLUMNS).from(posts).where(eq(posts.id, id)).limit(1);
  return (rows[0] as Post | undefined) ?? null;
}

export async function createPost(
  input: Pick<NewPost, "title" | "description" | "tag"> &
    Partial<Pick<NewPost, "author_id" | "source" | "external_user_id" | "status">>,
): Promise<Post> {
  const [row] = await db
    .insert(posts)
    .values({
      title: input.title,
      description: input.description ?? null,
      tag: input.tag ?? null,
      author_id: input.author_id ?? null,
      source: input.source ?? "web",
      external_user_id: input.external_user_id ?? null,
      status: input.status ?? "planned",
    })
    .returning(PUBLIC_COLUMNS);

  void dispatchWebhook("post.created", {
    id: row.id,
    title: row.title,
    description: row.description,
    tag: row.tag,
    status: row.status,
    source: row.source,
  });
  return row as Post;
}

export async function updatePost(
  id: string,
  fields: { status?: PostStatus; tag?: string },
): Promise<Post | null> {
  const existing = await getPostById(id);
  if (!existing) return null;

  const [row] = await db
    .update(posts)
    .set(fields)
    .where(eq(posts.id, id))
    .returning(PUBLIC_COLUMNS);
  if (!row) return null;

  if (fields.status && fields.status !== existing.status) {
    void dispatchWebhook("post.status_changed", {
      id: row.id,
      title: row.title,
      old_status: existing.status,
      new_status: row.status,
    });
  }
  return row as Post;
}

export async function deletePost(id: string): Promise<void> {
  await db.delete(posts).where(eq(posts.id, id));
}

/** Toggle a vote for (postId, voterKey). Returns the resulting vote state. */
export async function toggleVote(
  postId: string,
  voterKey: string,
  externalUserId?: string | null,
): Promise<{ voted: boolean }> {
  const existing = await db
    .select({ post_id: votes.post_id })
    .from(votes)
    .where(and(eq(votes.post_id, postId), eq(votes.user_id, voterKey)))
    .limit(1);

  if (existing.length > 0) {
    await db.delete(votes).where(and(eq(votes.post_id, postId), eq(votes.user_id, voterKey)));
    return { voted: false };
  }

  await db.insert(votes).values({
    post_id: postId,
    user_id: voterKey,
    external_user_id: externalUserId ?? null,
  });
  void dispatchWebhook("vote.created", {
    post_id: postId,
    external_user_id: externalUserId ?? null,
  });
  return { voted: true };
}

export type SimilarPost = {
  id: string;
  title: string;
  votes_count: number;
  status: PostStatus;
  score: number;
};

/**
 * Lexical similarity search over post titles/descriptions using pg_trgm
 * (the `posts_*_trgm_idx` GIN indexes). Powers the duplicate-detection hints in
 * the composer (#1) and the chat assistant's `find_similar` tool (#2).
 */
export async function findSimilarPosts(
  query: string,
  opts?: { limit?: number; threshold?: number },
): Promise<SimilarPost[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const limit = opts?.limit ?? 5;
  const threshold = opts?.threshold ?? 0.3;

  const score = sql<number>`GREATEST(similarity(${posts.title}, ${q}), similarity(coalesce(${posts.description}, ''), ${q}))`;
  const rows = await db
    .select({
      id: posts.id,
      title: posts.title,
      votes_count: posts.votes_count,
      status: posts.status,
      score,
    })
    .from(posts)
    .where(sql`${score} > ${threshold}`)
    .orderBy(desc(score))
    .limit(limit);

  return rows as SimilarPost[];
}

export async function listVoterKeysForPosts(postIds: string[]): Promise<string[]> {
  if (postIds.length === 0) return [];
  const rows = await db
    .select({ user_id: votes.user_id })
    .from(votes)
    .where(inArray(votes.post_id, postIds));
  return Array.from(new Set(rows.map((r) => r.user_id)));
}
