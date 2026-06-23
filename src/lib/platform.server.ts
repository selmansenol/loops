/**
 * Platform (getloops.co operator) admin — server only.
 *
 * This is the SUPER-admin view across ALL workspaces: total users, boards,
 * traffic, engagement and growth for the whole deployment. It is gated to the
 * emails listed in PLATFORM_ADMIN_EMAILS (comma-separated). Unset = nobody has
 * access (the safe default for self-host and multi-tenant alike).
 */
import { sql } from "drizzle-orm";

/** Is this email a platform operator? Reads PLATFORM_ADMIN_EMAILS. */
export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.PLATFORM_ADMIN_EMAILS;
  if (!raw) return false;
  const allow = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.trim().toLowerCase());
}

/** Resolve the current session's email and check platform-admin access. */
export async function assertPlatformAdmin(userId: string): Promise<void> {
  const { db } = await import("@/db");
  const { user } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const [u] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId)).limit(1);
  if (!isPlatformAdminEmail(u?.email)) throw new Error("FORBIDDEN");
}

function n(v: unknown): number {
  return v == null ? 0 : Number(v);
}

function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
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

export type PlatformDay = { day: string; visitors: number; users: number; boards: number };

export type PlatformOverview = {
  range: number;
  totals: {
    users: number;
    boards: number;
    members: number;
    posts: number;
    votes: number;
    comments: number;
    visitors: number;
    pageviews: number;
  };
  growth: { newUsers: number; newBoards: number; newPosts: number };
  live: { views1h: number; views24h: number; activeBoards24h: number };
  series: PlatformDay[];
  topBoards: { slug: string; name: string; views: number; posts: number; members: number }[];
  recentUsers: { name: string; email: string; created_at: string }[];
  recentBoards: { slug: string; name: string; created_at: string }[];
};

export async function getPlatformOverview(days: number): Promise<PlatformOverview> {
  const { db } = await import("@/db");
  const since = sql`now() - make_interval(days => ${days})`;

  const [
    usersRow,
    boardsRow,
    membersRow,
    postsRow,
    votesRow,
    commentsRow,
    visitorsRow,
    growthRow,
    liveRow,
    usersByDay,
    boardsByDay,
    viewsByDay,
    topBoards,
    recentUsers,
    recentBoards,
  ] = await Promise.all([
    db.execute(sql`SELECT count(*)::int AS c FROM "user"`),
    db.execute(sql`SELECT count(*)::int AS c FROM workspaces`),
    db.execute(sql`SELECT count(*)::int AS c FROM workspace_members`),
    db.execute(sql`SELECT count(*)::int AS c FROM posts`),
    db.execute(sql`SELECT count(*)::int AS c FROM votes`),
    db.execute(sql`SELECT count(*)::int AS c FROM comments`),
    db.execute(
      sql`SELECT count(*)::int AS pageviews, count(distinct visitor_hash)::int AS visitors FROM analytics_events WHERE created_at >= ${since}`,
    ),
    db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM "user" WHERE created_at >= ${since}) AS new_users,
        (SELECT count(*)::int FROM workspaces WHERE created_at >= ${since}) AS new_boards,
        (SELECT count(*)::int FROM posts WHERE created_at >= ${since}) AS new_posts`),
    db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM analytics_events WHERE created_at >= now() - interval '1 hour') AS views_1h,
        (SELECT count(*)::int FROM analytics_events WHERE created_at >= now() - interval '24 hours') AS views_24h,
        (SELECT count(distinct workspace_id)::int FROM analytics_events WHERE created_at >= now() - interval '24 hours') AS active_boards`),
    db.execute(sql`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, count(*)::int AS c
      FROM "user" WHERE created_at >= ${since} GROUP BY 1`),
    db.execute(sql`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, count(*)::int AS c
      FROM workspaces WHERE created_at >= ${since} GROUP BY 1`),
    db.execute(sql`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, count(distinct visitor_hash)::int AS c
      FROM analytics_events WHERE created_at >= ${since} GROUP BY 1`),
    db.execute(sql`
      SELECT w.slug, w.name,
        (SELECT count(*)::int FROM analytics_events ae WHERE ae.workspace_id = w.id AND ae.created_at >= ${since}) AS views,
        (SELECT count(*)::int FROM posts p WHERE p.workspace_id = w.id) AS posts,
        (SELECT count(*)::int FROM workspace_members m WHERE m.workspace_id = w.id) AS members
      FROM workspaces w
      ORDER BY views DESC, posts DESC LIMIT 10`),
    db.execute(sql`
      SELECT name, email, to_char(created_at, 'YYYY-MM-DD') AS created_at
      FROM "user" ORDER BY created_at DESC LIMIT 8`),
    db.execute(sql`
      SELECT slug, name, to_char(created_at, 'YYYY-MM-DD') AS created_at
      FROM workspaces ORDER BY created_at DESC LIMIT 8`),
  ]);

  const toMap = (rows: unknown[]) => {
    const m = new Map<string, number>();
    for (const r of rows as Record<string, unknown>[]) m.set(String(r.day), n(r.c));
    return m;
  };
  const um = toMap(usersByDay);
  const bm = toMap(boardsByDay);
  const vm = toMap(viewsByDay);
  const series: PlatformDay[] = dayKeys(days).map((day) => ({
    day,
    visitors: vm.get(day) ?? 0,
    users: um.get(day) ?? 0,
    boards: bm.get(day) ?? 0,
  }));

  const row = (r: unknown[]) => (r as Record<string, unknown>[])[0] ?? {};
  const g = row(growthRow);
  const l = row(liveRow);
  const vis = row(visitorsRow);

  return {
    range: days,
    totals: {
      users: n(row(usersRow).c),
      boards: n(row(boardsRow).c),
      members: n(row(membersRow).c),
      posts: n(row(postsRow).c),
      votes: n(row(votesRow).c),
      comments: n(row(commentsRow).c),
      visitors: n(vis.visitors),
      pageviews: n(vis.pageviews),
    },
    growth: { newUsers: n(g.new_users), newBoards: n(g.new_boards), newPosts: n(g.new_posts) },
    live: {
      views1h: n(l.views_1h),
      views24h: n(l.views_24h),
      activeBoards24h: n(l.active_boards),
    },
    series,
    topBoards: (topBoards as Record<string, unknown>[]).map((r) => ({
      slug: String(r.slug),
      name: String(r.name),
      views: n(r.views),
      posts: n(r.posts),
      members: n(r.members),
    })),
    recentUsers: (recentUsers as Record<string, unknown>[]).map((r) => ({
      name: String(r.name),
      email: String(r.email),
      created_at: String(r.created_at),
    })),
    recentBoards: (recentBoards as Record<string, unknown>[]).map((r) => ({
      slug: String(r.slug),
      name: String(r.name),
      created_at: String(r.created_at),
    })),
  };
}
