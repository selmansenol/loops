import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { useAuth } from "@/lib/auth-context";
import { listPostsFn } from "@/lib/posts.functions";
import {
  analyzeFeedback,
  applyClusterTag,
  mergeClusterPosts,
  type AnalyzeResult,
} from "@/lib/ai-analyze.functions";

export const Route = createFileRoute("/insights")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Loops · AI Insights" },
      { name: "description", content: "Cluster, summarize and prioritize feedback with AI." },
    ],
  }),
  component: InsightsPage,
});

type PostLite = {
  id: string;
  title: string;
  description: string | null;
  status: "planned" | "progress" | "done";
  tag: string | null;
  votes_count: number;
};

type Cluster = AnalyzeResult["clusters"][number];
type CachedResult = { result: AnalyzeResult; at: number };

const CACHE_KEY = "loop_insights_last_run_v1";

function loadCached(): CachedResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedResult;
  } catch {
    return null;
  }
}

function saveCached(result: AnalyzeResult) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ result, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

function clearCached() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

function formatRelative(ts: number, lang: string): string {
  const diffMs = Date.now() - ts;
  const sec = Math.round(diffMs / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  const rtf = new Intl.RelativeTimeFormat(lang.startsWith("en") ? "en" : "tr", { numeric: "auto" });
  if (sec < 60) return rtf.format(-sec, "second");
  if (min < 60) return rtf.format(-min, "minute");
  if (hr < 24) return rtf.format(-hr, "hour");
  return rtf.format(-day, "day");
}

function InsightsPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const runAnalyze = useServerFn(analyzeFeedback);
  const runApplyTag = useServerFn(applyClusterTag);
  const runMerge = useServerFn(mergeClusterPosts);

  const [posts, setPosts] = useState<PostLite[]>([]);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [resultAt, setResultAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const postIndex = useMemo(() => new Map(posts.map((p) => [p.id, p])), [posts]);

  const refreshPosts = async () => {
    const data = await listPostsFn();
    setPosts((data as PostLite[]) ?? []);
  };

  useEffect(() => {
    refreshPosts();
    const cached = loadCached();
    if (cached) {
      setResult(cached.result);
      setResultAt(cached.at);
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const tm = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(tm);
  }, [toast]);

  const analyze = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await runAnalyze();
      setResult(r);
      const now = Date.now();
      setResultAt(now);
      saveCached(r);
    } catch (e) {
      const err = e as Error & { code?: string };
      const msg = err.message ?? String(e);
      if (
        err.code === "NO_AI_PROVIDER" ||
        msg.includes("NO_AI_PROVIDER") ||
        msg.includes("No AI provider")
      ) {
        setError(t("insights.errors.noProvider"));
      } else if (msg.includes("429")) setError(t("insights.errors.rateLimit"));
      else if (msg.includes("402")) setError(t("insights.errors.credit"));
      else setError(msg);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-5xl px-6 py-20 text-muted-foreground">
          {t("common.loading")}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <h1 className="font-display text-3xl font-medium tracking-tight mb-3">
            {t("insights.signedOut.title")}
          </h1>
          <p className="text-muted-foreground mb-6">{t("insights.signedOut.desc")}</p>
          <button
            onClick={() => navigate({ to: "/auth" })}
            className="rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:bg-foreground/90"
          >
            {t("insights.signedOut.cta")}
          </button>
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-ai-soft text-ai font-bold mb-4">
            AI
          </div>
          <h1 className="font-display text-3xl font-medium tracking-tight mb-3">
            {t("insights.adminOnly.title")}
          </h1>
          <p className="text-muted-foreground mb-6">{t("insights.adminOnly.desc")}</p>
          <Link
            to="/board"
            className="rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:bg-foreground/90"
          >
            {t("insights.adminOnly.back")}
          </Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 mb-6">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-ai mb-2 font-medium">
              {t("insights.eyebrow")}
            </p>
            <h1 className="font-display text-4xl md:text-5xl font-medium tracking-tight">
              {t("insights.title")}
            </h1>
            <p className="text-muted-foreground mt-2">
              {t("insights.subtitle", { count: posts.length })}
            </p>
          </div>
          <button
            onClick={analyze}
            disabled={busy || posts.length === 0}
            className="shrink-0 inline-flex items-center gap-2 rounded-full bg-ai text-background px-5 py-2.5 text-sm font-medium hover:bg-ai/90 disabled:opacity-50 transition-colors shadow-card"
          >
            {busy ? (
              <>
                <span className="inline-block h-3 w-3 rounded-full bg-background/40 animate-pulse" />
                {t("insights.analyzing")}
              </>
            ) : result ? (
              t("insights.rerun")
            ) : (
              t("insights.analyze")
            )}
          </button>
        </div>

        {result && resultAt && !busy && (
          <p className="text-xs text-muted-foreground mb-4">
            {t("insights.cachedNotice", { when: formatRelative(resultAt, i18n.language) })}
          </p>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!result && !error && !busy && (
          <EmptyState onAnalyze={analyze} disabled={posts.length === 0} />
        )}

        {busy && !result && <LoadingSkeleton />}

        {result && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-ai/20 bg-gradient-to-br from-ai-soft/40 to-surface p-6">
              <p className="text-xs uppercase tracking-widest text-ai mb-2 font-medium">
                {t("insights.overall")}
              </p>
              <p className="text-lg leading-relaxed">{result.overall_insight}</p>
            </div>

            <ul className="space-y-4">
              {result.clusters.map((cluster, i) => (
                <ClusterCard
                  key={i}
                  cluster={cluster}
                  postIndex={postIndex}
                  actionBusy={actionBusy}
                  onApplyTag={async () => {
                    setActionBusy(`tag-${i}`);
                    try {
                      const res = await runApplyTag({
                        data: { post_ids: cluster.post_ids, tag: cluster.suggested_tag },
                      });
                      setToast(
                        t("insights.toast.tagApplied", {
                          count: res.updated,
                          tag: cluster.suggested_tag,
                        }),
                      );
                      await refreshPosts();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : String(e));
                    } finally {
                      setActionBusy(null);
                    }
                  }}
                  onMerge={async () => {
                    if (!confirm(t("insights.confirmMerge", { count: cluster.post_ids.length })))
                      return;
                    setActionBusy(`merge-${i}`);
                    try {
                      const res = await runMerge({
                        data: {
                          post_ids: cluster.post_ids,
                          title: cluster.theme,
                          description: cluster.summary,
                          tag: cluster.suggested_tag,
                        },
                      });
                      setToast(
                        t("insights.toast.merged", {
                          count: cluster.post_ids.length,
                          votes: res.transferred_votes,
                        }),
                      );
                      // birleşme sonrası küme post_id'leri artık geçersiz — önbelleği temizle
                      setResult(null);
                      setResultAt(null);
                      clearCached();
                      await refreshPosts();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : String(e));
                    } finally {
                      setActionBusy(null);
                    }
                  }}
                />
              ))}
            </ul>

            <p className="text-xs text-muted-foreground text-center">
              {t("insights.cachedFooter")}
            </p>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-foreground text-background px-5 py-2.5 text-sm shadow-lifted">
          {toast}
        </div>
      )}

      <SiteFooter />
    </div>
  );
}

function ClusterCard({
  cluster,
  postIndex,
  actionBusy,
  onApplyTag,
  onMerge,
}: {
  cluster: Cluster;
  postIndex: Map<string, PostLite>;
  actionBusy: string | null;
  onApplyTag: () => void;
  onMerge: () => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const members = cluster.post_ids.map((id) => postIndex.get(id)).filter((p): p is PostLite => !!p);
  const totalVotes = members.reduce((sum, m) => sum + m.votes_count, 0);
  const visible = expanded ? members : members.slice(0, 3);
  const tagBusy = actionBusy?.startsWith("tag-");
  const mergeBusy = actionBusy?.startsWith("merge-");

  const priorityStyles: Record<Cluster["priority"], string> = {
    high: "bg-destructive/10 text-destructive border-destructive/20",
    medium: "bg-ai-soft text-ai border-ai/30",
    low: "bg-secondary text-muted-foreground border-border",
  };
  const priorityLabel = t(`insights.priority.${cluster.priority}`) + t("insights.priority.suffix");

  return (
    <li className="rounded-3xl border border-border bg-surface p-6 hover:border-border-strong transition-colors">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 mb-3">
        <div className="min-w-0">
          <h3 className="font-display text-xl font-medium tracking-tight">{cluster.theme}</h3>
          <p className="text-sm text-muted-foreground mt-1">{cluster.summary}</p>
        </div>
        <span
          className={`shrink-0 self-start inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${priorityStyles[cluster.priority]}`}
        >
          {priorityLabel}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
        <span className="inline-flex items-center rounded-md bg-ai-soft text-ai px-2 py-0.5 font-medium">
          #{cluster.suggested_tag}
        </span>
        <span className="text-muted-foreground">
          {t("insights.feedbackCount", { count: members.length, votes: totalVotes })}
        </span>
        <span className="text-muted-foreground italic ml-auto">{cluster.priority_reason}</span>
      </div>

      {members.length > 0 && (
        <ul className="space-y-1.5 mb-4">
          {visible.map((m) => (
            <li key={m.id} className="text-sm flex items-center gap-2 min-w-0">
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground w-8 text-right">
                ▲{m.votes_count}
              </span>
              <span className="truncate">{m.title}</span>
              {m.tag && (
                <span className="shrink-0 text-[10px] rounded bg-secondary text-muted-foreground px-1.5 py-0.5">
                  {m.tag}
                </span>
              )}
            </li>
          ))}
          {members.length > 3 && (
            <li>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-xs text-muted-foreground hover:text-foreground italic"
              >
                {expanded
                  ? t("insights.collapse")
                  : t("insights.expand", { count: members.length - 3 })}
              </button>
            </li>
          )}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border">
        <button
          onClick={onApplyTag}
          disabled={!!actionBusy}
          className="rounded-full bg-secondary text-foreground px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50 transition-colors"
        >
          {tagBusy
            ? t("insights.applyingTag")
            : t("insights.applyTag", { tag: cluster.suggested_tag })}
        </button>
        {members.length >= 2 && (
          <button
            onClick={onMerge}
            disabled={!!actionBusy}
            className="rounded-full bg-foreground text-background px-3 py-1.5 text-xs font-medium hover:bg-foreground/90 disabled:opacity-50 transition-colors"
          >
            {mergeBusy ? t("insights.merging") : t("insights.merge", { count: members.length })}
          </button>
        )}
      </div>
    </li>
  );
}

function EmptyState({ onAnalyze, disabled }: { onAnalyze: () => void; disabled: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-3xl border border-dashed border-border bg-surface p-12 text-center">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-ai-soft text-ai text-xl font-bold mb-4">
        AI
      </div>
      <h2 className="font-display text-2xl font-medium tracking-tight mb-2">
        {disabled ? t("insights.empty.noPosts") : t("insights.empty.withPosts")}
      </h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
        {disabled ? t("insights.empty.descWithout") : t("insights.empty.descWith")}
      </p>
      {!disabled && (
        <button
          onClick={onAnalyze}
          className="rounded-full bg-ai text-background px-5 py-2.5 text-sm font-medium hover:bg-ai/90"
        >
          {t("insights.empty.cta")}
        </button>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-3xl border border-border bg-surface p-6">
          <div className="h-5 w-2/3 bg-muted rounded animate-pulse mb-2" />
          <div className="h-4 w-full bg-muted rounded animate-pulse mb-1" />
          <div className="h-4 w-4/5 bg-muted rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}
