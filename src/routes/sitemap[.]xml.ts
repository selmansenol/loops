import { createFileRoute } from "@tanstack/react-router";

const BASE = (process.env.BETTER_AUTH_URL || "https://getloops.co").replace(/\/$/, "");
const STATIC_PATHS = ["/", "/docs", "/vs/canny", "/terms", "/privacy"];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        let slugs: string[] = [];
        try {
          const { db } = await import("@/db");
          const { workspaces } = await import("@/db/schema");
          const rows = await db.select({ slug: workspaces.slug }).from(workspaces);
          slugs = rows.map((r) => r.slug);
        } catch {
          /* DB unavailable → still emit the static URLs */
        }
        const urls = [...STATIC_PATHS.map((p) => BASE + p), ...slugs.map((s) => `${BASE}/${s}`)];
        const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>
`;
        return new Response(body, {
          headers: { "Content-Type": "application/xml; charset=utf-8" },
        });
      },
    },
  },
});
