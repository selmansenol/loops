import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { useAuth } from "@/lib/auth-context";
import { listMyWorkspacesFn, getAppModeFn } from "@/lib/workspace.functions";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({ meta: [{ title: "Loops · Dashboard" }] }),
  component: DashboardPage,
});

type Workspace = { id: string; slug: string; name: string; role: "owner" | "admin" | "member" };

function DashboardPage() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [limit, setLimit] = useState<number | null>(null);

  const owned = workspaces?.filter((w) => w.role === "owner").length ?? 0;
  const atLimit = limit !== null && owned >= limit;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      // Single-tenant self-host: jump straight to the one board.
      const mode = await getAppModeFn();
      if (mode.singleTenantSlug) {
        await listMyWorkspacesFn(); // auto-joins the default workspace
        if (!cancelled)
          navigate({ to: "/$slug", params: { slug: mode.singleTenantSlug }, replace: true });
        return;
      }
      const list = (await listMyWorkspacesFn()) as Workspace[];
      if (!cancelled) {
        setWorkspaces(list ?? []);
        setLimit(mode.maxBoards);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              {t("dashboard.eyebrow")}
            </p>
            <h1 className="font-display text-4xl font-medium tracking-tight">
              {t("dashboard.title")}
            </h1>
            <p className="text-muted-foreground mt-2">{t("dashboard.lead")}</p>
            {limit !== null && (
              <p className="text-xs text-muted-foreground mt-1">
                {t("newWs.usage", { used: owned, max: limit })}
              </p>
            )}
          </div>
          {atLimit ? (
            <span
              title={t("newWs.limitReached", { count: limit })}
              className="shrink-0 inline-flex items-center gap-2 rounded-full bg-secondary text-muted-foreground px-5 py-2.5 text-sm font-medium cursor-not-allowed"
            >
              {t("dashboard.newBoard")}
            </span>
          ) : (
            <Link
              to="/new"
              className="shrink-0 inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:bg-foreground/90"
            >
              {t("dashboard.newBoard")}
            </Link>
          )}
        </div>

        {workspaces === null ? (
          <div className="rounded-3xl border border-border bg-surface p-12 text-center text-muted-foreground">
            {t("common.loading")}
          </div>
        ) : workspaces.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-surface p-12 text-center">
            <h2 className="font-display text-2xl font-medium tracking-tight mb-2">
              {t("dashboard.empty.title")}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              {t("dashboard.empty.desc")}
            </p>
            <Link
              to="/new"
              className="inline-flex rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:bg-foreground/90"
            >
              {t("dashboard.empty.cta")}
            </Link>
          </div>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-4">
            {workspaces.map((w) => (
              <li key={w.id}>
                <Link
                  to="/$slug"
                  params={{ slug: w.slug }}
                  className="group block rounded-2xl border border-border bg-surface p-5 hover:border-border-strong hover:shadow-card transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-lg font-medium tracking-tight truncate">
                      {w.name}
                    </span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wider rounded-full bg-secondary text-muted-foreground px-2 py-0.5">
                      {t(`dashboard.roles.${w.role}`)}
                    </span>
                  </div>
                  <code className="text-xs text-muted-foreground font-mono">/{w.slug}</code>
                  <span
                    className="mt-3 block text-primary text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-hidden
                  >
                    {t("dashboard.open")} →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
