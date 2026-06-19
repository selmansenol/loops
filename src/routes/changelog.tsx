import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { listPostsFn } from "@/lib/posts.functions";

export const Route = createFileRoute("/changelog")({
  head: () => ({
    meta: [
      { title: "Loop · Changelog" },
      { name: "description", content: "All shipped features and updates in Loop." },
      { property: "og:title", content: "Loop · Changelog" },
      { property: "og:description", content: "What we've shipped, in order." },
    ],
  }),
  component: ChangelogPage,
});

type ShippedPost = {
  id: string;
  title: string;
  description: string | null;
  tag: string | null;
  votes_count: number;
  shipped_at: string | null;
};

function ChangelogPage() {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<ShippedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listPostsFn().then((data) => {
      const shipped = (data ?? [])
        .filter((p) => p.status === "done")
        .map<ShippedPost>((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          tag: p.tag,
          votes_count: p.votes_count,
          shipped_at: p.shipped_at,
        }))
        .sort((a, b) => {
          const ta = a.shipped_at ? +new Date(a.shipped_at) : 0;
          const tb = b.shipped_at ? +new Date(b.shipped_at) : 0;
          return tb - ta;
        });
      setItems(shipped);
      setLoading(false);
    });
  }, []);

  // group by month
  const groups: Record<string, ShippedPost[]> = {};
  items.forEach((p) => {
    const d = p.shipped_at ? new Date(p.shipped_at) : null;
    const key = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : "—";
    (groups[key] ||= []).push(p);
  });
  const keys = Object.keys(groups);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              {t("changelog.eyebrow")}
            </p>
            <h1 className="font-display text-4xl md:text-5xl font-medium tracking-tight">
              {t("changelog.title")}
            </h1>
            <p className="text-muted-foreground mt-2">{t("changelog.lead")}</p>
          </div>
          <Link
            to="/board"
            className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:bg-foreground/90 transition-colors shrink-0"
          >
            {t("changelog.suggest")}
          </Link>
        </div>

        {loading ? (
          <div className="text-muted-foreground text-center py-12">{t("common.loading")}</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center text-muted-foreground">
            {t("changelog.empty")}
          </div>
        ) : (
          <div className="space-y-10">
            {keys.map((k) => {
              const list = groups[k];
              const monthLabel =
                k === "—"
                  ? "—"
                  : new Date(`${k}-01T00:00:00Z`).toLocaleDateString(
                      i18n.language === "en" ? "en-US" : "tr-TR",
                      { year: "numeric", month: "long" },
                    );
              return (
                <div key={k}>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
                    {monthLabel}
                  </div>
                  <ul className="space-y-3">
                    {list.map((p) => {
                      const d = p.shipped_at
                        ? new Date(p.shipped_at).toLocaleDateString(
                            i18n.language === "en" ? "en-US" : "tr-TR",
                            { day: "numeric", month: "short" },
                          )
                        : "";
                      return (
                        <li key={p.id} className="rounded-2xl border border-border bg-surface p-5">
                          <div className="flex items-start gap-4">
                            <div className="text-xs text-muted-foreground tabular-nums min-w-[3rem] mt-0.5">
                              {d}
                            </div>
                            <div className="flex-1 min-w-0">
                              <Link
                                to="/posts/$id"
                                params={{ id: p.id }}
                                className="font-medium hover:underline"
                              >
                                {p.title}
                              </Link>
                              {p.description && (
                                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                                  {p.description}
                                </p>
                              )}
                              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                {p.tag && (
                                  <span className="rounded bg-secondary px-1.5 py-0.5">
                                    {p.tag}
                                  </span>
                                )}
                                <span className="tabular-nums">▲ {p.votes_count}</span>
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
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
