/**
 * Shared, server-only data access for posts/votes. Used by the web server
 * functions, the public REST API and the chat route. Webhook dispatch lives
 * here in one place (replaces the old DB triggers).
 *
 * Everything is scoped to a `workspaceId` — callers MUST pass the workspace the
 * authenticated user/key belongs to. Cross-workspace access is impossible
 * because every query filters on workspace_id.
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
  priority_bucket: posts.priority_bucket,
  votes_count: posts.votes_count,
  source: posts.source,
  author_id: posts.author_id,
  created_at: posts.created_at,
  shipped_at: posts.shipped_at,
} as const;

export async function listPosts(
  workspaceId: string,
  opts?: { status?: PostStatus; tag?: string; limit?: number; offset?: number },
): Promise<Post[]> {
  const conditions = [eq(posts.workspace_id, workspaceId)];
  if (opts?.status) conditions.push(eq(posts.status, opts.status));
  if (opts?.tag) conditions.push(eq(posts.tag, opts.tag));

  let q = db
    .select(PUBLIC_COLUMNS)
    .from(posts)
    .where(and(...conditions))
    .orderBy(desc(posts.votes_count), desc(posts.created_at))
    .$dynamic();

  if (opts?.limit != null) q = q.limit(opts.limit);
  if (opts?.offset != null) q = q.offset(opts.offset);

  return q as unknown as Promise<Post[]>;
}

export async function countPosts(
  workspaceId: string,
  opts?: { status?: PostStatus; tag?: string },
): Promise<number> {
  const conditions = [eq(posts.workspace_id, workspaceId)];
  if (opts?.status) conditions.push(eq(posts.status, opts.status));
  if (opts?.tag) conditions.push(eq(posts.tag, opts.tag));
  const rows = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(...conditions));
  return rows.length;
}

export async function getPostById(workspaceId: string, id: string): Promise<Post | null> {
  const rows = await db
    .select(PUBLIC_COLUMNS)
    .from(posts)
    .where(and(eq(posts.id, id), eq(posts.workspace_id, workspaceId)))
    .limit(1);
  return (rows[0] as Post | undefined) ?? null;
}

export async function createPost(
  input: { workspace_id: string } & Pick<NewPost, "title" | "description" | "tag"> &
    Partial<Pick<NewPost, "author_id" | "source" | "external_user_id" | "status">>,
): Promise<Post> {
  const [row] = await db
    .insert(posts)
    .values({
      workspace_id: input.workspace_id,
      title: input.title,
      description: input.description ?? null,
      tag: input.tag ?? null,
      author_id: input.author_id ?? null,
      source: input.source ?? "web",
      external_user_id: input.external_user_id ?? null,
      status: input.status ?? "planned",
    })
    .returning(PUBLIC_COLUMNS);

  void dispatchWebhook(input.workspace_id, "post.created", {
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
  workspaceId: string,
  id: string,
  fields: { status?: PostStatus; tag?: string },
): Promise<Post | null> {
  const existing = await getPostById(workspaceId, id);
  if (!existing) return null;

  const [row] = await db
    .update(posts)
    .set(fields)
    .where(and(eq(posts.id, id), eq(posts.workspace_id, workspaceId)))
    .returning(PUBLIC_COLUMNS);
  if (!row) return null;

  if (fields.status && fields.status !== existing.status) {
    void dispatchWebhook(workspaceId, "post.status_changed", {
      id: row.id,
      title: row.title,
      old_status: existing.status,
      new_status: row.status,
    });
  }
  return row as Post;
}

export async function deletePost(workspaceId: string, id: string): Promise<void> {
  await db.delete(posts).where(and(eq(posts.id, id), eq(posts.workspace_id, workspaceId)));
}

/** Toggle a vote for (postId, voterKey) within a workspace. */
export async function toggleVote(
  workspaceId: string,
  postId: string,
  voterKey: string,
  externalUserId?: string | null,
): Promise<{ voted: boolean }> {
  // Ensure the post belongs to this workspace before mutating votes.
  const post = await getPostById(workspaceId, postId);
  if (!post) throw new Error("Post not found.");

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
  void dispatchWebhook(workspaceId, "vote.created", {
    post_id: postId,
    title: post.title,
    votes_count: (post.votes_count ?? 0) + 1,
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

/** Lexical similarity search (pg_trgm) within a workspace. */
export async function findSimilarPosts(
  workspaceId: string,
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
    .where(and(eq(posts.workspace_id, workspaceId), sql`${score} > ${threshold}`))
    .orderBy(desc(score))
    .limit(limit);

  return rows as SimilarPost[];
}

export async function listVoterKeysForPosts(
  workspaceId: string,
  postIds: string[],
): Promise<string[]> {
  if (postIds.length === 0) return [];
  // Constrain to posts in this workspace, then collect their voters.
  const owned = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.workspace_id, workspaceId), inArray(posts.id, postIds)));
  const ids = owned.map((p) => p.id);
  if (ids.length === 0) return [];
  const rows = await db
    .select({ user_id: votes.user_id })
    .from(votes)
    .where(inArray(votes.post_id, ids));
  return Array.from(new Set(rows.map((r) => r.user_id)));
}
