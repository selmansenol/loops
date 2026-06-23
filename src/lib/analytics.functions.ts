import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/require-auth";
import type { Overview } from "@/lib/analytics.server";

const RANGES = [7, 30, 90] as const;

/** Admin-only analytics overview for a workspace. */
export const getAnalyticsOverviewFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z
      .object({
        slug: z.string().max(40),
        days: z
          .number()
          .int()
          .refine((d) => (RANGES as readonly number[]).includes(d)),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<Overview> => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);
    const { getOverview } = await import("@/lib/analytics.server");
    return getOverview(ws.id, data.days);
  });

/** Export the daily analytics series as a CSV string (admin). */
export const exportAnalyticsCsvFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z
      .object({
        slug: z.string().max(40),
        days: z
          .number()
          .int()
          .refine((d) => (RANGES as readonly number[]).includes(d)),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ filename: string; csv: string }> => {
    const { resolveWorkspaceForAdmin } = await import("@/lib/workspace.server");
    const ws = await resolveWorkspaceForAdmin(data.slug, context.userId);
    const { getOverview } = await import("@/lib/analytics.server");
    const o = await getOverview(ws.id, data.days);
    const header = "date,visitors,pageviews,posts,votes,new_members";
    const lines = o.series.map(
      (d) => `${d.day},${d.visitors},${d.views},${d.posts},${d.votes},${d.members}`,
    );
    return {
      filename: `${ws.slug}-analytics-${data.days}d.csv`,
      csv: [header, ...lines].join("\n"),
    };
  });
