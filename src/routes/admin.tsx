import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { useAuth } from "@/lib/auth-context";
import { AreaChart, Bars } from "@/components/charts";
import { amIPlatformAdminFn, getPlatformOverviewFn } from "@/lib/platform.functions";
import type { PlatformOverview } from "@/lib/platform.server";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Loops · Platform admin" }] }),
  component: PlatformAdminPage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-6 py-10">{children}</div>
      <SiteFooter />
    </div>
  );
}

function PlatformAdminPage() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const checkAdmin = useServerFn(amIPlatformAdminFn);
  const fetchOverview = useServerFn(getPlatformOverviewFn);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<PlatformOverview | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    checkAdmin()
      .then((r) => setAllowed(r.ok))
      .catch(() => setAllowed(false));
  }, [checkAdmin]);

  useEffect(() => {
    if (!allowed) return;
    setBusy(true);
    fetchOverview({ data: { days } })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setBusy(false));
  }, [allowed, days, fetchOverview]);

  if (loading || allowed === null) return null;
  if (!user || !allowed) {
    return (
      <Shell>
        <h1 className="font-display text-3xl font-medium mb-2">{t("platform.denied")}</h1>
        <p className="text-muted-foreground mb-6">{t("platform.deniedHint")}</p>
        <Link
          to="/"
          className="inline-block rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium"
        >
          ← getloops.co
        </Link>
      </Shell>
    );
  }

  const short = (d: string) => d.slice(5);

  return (
    <Shell>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
            {t("platform.eyebrow")}
          </p>
          <h1 className="font-display text-4xl font-medium tracking-tight">
            {t("platform.title")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("platform.subtitle")}</p>
        </div>
        <div className="inline-flex rounded-full border border-border p-0.5 text-sm">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-full transition-colors ${
                days === d
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("admin.range", { days: d })}
            </button>
          ))}
        </div>
      </div>

      {busy || !data ? (
        <div className="text-muted-foreground py-12 text-center">{t("admin.loading")}</div>
      ) : (
        <div className="space-y-8">
          {/* Live strip */}
          <div className="grid grid-cols-3 gap-3">
            <Kpi label={t("platform.live.now")} value={data.live.views1h} accent />
            <Kpi label={t("platform.live.today")} value={data.live.views24h} />
            <Kpi label={t("platform.live.activeBoards")} value={data.live.activeBoards24h} />
          </div>

          {/* Totals */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <Kpi label={t("platform.kpi.users")} value={data.totals.users} />
            <Kpi label={t("platform.kpi.boards")} value={data.totals.boards} />
            <Kpi label={t("platform.kpi.members")} value={data.totals.members} />
            <Kpi label={t("platform.kpi.visitors")} value={data.totals.visitors} />
            <Kpi label={t("platform.kpi.pageviews")} value={data.totals.pageviews} />
            <Kpi label={t("platform.kpi.posts")} value={data.totals.posts} />
            <Kpi label={t("platform.kpi.votes")} value={data.totals.votes} />
            <Kpi label={t("platform.kpi.comments")} value={data.totals.comments} />
          </div>

          <Panel title={t("platform.sections.traffic")} sub={t("platform.range", { days })}>
            <AreaChart data={data.series.map((s) => ({ day: short(s.day), value: s.visitors }))} />
          </Panel>

          <div className="grid lg:grid-cols-2 gap-4">
            <Panel
              title={t("platform.sections.userGrowth")}
              sub={t("platform.newInRange", { count: data.growth.newUsers })}
            >
              <Bars data={data.series.map((s) => ({ day: short(s.day), value: s.users }))} />
            </Panel>
            <Panel
              title={t("platform.sections.boardGrowth")}
              sub={t("platform.newInRange", { count: data.growth.newBoards })}
            >
              <Bars data={data.series.map((s) => ({ day: short(s.day), value: s.boards }))} />
            </Panel>
          </div>

          <Panel title={t("platform.sections.topBoards")}>
            {data.topBoards.length === 0 ? (
              <Empty />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="font-medium py-2">{t("platform.cols.board")}</th>
                      <th className="font-medium py-2 text-right">{t("platform.cols.views")}</th>
                      <th className="font-medium py-2 text-right">{t("platform.cols.posts")}</th>
                      <th className="font-medium py-2 text-right">{t("platform.cols.members")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topBoards.map((b) => (
                      <tr key={b.slug} className="border-t border-border">
                        <td className="py-2">
                          <a
                            href={`/${b.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-primary"
                          >
                            <span className="font-medium">{b.name}</span>{" "}
                            <span className="text-muted-foreground">/{b.slug}</span>
                          </a>
                        </td>
                        <td className="py-2 text-right tabular-nums">{b.views.toLocaleString()}</td>
                        <td className="py-2 text-right tabular-nums">{b.posts}</td>
                        <td className="py-2 text-right tabular-nums">{b.members}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className="grid lg:grid-cols-2 gap-4">
            <Panel title={t("platform.sections.recentUsers")}>
              {data.recentUsers.length === 0 ? (
                <Empty />
              ) : (
                <ul className="space-y-2">
                  {data.recentUsers.map((u) => (
                    <li key={u.email} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{u.name}</span>{" "}
                        <span className="text-muted-foreground">{u.email}</span>
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">{u.created_at}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title={t("platform.sections.recentBoards")}>
              {data.recentBoards.length === 0 ? (
                <Empty />
              ) : (
                <ul className="space-y-2">
                  {data.recentBoards.map((b) => (
                    <li key={b.slug} className="flex items-center justify-between gap-3 text-sm">
                      <a
                        href={`/${b.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 truncate hover:text-primary"
                      >
                        <span className="font-medium">{b.name}</span>{" "}
                        <span className="text-muted-foreground">/{b.slug}</span>
                      </a>
                      <span className="text-xs text-muted-foreground shrink-0">{b.created_at}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <p className="text-xs text-muted-foreground">{t("platform.privacyNote")}</p>
        </div>
      )}
    </Shell>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        accent ? "border-ai/40 bg-ai-soft/40" : "border-border bg-surface"
      }`}
    >
      <div className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function Panel({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </div>
      {children}
    </section>
  );
}

function Empty() {
  const { t } = useTranslation();
  return <p className="text-sm text-muted-foreground py-6 text-center">{t("admin.empty")}</p>;
}
