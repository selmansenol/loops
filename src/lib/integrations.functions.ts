import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/require-auth";

/**
 * One-way issue-tracker integrations (GitHub / Linear).
 * Configured per board (admin); "send to tracker" from a post creates the issue
 * and returns its URL. Tokens never leave the server (status shows last4 only).
 */

export type IntegrationStatus = {
  provider: "github" | "linear";
  target: string;
  tokenLast4: string;
};

const slugInput = z.object({ slug: z.string().max(40) });
const providerEnum = z.enum(["github", "linear"]);

export const listIntegrationsFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((i: unknown) => slugInput.parse(i))
  .handler(async ({ data, context }): Promise<IntegrationStatus[]> => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);
    const { db } = await import("@/db");
    const { workspace_integrations } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(workspace_integrations)
      .where(eq(workspace_integrations.workspace_id, ws.id));
    return rows.map((r) => ({
      provider: r.provider as "github" | "linear",
      target: r.target,
      tokenLast4: r.token.slice(-4),
    }));
  });

const SaveInput = slugInput.extend({
  provider: providerEnum,
  token: z.string().trim().min(10).max(300),
  target: z.string().trim().min(2).max(200),
});

export const saveIntegrationFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((i: unknown) => SaveInput.parse(i))
  .handler(async ({ data, context }) => {
    if (data.provider === "github" && !/^[\w.-]+\/[\w.-]+$/.test(data.target)) {
      throw new Error("GITHUB_TARGET_FORMAT"); // expects owner/repo
    }
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);
    const { db } = await import("@/db");
    const { workspace_integrations } = await import("@/db/schema");
    await db
      .insert(workspace_integrations)
      .values({
        workspace_id: ws.id,
        provider: data.provider,
        token: data.token,
        target: data.target,
        created_by: context.userId,
      })
      .onConflictDoUpdate({
        target: [workspace_integrations.workspace_id, workspace_integrations.provider],
        set: { token: data.token, target: data.target, created_by: context.userId },
      });
    return { ok: true };
  });

export const deleteIntegrationFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((i: unknown) => slugInput.extend({ provider: providerEnum }).parse(i))
  .handler(async ({ data, context }) => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);
    const { db } = await import("@/db");
    const { workspace_integrations } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");
    await db
      .delete(workspace_integrations)
      .where(
        and(
          eq(workspace_integrations.workspace_id, ws.id),
          eq(workspace_integrations.provider, data.provider),
        ),
      );
    return { ok: true };
  });

/** Create an issue on the configured tracker from a post. Returns the issue URL. */
export const createIssueFromPostFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((i: unknown) =>
    slugInput.extend({ provider: providerEnum, postId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);

    const { db } = await import("@/db");
    const { workspace_integrations } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");
    const [integ] = await db
      .select()
      .from(workspace_integrations)
      .where(
        and(
          eq(workspace_integrations.workspace_id, ws.id),
          eq(workspace_integrations.provider, data.provider),
        ),
      )
      .limit(1);
    if (!integ) throw new Error("NOT_CONFIGURED");

    const { getPostById } = await import("@/lib/posts.repo");
    const post = await getPostById(ws.id, data.postId);
    if (!post) throw new Error("POST_NOT_FOUND");

    const base = (process.env.BETTER_AUTH_URL || "https://getloops.co").replace(/\/$/, "");
    const link = `${base}/${ws.slug}/posts/${post.id}`;
    const body = `${post.description ?? ""}\n\n---\n▲ ${post.votes_count} votes · from the [Loops board](${link})`;
    const signal = AbortSignal.timeout(15_000);

    if (data.provider === "github") {
      const res = await fetch(`https://api.github.com/repos/${integ.target}/issues`, {
        method: "POST",
        signal,
        headers: {
          Authorization: `Bearer ${integ.token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "loops-feedback",
        },
        body: JSON.stringify({ title: post.title, body }),
      });
      if (!res.ok) throw new Error(`PROVIDER_${res.status}`);
      const json = (await res.json()) as { html_url?: string };
      if (!json.html_url) throw new Error("PROVIDER_BAD_RESPONSE");
      return { url: json.html_url };
    }

    // linear
    const res = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      signal,
      headers: { Authorization: integ.token, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `mutation($input: IssueCreateInput!) {
          issueCreate(input: $input) { success issue { url } } }`,
        variables: { input: { teamId: integ.target, title: post.title, description: body } },
      }),
    });
    if (!res.ok) throw new Error(`PROVIDER_${res.status}`);
    const json = (await res.json()) as {
      data?: { issueCreate?: { success?: boolean; issue?: { url?: string } } };
      errors?: { message?: string }[];
    };
    const url = json.data?.issueCreate?.issue?.url;
    if (!url) throw new Error(json.errors?.[0]?.message || "PROVIDER_BAD_RESPONSE");
    return { url };
  });
