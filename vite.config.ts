import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// In dev, load .env into process.env so server code (DATABASE_URL, auth secrets)
// can read it — Vite only auto-exposes VITE_* vars, not plain process.env.
// In Docker/production env vars are provided directly, so the missing file is fine.
try {
  process.loadEnvFile?.(".env");
} catch {
  /* no .env file — rely on the real environment */
}

// Vanilla TanStack Start config (replaces @lovable.dev/vite-tanstack-config).
// Build target is a plain Node server via nitro's default `node-server` preset,
// producing `.output/server/index.mjs` (see `npm start`).
export default defineConfig(async ({ command }) => {
  const plugins = [
    tailwindcss(),
    tanstackStart({
      // Redirect the bundled server entry to src/server.ts (our SSR error wrapper).
      server: { entry: "server" },
      // Only block explicit server-only markers from the client bundle. Server
      // functions strip their handler/middleware bodies on the client, so the
      // server-only imports they reference (e.g. getRequest, the db client)
      // never actually ship. This mirrors the previous working setup.
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
        // require-auth.ts is shared middleware that reaches getRequest only
        // inside server-only code paths; the production build already strips it
        // from the client bundle. Skip the dev-time static check for it.
        ignoreImporters: ["**/require-auth.ts"],
      },
    }),
    viteReact(),
  ];

  // nitro only participates in the production build.
  if (command === "build") {
    const { nitro } = await import("nitro/vite");
    plugins.push(nitro({ defaultPreset: process.env.NITRO_PRESET || "node-server" }));
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": `${process.cwd()}/src`,
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
    },
    server: {
      port: Number(process.env.PORT) || 3000,
    },
  };
});
