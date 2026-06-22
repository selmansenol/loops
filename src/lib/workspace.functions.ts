import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/require-auth";

export type PublicWorkspace = {
  id: string;
  slug: string;
  name: string;
  allowGuestVotes: boolean;
};

/**
 * App deployment mode for client routing. In single-tenant (self-host) mode the
 * whole app is one board at `/`; in multi-tenant (getloops.co) mode `/` is the
 * marketing landing and boards live under `/<slug>`.
 */
export const getAppModeFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    singleTenantSlug: string | null;
    demoSlug: string | null;
    emailVerification: boolean;
    social: { google: boolean; github: boolean };
    maxBoards: number | null;
    feedbackSlug: string | null;
  }> => {
    const { singleTenantSlug, maxBoardsPerUser } = await import("@/lib/workspace.server");
    const { emailEnabled } = await import("@/lib/email.server");
    return {
      singleTenantSlug: singleTenantSlug(),
      demoSlug: process.env.DEMO_WORKSPACE_SLUG?.trim() || null,
      emailVerification: emailEnabled(),
      social: {
        google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        github: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
      },
      maxBoards: maxBoardsPerUser(),
      // getloops.co dogfoods Loops: this is the slug of our own public board.
      feedbackSlug: process.env.FEEDBACK_WORKSPACE_SLUG?.trim() || null,
    };
  },
);

/** Public workspace info for the board shell (no auth). Null if not found. */
export const getWorkspaceFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ slug: z.string().max(40) }).parse(input))
  .handler(async ({ data }): Promise<PublicWorkspace | null> => {
    const { getWorkspaceBySlug } = await import("@/lib/workspace.server");
    const ws = await getWorkspaceBySlug(data.slug);
    return ws
      ? { id: ws.id, slug: ws.slug, name: ws.name, allowGuestVotes: ws.allow_guest_votes }
      : null;
  });

/** Update board settings (owner/admin). */
export const updateBoardSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z.object({ slug: z.string().max(40), allowGuestVotes: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);
    const { db } = await import("@/db");
    const { workspaces } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await db
      .update(workspaces)
      .set({ allow_guest_votes: data.allowGuestVotes })
      .where(eq(workspaces.id, ws.id));
    return { ok: true };
  });

/** Workspaces the current user belongs to. Single-tenant: auto-joins default. */
export const listMyWorkspacesFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { singleTenantSlug, ensureSingleTenantMembership, listMyWorkspaces } =
      await import("@/lib/workspace.server");
    if (singleTenantSlug()) await ensureSingleTenantMembership(context.userId);
    return listMyWorkspaces(context.userId);
  });

/** Current user's role in a workspace (or null). Used to gate admin UI. */
export const getMyWorkspaceRoleFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ slug: z.string().max(40) }).parse(input))
  .handler(async ({ data }): Promise<{ role: "owner" | "admin" | "member" | null }> => {
    const { getOptionalUserId } = await import("@/lib/require-auth");
    const userId = await getOptionalUserId();
    if (!userId) return { role: null };
    const { getWorkspaceBySlug, getMembership } = await import("@/lib/workspace.server");
    const ws = await getWorkspaceBySlug(data.slug);
    if (!ws) return { role: null };
    return { role: await getMembership(userId, ws.id) };
  });

export const checkSlugFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ slug: z.string().max(60) }).parse(input))
  .handler(async ({ data }): Promise<{ available: boolean; reason: string | null }> => {
    const { slugError, slugAvailable } = await import("@/lib/workspace.server");
    const reason = slugError(data.slug);
    if (reason) return { available: false, reason };
    return { available: await slugAvailable(data.slug), reason: null };
  });

const CreateInput = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().min(2).max(40),
});

export const createWorkspaceFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data, context }): Promise<{ slug: string }> => {
    const { createWorkspace, normalizeSlug, maxBoardsPerUser, countOwnedWorkspaces } =
      await import("@/lib/workspace.server");
    const limit = maxBoardsPerUser();
    if (limit !== null && (await countOwnedWorkspaces(context.userId)) >= limit) {
      throw new Error(`BOARD_LIMIT:${limit}`);
    }
    const ws = await createWorkspace({
      name: data.name,
      slug: normalizeSlug(data.slug),
      userId: context.userId,
    });
    return { slug: ws.slug };
  });
