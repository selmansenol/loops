import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/require-auth";

export type PublicWorkspace = { id: string; slug: string; name: string };

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
  }> => {
    const { singleTenantSlug } = await import("@/lib/workspace.server");
    const { emailEnabled } = await import("@/lib/email.server");
    return {
      singleTenantSlug: singleTenantSlug(),
      demoSlug: process.env.DEMO_WORKSPACE_SLUG?.trim() || null,
      emailVerification: emailEnabled(),
    };
  },
);

/** Public workspace info for the board shell (no auth). Null if not found. */
export const getWorkspaceFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ slug: z.string().max(40) }).parse(input))
  .handler(async ({ data }): Promise<PublicWorkspace | null> => {
    const { getWorkspaceBySlug } = await import("@/lib/workspace.server");
    const ws = await getWorkspaceBySlug(data.slug);
    return ws ? { id: ws.id, slug: ws.slug, name: ws.name } : null;
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
    const { createWorkspace, normalizeSlug } = await import("@/lib/workspace.server");
    const ws = await createWorkspace({
      name: data.name,
      slug: normalizeSlug(data.slug),
      userId: context.userId,
    });
    return { slug: ws.slug };
  });
