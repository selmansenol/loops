import { createFileRoute } from "@tanstack/react-router";

const BASE = (process.env.BETTER_AUTH_URL || "https://getloops.co").replace(/\/$/, "");

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(`User-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap.xml\n`, {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }),
    },
  },
});
