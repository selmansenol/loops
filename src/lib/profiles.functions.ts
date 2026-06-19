import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Public profiles for a set of user ids. Used to render author/commenter names. */
export const getProfilesFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ ids: z.array(z.string()).max(500) }).parse(input))
  .handler(async ({ data }) => {
    if (data.ids.length === 0) return [];
    const { db } = await import("@/db");
    const { profiles } = await import("@/db/schema");
    const { inArray } = await import("drizzle-orm");
    return db
      .select({ id: profiles.id, username: profiles.username, avatar_url: profiles.avatar_url })
      .from(profiles)
      .where(inArray(profiles.id, data.ids));
  });
