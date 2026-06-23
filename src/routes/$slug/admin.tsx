import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { useAuth } from "@/lib/auth-context";
import { useIsWorkspaceAdmin } from "@/lib/workspace-context";
import { AreaChart, Bars, Funnel } from "@/components/charts";
import { getAnalyticsOverviewFn, exportAnalyticsCsvFn } from "@/lib/analytics.functions";
import type { Overview } from "@/lib/analytics.server";
import {
  listMembersFn,
  inviteMemberFn,
  updateMemberRoleFn,
  removeMemberFn,
  revokeInviteFn,
  type MemberRow,
  type InviteRow,
} from "@/lib/members.functions";
import {
  listModerationPostsFn,
  bulkUpdateStatusFn,
  setPostsHiddenFn,
  bulkDeletePostsFn,
  type ModPost,
} from "@/lib/moderation.functions";
import { updateAnalyticsEmbedFn, getWorkspaceFn } from "@/lib/workspace.functions";

export const Route = createFileRoute("/$slug/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Loops · Admin" }] }),
  component: AdminPage,
});

type Tab = "overview" | "members" | "moderation" | "settings";

function AdminPage() {
  const { slug } = Route.useParams();
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const isAdmin = useIsWorkspaceAdmin();
  const [tab, setTab] = useState<Tab>("overview");

  if (loading) return null;
  if (!user || !isAdmin) {
    return (
      <Shell>
        <h1 className="font-display text-3xl font-medium mb-3">{t("common.denied")}</h1>
        <Link
          to="/$slug"
          params={{ slug }}
          className="inline-block rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium"
        >
          {t("admin.back")}
        </Link>
      </Shell>
    );
  }

  const tabs: Tab[] = ["overview", "members", "moderation", "settings"];
  return (
    <Shell>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{slug}</p>
        <h1 className="font-display text-4xl font-medium tracking-tight">{t("admin.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("admin.subtitle")}</p>
      </div>

      <div className="flex items-center gap-1 mb-8 border-b border-border overflow-x-auto">
        {tabs.map((tk) => (
          <button
            key={tk}
            onClick={() => setTab(tk)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === tk
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(`admin.tabs.${tk}`)}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab slug={slug} />}
      {tab === "members" && <MembersTab slug={slug} />}
      {tab === "moderation" && <ModerationTab slug={slug} />}
      {tab === "settings" && <SettingsTab slug={slug} />}
    </Shell>
  );
}

// ── Overview ─────────────────────────────────────────────────────────
function OverviewTab({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const fetchOverview = useServerFn(getAnalyticsOverviewFn);
  const exportCsv = useServerFn(exportAnalyticsCsvFn);
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchOverview({ data: { slug, days } })
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [slug, days, fetchOverview]);

  const download = async () => {
    try {
      const { filename, csv } = await exportCsv({ data: { slug, days } });
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  };

  const short = (d: string) => d.slice(5); // MM-DD

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3 flex-wrap">
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
        <button
          onClick={download}
          className="text-sm rounded-full border border-border px-4 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          {t("admin.export")}
        </button>
      </div>

      {loading || !data ? (
        <div className="text-muted-foreground py-12 text-center">{t("admin.loading")}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Kpi label={t("admin.kpi.visitors")} value={data.visitors} />
            <Kpi label={t("admin.kpi.pageviews")} value={data.pageviews} />
            <Kpi label={t("admin.kpi.members")} value={data.members} />
            <Kpi label={t("admin.kpi.posts")} value={data.posts} />
            <Kpi label={t("admin.kpi.votes")} value={data.votes} />
            <Kpi label={t("admin.kpi.comments")} value={data.comments} />
          </div>

          <Panel title={t("admin.sections.traffic")}>
            <AreaChart data={data.series.map((s) => ({ day: short(s.day), value: s.visitors }))} />
          </Panel>

          <div className="grid lg:grid-cols-2 gap-4">
            <Panel title={t("admin.sections.engagement")}>
              <Bars
                data={data.series.map((s) => ({ day: short(s.day), value: s.posts + s.votes }))}
              />
              <p className="text-xs text-muted-foreground mt-2">
                {t("admin.sections.engagementHint")}
              </p>
            </Panel>
            <Panel title={t("admin.sections.funnel")}>
              <Funnel
                steps={[
                  { label: t("admin.funnel.visitors"), value: data.funnel.visitors },
                  { label: t("admin.funnel.voters"), value: data.funnel.voters },
                  { label: t("admin.funnel.members"), value: data.funnel.members },
                ]}
              />
            </Panel>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Panel title={t("admin.sections.topPosts")}>
              {data.topPosts.length === 0 ? (
                <Empty />
              ) : (
                <ul className="space-y-2">
                  {data.topPosts.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 text-sm">
                      <span className="tabular-nums font-semibold w-10 shrink-0">
                        ▲ {p.votes_count}
                      </span>
                      <span className="flex-1 min-w-0 truncate">{p.title}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {t(`admin.status.${p.status}`)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title={t("admin.sections.referrers")}>
              {data.topReferrers.length === 0 ? (
                <Empty hint={t("admin.sections.referrersHint")} />
              ) : (
                <ul className="space-y-2">
                  {data.topReferrers.map((r) => (
                    <li key={r.host} className="flex items-center justify-between text-sm">
                      <span className="truncate">{r.host}</span>
                      <span className="tabular-nums text-muted-foreground">{r.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <p className="text-xs text-muted-foreground">{t("admin.privacyNote")}</p>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="text-sm font-semibold mb-4">{title}</h3>
      {children}
    </section>
  );
}

function Empty({ hint }: { hint?: string }) {
  const { t } = useTranslation();
  return <p className="text-sm text-muted-foreground py-4">{hint ?? t("admin.empty")}</p>;
}

// ── Members ──────────────────────────────────────────────────────────
function MembersTab({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const list = useServerFn(listMembersFn);
  const invite = useServerFn(inviteMemberFn);
  const updateRole = useServerFn(updateMemberRoleFn);
  const remove = useServerFn(removeMemberFn);
  const revoke = useServerFn(revokeInviteFn);

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(() => {
    list({ data: { slug } })
      .then((r) => {
        setMembers(r.members);
        setInvites(r.invites);
      })
      .catch(() => {});
  }, [list, slug]);
  useEffect(refresh, [refresh]);

  const submitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await invite({ data: { slug, email: email.trim(), role } });
      setMsg(t(r.status === "added" ? "admin.members.added" : "admin.members.invited"));
      setEmail("");
      refresh();
    } catch {
      setMsg(t("common.denied"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submitInvite} className="rounded-2xl border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold mb-3">{t("admin.members.invite")}</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("admin.members.emailPh")}
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "member" | "admin")}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="member">{t("admin.members.roleMember")}</option>
            <option value="admin">{t("admin.members.roleAdmin")}</option>
          </select>
          <button
            disabled={busy}
            className="rounded-xl bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {t("admin.members.send")}
          </button>
        </div>
        {msg && <p className="text-xs text-muted-foreground mt-2">{msg}</p>}
      </form>

      <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
        {members.map((m) => (
          <div key={m.userId} className="flex items-center gap-3 p-4">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {m.name}{" "}
                {m.isYou && (
                  <span className="text-muted-foreground">({t("admin.members.you")})</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground truncate">{m.email}</div>
            </div>
            <span className="text-xs rounded-full bg-accent px-2.5 py-1 capitalize">
              {t(`admin.members.role_${m.role}`)}
            </span>
            {m.role !== "owner" && !m.isYou && (
              <div className="flex items-center gap-1">
                <button
                  onClick={async () => {
                    await updateRole({
                      data: {
                        slug,
                        userId: m.userId,
                        role: m.role === "admin" ? "member" : "admin",
                      },
                    });
                    refresh();
                  }}
                  className="text-xs rounded-full border border-border px-2.5 py-1 hover:bg-accent"
                >
                  {m.role === "admin"
                    ? t("admin.members.makeMember")
                    : t("admin.members.makeAdmin")}
                </button>
                <button
                  onClick={async () => {
                    await remove({ data: { slug, userId: m.userId } });
                    refresh();
                  }}
                  className="text-xs rounded-full border border-border px-2.5 py-1 text-red-600 hover:bg-red-50"
                >
                  {t("admin.members.remove")}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {invites.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">{t("admin.members.pending")}</h3>
          <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
            {invites.map((i) => (
              <div key={i.id} className="flex items-center gap-3 p-4 text-sm">
                <span className="flex-1 min-w-0 truncate">{i.email}</span>
                <span className="text-xs rounded-full bg-accent px-2.5 py-1">
                  {t(`admin.members.role_${i.role}`)}
                </span>
                <button
                  onClick={async () => {
                    await revoke({ data: { slug, inviteId: i.id } });
                    refresh();
                  }}
                  className="text-xs text-red-600 hover:underline"
                >
                  {t("admin.members.remove")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Moderation ───────────────────────────────────────────────────────
function ModerationTab({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const list = useServerFn(listModerationPostsFn);
  const bulkStatus = useServerFn(bulkUpdateStatusFn);
  const setHidden = useServerFn(setPostsHiddenFn);
  const bulkDelete = useServerFn(bulkDeletePostsFn);

  const [posts, setPosts] = useState<ModPost[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    list({ data: { slug } })
      .then((r) => setPosts(r))
      .catch(() => {});
  }, [list, slug]);
  useEffect(refresh, [refresh]);

  const ids = useMemo(() => Array.from(sel), [sel]);
  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      setSel(new Set());
      refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {ids.length > 0 && (
        <div className="sticky top-16 z-10 flex items-center gap-2 flex-wrap rounded-xl border border-border bg-surface/95 backdrop-blur p-3">
          <span className="text-sm font-medium">{t("admin.mod.selected", { n: ids.length })}</span>
          <div className="flex items-center gap-1 ml-auto flex-wrap">
            {(["planned", "progress", "done"] as const).map((s) => (
              <button
                key={s}
                disabled={busy}
                onClick={() => run(() => bulkStatus({ data: { slug, ids, status: s } }))}
                className="text-xs rounded-full border border-border px-2.5 py-1 hover:bg-accent"
              >
                → {t(`admin.status.${s}`)}
              </button>
            ))}
            <button
              disabled={busy}
              onClick={() => run(() => setHidden({ data: { slug, ids, hidden: true } }))}
              className="text-xs rounded-full border border-border px-2.5 py-1 hover:bg-accent"
            >
              {t("admin.mod.hide")}
            </button>
            <button
              disabled={busy}
              onClick={() => run(() => setHidden({ data: { slug, ids, hidden: false } }))}
              className="text-xs rounded-full border border-border px-2.5 py-1 hover:bg-accent"
            >
              {t("admin.mod.unhide")}
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (confirm(t("admin.mod.confirmDelete", { n: ids.length })))
                  run(() => bulkDelete({ data: { slug, ids } }));
              }}
              className="text-xs rounded-full border border-border px-2.5 py-1 text-red-600 hover:bg-red-50"
            >
              {t("admin.mod.delete")}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground p-5">{t("admin.empty")}</p>
        ) : (
          posts.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-accent/40"
            >
              <input
                type="checkbox"
                checked={sel.has(p.id)}
                onChange={() => toggle(p.id)}
                className="h-4 w-4"
              />
              <span className="tabular-nums text-xs text-muted-foreground w-10 shrink-0">
                ▲ {p.votes_count}
              </span>
              <span
                className={`flex-1 min-w-0 truncate text-sm ${p.hidden ? "line-through text-muted-foreground" : ""}`}
              >
                {p.title}
              </span>
              {p.hidden && (
                <span className="text-xs text-amber-600 shrink-0">{t("admin.mod.hidden")}</span>
              )}
              <span className="text-xs text-muted-foreground shrink-0">
                {t(`admin.status.${p.status}`)}
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

// ── Settings (external analytics) ────────────────────────────────────
function SettingsTab({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const fetchWs = useServerFn(getWorkspaceFn);
  const save = useServerFn(updateAnalyticsEmbedFn);
  const [embed, setEmbed] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchWs({ data: { slug } })
      .then((w) => w && setEmbed(w.analyticsEmbed ?? ""))
      .catch(() => {});
  }, [fetchWs, slug]);

  return (
    <div className="space-y-6 max-w-2xl">
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold mb-1">{t("admin.settings.externalTitle")}</h3>
        <p className="text-sm text-muted-foreground mb-3">{t("admin.settings.externalDesc")}</p>
        <textarea
          value={embed}
          onChange={(e) => {
            setEmbed(e.target.value);
            setSaved(false);
          }}
          rows={5}
          placeholder={t("admin.settings.externalPh")}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-mono"
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await save({ data: { slug, embed } });
                setSaved(true);
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-full bg-foreground text-background px-5 py-2 text-sm font-medium disabled:opacity-50"
          >
            {t("common.save")}
          </button>
          {saved && (
            <span className="text-xs text-green-600">
              {t("common.copied").replace("✓", "").trim()} ✓
            </span>
          )}
        </div>
      </section>
      <p className="text-xs text-muted-foreground">{t("admin.settings.retentionNote")}</p>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">{children}</main>
      <SiteFooter />
    </div>
  );
}
