import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { listPostsFn } from "@/lib/posts.functions";
import { useIsWorkspaceAdmin } from "@/lib/workspace-context";
import { generateRoadmapFn, applyRoadmapFn, type RoadmapProposal } from "@/lib/roadmap.functions";

export const Route = createFileRoute("/$slug/roadmap")({
  head: () => ({
    meta: [
      { title: "Loops · Roadmap" },
      { name: "description", content: "What we're working on, planning and have shipped." },
      { property: "og:title", content: "Loops · Roadmap" },
      { property: "og:description", content: "Top-voted feedback by status." },
    ],
  }),
  component: RoadmapPage,
});

type Status = "planned" | "progress" | "done";
type Post = {
  id: string;
  title: string;
  tag: string | null;
  status: Status;
  votes_count: number;
};

function RoadmapPage() {
  const { slug } = Route.useParams();
  const { t } = useTranslation();
  const isAdmin = useIsWorkspaceAdmin();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    listPostsFn({ data: { slug } }).then((data) => {
      setPosts((data as Post[]) ?? []);
      setLoading(false);
    });
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const cols: { key: Status; color: string }[] = [
    { key: "planned", color: "bg-status-planned" },
    { key: "progress", color: "bg-status-progress" },
    { key: "done", color: "bg-status-done" },
  ];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              {t("roadmap.eyebrow")}
            </p>
            <h1 className="font-display text-4xl md:text-5xl font-medium tracking-tight">
              {t("roadmap.title")}
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">{t("roadmap.lead")}</p>
          </div>
          <Link
            to="/$slug"
            params={{ slug }}
            className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:bg-foreground/90 transition-colors shrink-0"
          >
            {t("roadmap.suggest")}
          </Link>
        </div>

        {isAdmin && <RoadmapGenerator slug={slug} onApplied={reload} />}

        {loading ? (
          <div className="text-muted-foreground text-center py-12">{t("common.loading")}</div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {cols.map((col) => {
              const list = posts.filter((p) => p.status === col.key);
              return (
                <div key={col.key} className="rounded-2xl border border-border bg-surface p-4">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${col.color}`} />
                      <span className="font-medium text-sm">{t(`roadmap.cols.${col.key}`)}</span>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {list.length}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {list.map((p) => (
                      <li key={p.id}>
                        <Link
                          to="/$slug/posts/$id"
                          params={{ slug, id: p.id }}
                          className="block rounded-xl border border-border bg-background p-3 hover:border-border-strong transition-colors"
                        >
                          <p className="text-sm font-medium">{p.title}</p>
                          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                            <span className="rounded bg-secondary px-1.5 py-0.5">
                              {p.tag || "—"}
                            </span>
                            <span className="tabular-nums">▲ {p.votes_count}</span>
                          </div>
                        </Link>
                      </li>
                    ))}
                    {list.length === 0 && (
                      <li className="text-sm text-muted-foreground italic py-4 text-center">
                        {t("roadmap.emptyCol")}
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}

const BUCKETS = [
  { key: "now", color: "bg-status-progress" },
  { key: "next", color: "bg-status-planned" },
  { key: "later", color: "bg-secondary" },
] as const;

function RoadmapGenerator({ slug, onApplied }: { slug: string; onApplied: () => void }) {
  const { t } = useTranslation();
  const generate = useServerFn(generateRoadmapFn);
  const apply = useServerFn(applyRoadmapFn);
  const [proposal, setProposal] = useState<RoadmapProposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const run = async () => {
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const result = await generate({ data: { slug } });
      setProposal(result as RoadmapProposal);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const m = msg.match(/^AI_ERR:(\w+)/);
      setError(m ? t(`aiErrors.${m[1]}`) : msg);
    } finally {
      setBusy(false);
    }
  };

  const applyProposal = async () => {
    if (!proposal) return;
    setApplying(true);
    setError(null);
    try {
      await apply({
        data: {
          slug,
          now: proposal.now.map((i) => i.id),
          next: proposal.next.map((i) => i.id),
          later: proposal.later.map((i) => i.id),
        },
      });
      setDone(true);
      onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="mb-8 rounded-2xl border border-ai/30 bg-gradient-to-br from-ai-soft/50 to-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ai text-background text-[10px] font-bold">
            AI
          </span>
          <div>
            <p className="text-sm font-medium">{t("roadmapAi.title")}</p>
            <p className="text-xs text-muted-foreground">{t("roadmapAi.lead")}</p>
          </div>
        </div>
        <button
          onClick={run}
          disabled={busy}
          className="rounded-full bg-foreground text-background px-4 py-2 text-sm font-medium hover:bg-foreground/90 disabled:opacity-50"
        >
          {busy ? t("roadmapAi.generating") : t("roadmapAi.generate")}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {proposal && (
        <div className="mt-4">
          {proposal.summary && (
            <p className="text-sm text-foreground/80 mb-3 italic">{proposal.summary}</p>
          )}
          <div className="grid md:grid-cols-3 gap-3">
            {BUCKETS.map((b) => {
              const items = proposal[b.key];
              return (
                <div key={b.key} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border">
                    <span className={`h-2 w-2 rounded-full ${b.color}`} />
                    <span className="font-medium text-sm">{t(`roadmapAi.buckets.${b.key}`)}</span>
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                      {items.length}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {items.map((i) => (
                      <li key={i.id} className="text-xs">
                        <p className="font-medium text-foreground">
                          {i.title} <span className="text-muted-foreground">▲{i.votes_count}</span>
                        </p>
                        <p className="text-muted-foreground">{i.reason}</p>
                      </li>
                    ))}
                    {items.length === 0 && (
                      <li className="text-xs text-muted-foreground italic">
                        {t("roadmapAi.emptyBucket")}
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            {done && <span className="text-xs text-status-done">{t("roadmapAi.applied")}</span>}
            <button
              onClick={applyProposal}
              disabled={applying}
              className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {applying ? t("roadmapAi.applying") : t("roadmapAi.apply")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
