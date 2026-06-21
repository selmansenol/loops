import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getWorkspaceFn, getMyWorkspaceRoleFn } from "@/lib/workspace.functions";
import { WorkspaceProvider, type WorkspaceCtx } from "@/lib/workspace-context";

export const Route = createFileRoute("/$slug")({
  component: WorkspaceShell,
});

function WorkspaceShell() {
  const { slug } = Route.useParams();
  // undefined = loading, null = not found
  const [ws, setWs] = useState<WorkspaceCtx | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setWs(undefined);
    (async () => {
      const w = await getWorkspaceFn({ data: { slug } });
      if (cancelled) return;
      if (!w) {
        setWs(null);
        return;
      }
      const { role } = await getMyWorkspaceRoleFn({ data: { slug } });
      if (!cancelled) setWs({ slug: w.slug, name: w.name, role });
    })().catch(() => {
      if (!cancelled) setWs(null);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (ws === undefined) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">…</div>;
  }
  if (ws === null) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="text-center">
          <h1 className="font-display text-3xl font-medium">Board not found</h1>
          <p className="text-muted-foreground mt-2">
            No workspace exists at <span className="font-mono">/{slug}</span>.
          </p>
          <Link to="/" className="mt-6 inline-block text-primary hover:underline">
            ← Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <WorkspaceProvider value={ws}>
      <Outlet />
    </WorkspaceProvider>
  );
}
