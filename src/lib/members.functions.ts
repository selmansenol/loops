import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/require-auth";

export type MemberRow = {
  userId: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  joinedAt: string;
  isYou: boolean;
};
export type InviteRow = { id: string; email: string; role: "admin" | "member"; createdAt: string };

const BASE = (process.env.BETTER_AUTH_URL || "https://getloops.co").replace(/\/$/, "");

/** Members of a workspace (admin only). */
export const listMembersFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((input: unknown) => z.object({ slug: z.string().max(40) }).parse(input))
  .handler(async ({ data, context }): Promise<{ members: MemberRow[]; invites: InviteRow[] }> => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);
    const { db } = await import("@/db");
    const { workspace_members, workspace_invites, user } = await import("@/db/schema");
    const { and, desc, eq, isNull } = await import("drizzle-orm");

    const members = await db
      .select({
        userId: user.id,
        name: user.name,
        email: user.email,
        role: workspace_members.role,
        joinedAt: workspace_members.created_at,
      })
      .from(workspace_members)
      .innerJoin(user, eq(user.id, workspace_members.user_id))
      .where(eq(workspace_members.workspace_id, ws.id))
      .orderBy(workspace_members.created_at);

    const invites = await db
      .select({
        id: workspace_invites.id,
        email: workspace_invites.email,
        role: workspace_invites.role,
        createdAt: workspace_invites.created_at,
      })
      .from(workspace_invites)
      .where(and(eq(workspace_invites.workspace_id, ws.id), isNull(workspace_invites.accepted_at)))
      .orderBy(desc(workspace_invites.created_at));

    const rank = { owner: 0, admin: 1, member: 2 } as const;
    return {
      members: members
        .map((m) => ({
          userId: m.userId,
          name: m.name,
          email: m.email,
          role: m.role as MemberRow["role"],
          joinedAt: m.joinedAt,
          isYou: m.userId === context.userId,
        }))
        .sort((a, b) => rank[a.role] - rank[b.role]),
      invites: invites.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role as InviteRow["role"],
        createdAt: i.createdAt,
      })),
    };
  });

/** Invite someone by email. Adds them directly if they already have an account. */
export const inviteMemberFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z
      .object({
        slug: z.string().max(40),
        email: z.string().email().max(200),
        role: z.enum(["member", "admin"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ status: "added" | "invited" }> => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);
    const { db } = await import("@/db");
    const { workspace_members, workspace_invites, user } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");
    const email = data.email.trim().toLowerCase();

    // Already has an account → add membership immediately.
    const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
    if (existing) {
      await db
        .insert(workspace_members)
        .values({ workspace_id: ws.id, user_id: existing.id, role: data.role })
        .onConflictDoNothing();
      return { status: "added" };
    }

    // Otherwise record a pending invite (replace any prior pending one).
    await db
      .delete(workspace_invites)
      .where(and(eq(workspace_invites.workspace_id, ws.id), eq(workspace_invites.email, email)));
    const { randomUUID } = await import("node:crypto");
    await db.insert(workspace_invites).values({
      workspace_id: ws.id,
      email,
      role: data.role,
      token: randomUUID(),
      invited_by: context.userId,
    });

    // Best-effort invite email.
    try {
      const { emailEnabled, sendEmail, emailLayout } = await import("@/lib/email.server");
      if (emailEnabled()) {
        await sendEmail({
          to: email,
          subject: `You've been invited to ${ws.name} on Loops`,
          html: emailLayout({
            heading: `Join ${ws.name}`,
            body: `You've been invited to collaborate on the <strong>${ws.name}</strong> feedback board as ${data.role}. Sign in with this email to accept.`,
            ctaLabel: "Accept invite",
            ctaUrl: `${BASE}/auth?redirect=dashboard`,
          }),
        });
      }
    } catch {
      /* ignore */
    }
    return { status: "invited" };
  });

/** Change a member's role (admin only; can't touch the owner or set owner). */
export const updateMemberRoleFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z
      .object({
        slug: z.string().max(40),
        userId: z.string().max(64),
        role: z.enum(["member", "admin"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);
    const { db } = await import("@/db");
    const { workspace_members } = await import("@/db/schema");
    const { and, eq, ne } = await import("drizzle-orm");
    // Never modify the owner row.
    await db
      .update(workspace_members)
      .set({ role: data.role })
      .where(
        and(
          eq(workspace_members.workspace_id, ws.id),
          eq(workspace_members.user_id, data.userId),
          ne(workspace_members.role, "owner"),
        ),
      );
    return { ok: true };
  });

/** Remove a member (admin only; can't remove the owner). */
export const removeMemberFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z.object({ slug: z.string().max(40), userId: z.string().max(64) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);
    const { db } = await import("@/db");
    const { workspace_members } = await import("@/db/schema");
    const { and, eq, ne } = await import("drizzle-orm");
    await db
      .delete(workspace_members)
      .where(
        and(
          eq(workspace_members.workspace_id, ws.id),
          eq(workspace_members.user_id, data.userId),
          ne(workspace_members.role, "owner"),
        ),
      );
    return { ok: true };
  });

/** Revoke a pending invite (admin only). */
export const revokeInviteFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z.object({ slug: z.string().max(40), inviteId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);
    const { db } = await import("@/db");
    const { workspace_invites } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");
    await db
      .delete(workspace_invites)
      .where(
        and(eq(workspace_invites.workspace_id, ws.id), eq(workspace_invites.id, data.inviteId)),
      );
    return { ok: true };
  });
