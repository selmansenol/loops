/**
 * Workspace (tenant) helpers — server-only. Every piece of app data is scoped to
 * a workspace; this module owns slug rules, lookup, creation, and per-workspace
 * authorization (replaces the old global `user_roles` admin).
 */
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaces, workspace_members, type Workspace } from "@/db/schema";

export type WorkspaceRole = "owner" | "admin" | "member";

// Slugs that collide with top-level routes or are otherwise reserved.
export const RESERVED_SLUGS = new Set([
  "auth",
  "docs",
  "dashboard",
  "new",
  "api",
  "settings",
  "admin",
  "board",
  "roadmap",
  "changelog",
  "posts",
  "insights",
  "login",
  "signup",
  "logout",
  "account",
  "assets",
  "static",
  "public",
  "www",
  "help",
  "support",
  "about",
  "terms",
  "privacy",
  "pricing",
  "sponsors",
  "app",
]);

export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function slugError(slug: string): string | null {
  if (slug.length < 2) return "too_short";
  if (slug.length > 40) return "too_long";
  if (!/^[a-z0-9-]+$/.test(slug)) return "invalid_chars";
  if (RESERVED_SLUGS.has(slug)) return "reserved";
  return null;
}

export async function getWorkspaceBySlug(slug: string): Promise<Workspace | null> {
  const rows = await db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function slugAvailable(slug: string): Promise<boolean> {
  if (slugError(slug)) return false;
  return (await getWorkspaceBySlug(slug)) === null;
}

export async function getMembership(
  userId: string,
  workspaceId: string,
): Promise<WorkspaceRole | null> {
  const rows = await db
    .select({ role: workspace_members.role })
    .from(workspace_members)
    .where(
      and(eq(workspace_members.workspace_id, workspaceId), eq(workspace_members.user_id, userId)),
    )
    .limit(1);
  return (rows[0]?.role as WorkspaceRole | undefined) ?? null;
}

export async function isWorkspaceMember(userId: string, workspaceId: string): Promise<boolean> {
  return (await getMembership(userId, workspaceId)) !== null;
}

export async function isWorkspaceAdmin(userId: string, workspaceId: string): Promise<boolean> {
  const role = await getMembership(userId, workspaceId);
  return role === "owner" || role === "admin";
}

export async function assertMember(userId: string, workspaceId: string): Promise<void> {
  if (!(await isWorkspaceMember(userId, workspaceId))) {
    throw new Error("Forbidden: not a member of this workspace.");
  }
}

export async function assertWorkspaceAdmin(userId: string, workspaceId: string): Promise<void> {
  if (!(await isWorkspaceAdmin(userId, workspaceId))) {
    throw new Error("Forbidden: workspace admin role required.");
  }
}

export type WorkspaceWithRole = { id: string; slug: string; name: string; role: WorkspaceRole };

export async function listMyWorkspaces(userId: string): Promise<WorkspaceWithRole[]> {
  const rows = await db
    .select({
      id: workspaces.id,
      slug: workspaces.slug,
      name: workspaces.name,
      role: workspace_members.role,
      created_at: workspaces.created_at,
    })
    .from(workspace_members)
    .innerJoin(workspaces, eq(workspaces.id, workspace_members.workspace_id))
    .where(eq(workspace_members.user_id, userId))
    .orderBy(desc(workspaces.created_at));
  return rows.map((r) => ({ id: r.id, slug: r.slug, name: r.name, role: r.role as WorkspaceRole }));
}

/**
 * Free-tier limit on how many boards a single user may own (create). Set via
 * `FREE_TIER_MAX_BOARDS`; unset or 0 means unlimited (the self-host default).
 */
export function maxBoardsPerUser(): number | null {
  const raw = parseInt(process.env.FREE_TIER_MAX_BOARDS ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

/** How many workspaces this user owns (i.e. created). */
export async function countOwnedWorkspaces(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(workspace_members)
    .where(and(eq(workspace_members.user_id, userId), eq(workspace_members.role, "owner")));
  return row?.n ?? 0;
}

/** Creates a workspace and makes the creator its owner (atomic). */
export async function createWorkspace(input: {
  name: string;
  slug: string;
  userId: string;
}): Promise<Workspace> {
  const err = slugError(input.slug);
  if (err) throw new Error(`Invalid slug: ${err}`);
  if (!(await slugAvailable(input.slug))) throw new Error("Slug is already taken.");

  return db.transaction(async (tx) => {
    const [ws] = await tx
      .insert(workspaces)
      .values({ name: input.name, slug: input.slug, created_by: input.userId })
      .returning();
    await tx
      .insert(workspace_members)
      .values({ workspace_id: ws.id, user_id: input.userId, role: "owner" });
    return ws;
  });
}

// Resolvers for server functions: slug → workspace, with access checks.
export async function resolveWorkspace(slug: string): Promise<Workspace> {
  const ws = await getWorkspaceBySlug(slug);
  if (!ws) throw new Error("Workspace not found.");
  return ws;
}

export async function resolveWorkspaceForMember(slug: string, userId: string): Promise<Workspace> {
  const ws = await resolveWorkspace(slug);
  await assertMember(userId, ws.id);
  return ws;
}

export async function resolveWorkspaceForAdmin(slug: string, userId: string): Promise<Workspace> {
  const ws = await resolveWorkspace(slug);
  await assertWorkspaceAdmin(userId, ws.id);
  return ws;
}

// ============================================================
// Single-tenant (self-host) mode
// ============================================================

/** When set, the app runs as one board at `/` (open-source self-host). */
export function singleTenantSlug(): string | null {
  return process.env.SINGLE_TENANT_SLUG?.trim() || null;
}

/**
 * Ensures the single-tenant workspace exists (called lazily). The first user to
 * sign in is made its owner; later users become members automatically.
 */
export async function ensureSingleTenantWorkspace(): Promise<Workspace | null> {
  const slug = singleTenantSlug();
  if (!slug) return null;
  const existing = await getWorkspaceBySlug(slug);
  if (existing) return existing;
  const [ws] = await db
    .insert(workspaces)
    .values({ name: "Feedback", slug, created_by: null })
    .onConflictDoNothing()
    .returning();
  return ws ?? (await getWorkspaceBySlug(slug));
}

/**
 * In single-tenant mode, make sure the signed-in user belongs to the default
 * workspace: the very first user becomes owner, everyone after them a member.
 */
export async function ensureSingleTenantMembership(userId: string): Promise<Workspace | null> {
  const ws = await ensureSingleTenantWorkspace();
  if (!ws) return null;
  if (await isWorkspaceMember(userId, ws.id)) return ws;
  const members = await db
    .select({ user_id: workspace_members.user_id })
    .from(workspace_members)
    .where(eq(workspace_members.workspace_id, ws.id))
    .limit(1);
  const role: WorkspaceRole = members.length === 0 ? "owner" : "member";
  await db
    .insert(workspace_members)
    .values({ workspace_id: ws.id, user_id: userId, role })
    .onConflictDoNothing();
  return ws;
}
