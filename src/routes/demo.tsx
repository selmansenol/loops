import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/demo")({
  beforeLoad: async () => {
    const { getAppModeFn } = await import("@/lib/workspace.functions");
    const mode = await getAppModeFn();
    const target = mode.singleTenantSlug ?? mode.demoSlug;
    if (target) throw redirect({ to: "/$slug", params: { slug: target } });
    throw redirect({ to: "/dashboard" });
  },
});
