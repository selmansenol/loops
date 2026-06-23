import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/require-auth";
import type { PlatformOverview } from "@/lib/platform.server";

const RANGES = [7, 30, 90] as const;

/** Whether the current session is a platform operator (gates the /admin link). */
export const amIPlatformAdminFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ ok: boolean }> => {
    const { getOptionalUserId } = await import("@/lib/require-auth");
    const userId = await getOptionalUserId();
    if (!userId) return { ok: false };
    const { db } = await import("@/db");
    const { user } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const [u] = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    const { isPlatformAdminEmail } = await import("@/lib/platform.server");
    return { ok: isPlatformAdminEmail(u?.email) };
  },
);

/** Platform-wide overview (operator only). Throws FORBIDDEN otherwise. */
export const getPlatformOverviewFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z
      .object({
        days: z
          .number()
          .int()
          .refine((d) => (RANGES as readonly number[]).includes(d)),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<PlatformOverview> => {
    const { assertPlatformAdmin, getPlatformOverview } = await import("@/lib/platform.server");
    await assertPlatformAdmin(context.userId);
    return getPlatformOverview(data.days);
  });
