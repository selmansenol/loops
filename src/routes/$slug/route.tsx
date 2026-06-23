import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getWorkspaceFn, getMyWorkspaceRoleFn } from "@/lib/workspace.functions";
import { WorkspaceProvider, type WorkspaceCtx } from "@/lib/workspace-context";
import { useTrackView } from "@/lib/use-track";

export const Route = createFileRoute("/$slug")({
  component: WorkspaceShell,
});

function WorkspaceShell() {
  const { slug } = Route.useParams();
  // undefined = loading, null = not found
  const [ws, setWs] = useState<WorkspaceCtx | null | undefined>(undefined);
  const [embed, setEmbed] = useState<string | null>(null);
  useTrackView(slug);

  useEffect(() => {
    let cancelled = false;
    setWs(undefined);
    setEmbed(null);
    (async () => {
      const w = await getWorkspaceFn({ data: { slug } });
      if (cancelled) return;
      if (!w) {
        setWs(null);
        return;
      }
      setEmbed(w.analyticsEmbed);
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
      <ExternalAnalytics embed={embed} />
      <Outlet />
    </WorkspaceProvider>
  );
}

/**
 * Injects the workspace's optional external analytics snippet (Plausible, Umami,
 * etc.) into <head>. innerHTML doesn't execute <script>, so we re-create each
 * script node. Cleaned up on unmount / slug change.
 */
function ExternalAnalytics({ embed }: { embed: string | null }) {
  useEffect(() => {
    if (!embed || typeof document === "undefined") return;
    const tpl = document.createElement("div");
    tpl.innerHTML = embed;
    const added: HTMLElement[] = [];
    tpl.querySelectorAll("script").forEach((old) => {
      const s = document.createElement("script");
      for (const a of Array.from(old.attributes)) s.setAttribute(a.name, a.value);
      s.text = old.textContent ?? "";
      document.head.appendChild(s);
      added.push(s);
    });
    return () => added.forEach((s) => s.remove());
  }, [embed]);
  return null;
}
