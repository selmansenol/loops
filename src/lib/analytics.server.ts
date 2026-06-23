/**
 * Privacy-first, first-party analytics — server only.
 *
 * recordView() is called by the /api/track beacon on public board pages. We
 * never store PII or set a tracking cookie: a visitor is identified only by a
 * one-way hash of (secret + UTC day + client IP), so it can't be reversed and
 * can't be linked across days. Pageviews = row count; unique visitors/day =
 * distinct visitor_hash within that day.
 *
 * getOverview() powers the admin dashboard. Every query is scoped by
 * workspace_id (multi-tenant isolation).
 */
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";

function secret(): string {
  return process.env.BETTER_AUTH_SECRET ?? "loops";
}

function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function isPublicIp(ip: string): boolean {
  if (/^(127\.|10\.|192\.168\.|169\.254\.|::1$|fc|fd|fe80)/i.test(ip)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return false;
  return true;
}

/** Real client IP = last entry of X-Forwarded-For (the one the proxy appended). */
async function clientIp(): Promise<string | null> {
  try {
    const srv = await import("@tanstack/react-start/server");
    const xff = srv.getRequestHeader("x-forwarded-for");
    if (!xff) return null;
    const parts = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const ip = parts[parts.length - 1] ?? null;
    return ip && isPublicIp(ip) ? ip : null;
  } catch {
    return null;
  }
}

function visitorHash(ip: string | null, day: string): string {
  return createHash("sha256")
    .update(`${secret()}:${day}:${ip ?? "anon"}`)
    .digest("hex")
    .slice(0, 40);
}

/** Record one page view. Best-effort: never throws into the request. */
export async function recordView(input: {
  workspaceId: string;
  path?: string | null;
  referrer?: string | null;
  isMember?: boolean;
}): Promise<void> {
  try {
    const day = utcDay();
    const ip = await clientIp();
    const hash = visitorHash(ip, day);

    let refHost: string | null = null;
    if (input.referrer) {
      try {
        const host = new URL(input.referrer).hostname.replace(/^www\./, "");
        const self = (process.env.BETTER_AUTH_URL || "")
          .replace(/^https?:\/\//, "")
          .replace(/\/.*$/, "")
          .replace(/^www\./, "");
        if (host && host !== self && host !== "localhost") refHost = host.slice(0, 120);
      } catch {
        /* ignore bad referrer */
      }
    }

    const { db } = await import("@/db");
    const { analytics_events } = await import("@/db/schema");
    await db.insert(analytics_events).values({
      workspace_id: input.workspaceId,
      path: input.path ? input.path.slice(0, 200) : null,
      visitor_hash: hash,
      is_member: !!input.isMember,
      referrer_host: refHost,
    });
  } catch (err) {
    console.error("[analytics] recordView:", err instanceof Error ? err.message : err);
  }
}

// ── overview ─────────────────────────────────────────────────────────
export type DayPoint = {
  day: string;
  visitors: number;
  views: number;
  posts: number;
  votes: number;
  members: number;
};

export type Overview = {
  range: number;
  visitors: number;
  pageviews: number;
  members: number;
  posts: number;
  votes: number;
  comments: number;
  postsByStatus: { planned: number; progress: number; done: number };
  series: DayPoint[];
  funnel: { visitors: number; voters: number; members: number };
  topPosts: { id: string; title: string; votes_count: number; status: string }[];
  topReferrers: { host: string; count: number }[];
};

function n(v: unknown): number {
  return v == null ? 0 : Number(v);
}

/** Build the ordered list of UTC day strings for the last `days` days. */
function dayKeys(days: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    out.push(utcDay(d));
  }
  return out;
}

export async function getOverview(workspaceId: string, days: number): Promise<Overview> {
  const { db } = await import("@/db");
  const since = sql`now() - make_interval(days => ${days})`;

  const [
    visitorsRow,
    membersRow,
    postsRow,
    votesRow,
    commentsRow,
    viewsByDay,
    postsByDay,
    votesByDay,
    membersByDay,
    topPosts,
    topReferrers,
    votersRow,
  ] = await Promise.all([
    db.execute(sql`
      SELECT count(*)::int AS pageviews, count(distinct visitor_hash)::int AS visitors
      FROM analytics_events WHERE workspace_id = ${workspaceId} AND created_at >= ${since}`),
    db.execute(sql`
      SELECT count(*)::int AS total FROM workspace_members WHERE workspace_id = ${workspaceId}`),
    db.execute(sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE status='planned')::int AS planned,
        count(*) FILTER (WHERE status='progress')::int AS progress,
        count(*) FILTER (WHERE status='done')::int AS done
      FROM posts WHERE workspace_id = ${workspaceId}`),
    db.execute(sql`
      SELECT count(*)::int AS total FROM votes v
      JOIN posts p ON p.id = v.post_id WHERE p.workspace_id = ${workspaceId}`),
    db.execute(sql`
      SELECT count(*)::int AS total FROM comments c
      JOIN posts p ON p.id = c.post_id WHERE p.workspace_id = ${workspaceId}`),
    db.execute(sql`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
             count(distinct visitor_hash)::int AS visitors, count(*)::int AS views
      FROM analytics_events WHERE workspace_id = ${workspaceId} AND created_at >= ${since}
      GROUP BY 1`),
    db.execute(sql`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, count(*)::int AS c
      FROM posts WHERE workspace_id = ${workspaceId} AND created_at >= ${since} GROUP BY 1`),
    db.execute(sql`
      SELECT to_char(date_trunc('day', v.created_at), 'YYYY-MM-DD') AS day, count(*)::int AS c
      FROM votes v JOIN posts p ON p.id = v.post_id
      WHERE p.workspace_id = ${workspaceId} AND v.created_at >= ${since} GROUP BY 1`),
    db.execute(sql`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, count(*)::int AS c
      FROM workspace_members WHERE workspace_id = ${workspaceId} AND created_at >= ${since} GROUP BY 1`),
    db.execute(sql`
      SELECT id, title, votes_count, status FROM posts
      WHERE workspace_id = ${workspaceId} AND hidden = false
      ORDER BY votes_count DESC, created_at DESC LIMIT 6`),
    db.execute(sql`
      SELECT referrer_host AS host, count(*)::int AS count FROM analytics_events
      WHERE workspace_id = ${workspaceId} AND created_at >= ${since} AND referrer_host IS NOT NULL
      GROUP BY 1 ORDER BY 2 DESC LIMIT 6`),
    db.execute(sql`
      SELECT count(distinct v.user_id)::int AS voters FROM votes v
      JOIN posts p ON p.id = v.post_id WHERE p.workspace_id = ${workspaceId} AND v.created_at >= ${since}`),
  ]);

  const map = (rows: unknown[]) => {
    const m = new Map<string, Record<string, number>>();
    for (const r of rows as Record<string, unknown>[]) m.set(String(r.day), r as never);
    return m;
  };
  const views = map(viewsByDay);
  const pos = map(postsByDay);
  const vot = map(votesByDay);
  const mem = map(membersByDay);

  const series: DayPoint[] = dayKeys(days).map((day) => ({
    day,
    visitors: n(views.get(day)?.visitors),
    views: n(views.get(day)?.views),
    posts: n(pos.get(day)?.c),
    votes: n(vot.get(day)?.c),
    members: n(mem.get(day)?.c),
  }));

  const v0 = (visitorsRow as Record<string, unknown>[])[0] ?? {};
  const p0 = (postsRow as Record<string, unknown>[])[0] ?? {};

  return {
    range: days,
    visitors: n(v0.visitors),
    pageviews: n(v0.pageviews),
    members: n((membersRow as Record<string, unknown>[])[0]?.total),
    posts: n(p0.total),
    votes: n((votesRow as Record<string, unknown>[])[0]?.total),
    comments: n((commentsRow as Record<string, unknown>[])[0]?.total),
    postsByStatus: { planned: n(p0.planned), progress: n(p0.progress), done: n(p0.done) },
    series,
    funnel: {
      visitors: n(v0.visitors),
      voters: n((votersRow as Record<string, unknown>[])[0]?.voters),
      members: n((membersRow as Record<string, unknown>[])[0]?.total),
    },
    topPosts: (topPosts as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      title: String(r.title),
      votes_count: n(r.votes_count),
      status: String(r.status),
    })),
    topReferrers: (topReferrers as Record<string, unknown>[]).map((r) => ({
      host: String(r.host),
      count: n(r.count),
    })),
  };
}

/** Delete analytics events older than `days` (retention). Returns rows removed. */
export async function pruneOldEvents(days: number): Promise<number> {
  const { db } = await import("@/db");
  const res = await db.execute(
    sql`DELETE FROM analytics_events WHERE created_at < now() - make_interval(days => ${days})`,
  );
  // postgres-js exposes affected count on .count for DELETE
  return (res as unknown as { count?: number }).count ?? 0;
}
