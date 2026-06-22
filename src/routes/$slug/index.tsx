import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { useAuth } from "@/lib/auth-context";
import { useIsWorkspaceAdmin } from "@/lib/workspace-context";
import {
  listPostsFn,
  createPostFn,
  updatePostStatusFn,
  deletePostFn,
  findSimilarPostsFn,
} from "@/lib/posts.functions";
import { listMyVotesFn, toggleVoteFn } from "@/lib/votes.functions";
import { FeedbackChat } from "@/components/feedback-chat";

export const Route = createFileRoute("/$slug/")({
  head: () => ({
    meta: [
      { title: "Loops · Feedback board" },
      { name: "description", content: "Loops' live feedback board — vote, post new requests." },
      { property: "og:title", content: "Loops · Feedback board" },
      {
        property: "og:description",
        content: "Live board — anyone can read, signed-in users vote and post.",
      },
    ],
  }),
  component: BoardPage,
});

type Status = "planned" | "progress" | "done";
type Post = {
  id: string;
  title: string;
  description: string | null;
  tag: string | null;
  status: Status;
  votes_count: number;
  author_id: string | null;
  created_at: string;
};

function BoardPage() {
  const { slug } = Route.useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = useIsWorkspaceAdmin();
  const [posts, setPosts] = useState<Post[]>([]);
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [tab, setTab] = useState<"board" | "roadmap">("board");
  const [composerOpen, setComposerOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"top" | "new" | "old">("top");
  const [tagFilter, setTagFilter] = useState<string>("all");

  const refresh = async () => {
    const postsData = await listPostsFn({ data: { slug } });
    setPosts((postsData as Post[]) ?? []);
    // Works for guests too (server resolves a cookie identity).
    const votedIds = await listMyVotesFn({ data: { slug } });
    setVoted(new Set(votedIds));
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, slug]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => {
      if (p.tag) set.add(p.tag);
    });
    return Array.from(set).sort();
  }, [posts]);

  const filtered = useMemo(() => {
    let list = posts.filter((p) => filter === "all" || p.status === filter);
    if (tagFilter !== "all") list = list.filter((p) => p.tag === tagFilter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.description?.toLowerCase().includes(q) ?? false) ||
          (p.tag?.toLowerCase().includes(q) ?? false),
      );
    }
    const sorted = [...list];
    if (sort === "new") sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    else if (sort === "old")
      sorted.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    else
      sorted.sort(
        (a, b) =>
          b.votes_count - a.votes_count || +new Date(b.created_at) - +new Date(a.created_at),
      );
    return sorted;
  }, [posts, filter, tagFilter, query, sort]);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              {t("board.eyebrow")}
            </p>
            <h1 className="font-display text-4xl md:text-5xl font-medium tracking-tight">
              {t("board.title")}
            </h1>
            <p className="text-muted-foreground mt-2">
              {user ? t("board.subtitleAuthed") : t("board.subtitleAnon")}
            </p>
          </div>
          {user ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setChatOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-ai/40 bg-ai-soft/50 text-foreground px-4 py-2.5 text-sm font-medium hover:border-ai/60 transition-colors"
              >
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-ai text-background text-[9px] font-bold">
                  AI
                </span>
                {t("chat.openButton")}
              </button>
              <button
                onClick={() => setComposerOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:bg-foreground/90 transition-colors shadow-card"
              >
                {t("board.newFeedback")}
              </button>
            </div>
          ) : (
            <Link
              to="/auth"
              search={{ redirect: slug }}
              className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:bg-foreground/90 transition-colors shrink-0"
            >
              {t("board.signInToPost")}
            </Link>
          )}
        </div>

        <div className="flex items-center gap-1 mb-6 border-b border-border">
          {(["board", "roadmap"] as const).map((tk) => (
            <button
              key={tk}
              onClick={() => setTab(tk)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === tk
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(`board.tabs.${tk}`)}
            </button>
          ))}
        </div>

        {tab === "board" ? (
          <BoardView
            slug={slug}
            posts={filtered}
            allPosts={posts}
            voted={voted}
            filter={filter}
            setFilter={setFilter}
            loading={loading}
            isAdmin={isAdmin}
            isAuthed={!!user}
            onChange={refresh}
            query={query}
            setQuery={setQuery}
            sort={sort}
            setSort={setSort}
            tagFilter={tagFilter}
            setTagFilter={setTagFilter}
            allTags={allTags}
          />
        ) : (
          <RoadmapView posts={posts} />
        )}
      </div>

      {composerOpen && (
        <Composer
          slug={slug}
          onClose={() => setComposerOpen(false)}
          onCreated={() => {
            setComposerOpen(false);
            refresh();
          }}
        />
      )}

      {chatOpen && (
        <FeedbackChat
          slug={slug}
          onClose={() => setChatOpen(false)}
          onCreated={() => {
            setChatOpen(false);
            refresh();
          }}
        />
      )}

      <SiteFooter />
    </div>
  );
}

function BoardView({
  slug,
  posts,
  allPosts,
  voted,
  filter,
  setFilter,
  loading,
  isAdmin,
  isAuthed,
  onChange,
  query,
  setQuery,
  sort,
  setSort,
  tagFilter,
  setTagFilter,
  allTags,
}: {
  slug: string;
  posts: Post[];
  allPosts: Post[];
  voted: Set<string>;
  filter: "all" | Status;
  setFilter: (s: "all" | Status) => void;
  loading: boolean;
  isAdmin: boolean;
  isAuthed: boolean;
  onChange: () => void;
  query: string;
  setQuery: (q: string) => void;
  sort: "top" | "new" | "old";
  setSort: (s: "top" | "new" | "old") => void;
  tagFilter: string;
  setTagFilter: (s: string) => void;
  allTags: string[];
}) {
  const { t } = useTranslation();

  // Voting is open to everyone — guests vote via a server cookie identity.
  const toggleVote = async (post: Post) => {
    await toggleVoteFn({ data: { slug, postId: post.id } });
    onChange();
  };

  const changeStatus = async (post: Post, status: Status) => {
    await updatePostStatusFn({ data: { slug, id: post.id, status } });
    onChange();
  };

  const removePost = async (post: Post) => {
    if (!confirm(t("board.confirmDelete"))) return;
    await deletePostFn({ data: { slug, id: post.id } });
    onChange();
  };

  const filterKeys: Array<"all" | Status> = ["all", "planned", "progress", "done"];

  const filtersActive = !!query.trim() || tagFilter !== "all" || filter !== "all";

  return (
    <div className="grid lg:grid-cols-[1fr_240px] gap-8">
      <div>
        <div className="mb-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("boardSearch.searchPh")}
                className="w-full rounded-full border border-border bg-surface pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-border-strong"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "top" | "new" | "old")}
              className="rounded-full border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-border-strong cursor-pointer"
              aria-label={t("boardSearch.sort")}
            >
              <option value="top">{t("boardSearch.sortTop")}</option>
              <option value="new">{t("boardSearch.sortNew")}</option>
              <option value="old">{t("boardSearch.sortOld")}</option>
            </select>
            {allTags.length > 0 && (
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="rounded-full border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-border-strong cursor-pointer"
              >
                <option value="all">{t("boardSearch.tagAll")}</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            )}
            {filtersActive && (
              <button
                onClick={() => {
                  setQuery("");
                  setTagFilter("all");
                  setFilter("all");
                }}
                className="rounded-full border border-border bg-surface px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
              >
                {t("boardSearch.clear")}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {filterKeys.map((k) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === k
                    ? "bg-foreground text-background"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(`board.filters.${k}`)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-border bg-surface p-12 text-center text-muted-foreground">
            {t("common.loading")}
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
            <p className="text-muted-foreground">
              {filtersActive ? t("boardSearch.noResults") : t("board.empty.title")}
            </p>
            {!filtersActive && (
              <p className="text-sm text-muted-foreground mt-1">{t("board.empty.subtitle")}</p>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {posts.map((p) => (
              <PostRow
                key={p.id}
                slug={slug}
                post={p}
                voted={voted.has(p.id)}
                isAdmin={isAdmin}
                onVote={() => toggleVote(p)}
                onStatus={(s) => changeStatus(p, s)}
                onDelete={() => removePost(p)}
              />
            ))}
          </ul>
        )}
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
            {t("board.summary")}
          </p>
          <Stat label={t("board.stats.total")} value={posts.length} />
          <Stat
            label={t("board.stats.planned")}
            value={posts.filter((p) => p.status === "planned").length}
          />
          <Stat
            label={t("board.stats.progress")}
            value={posts.filter((p) => p.status === "progress").length}
          />
          <Stat
            label={t("board.stats.done")}
            value={posts.filter((p) => p.status === "done").length}
          />
        </div>
        {isAdmin && (
          <Link
            to="/$slug/insights"
            params={{ slug }}
            className="group block rounded-2xl border border-ai/30 bg-gradient-to-br from-ai-soft/60 to-surface p-4 hover:border-ai/50 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ai text-background text-[10px] font-bold">
                AI
              </span>
              <p className="text-sm font-medium">{t("board.insightsCard")}</p>
              <span
                className="ml-auto text-ai opacity-0 group-hover:opacity-100 transition-opacity"
                aria-hidden
              >
                →
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("board.insightsCardDesc", { count: allPosts.length })}
            </p>
          </Link>
        )}
      </aside>
    </div>
  );
}

function PostRow({
  slug,
  post,
  voted,
  isAdmin,
  onVote,
  onStatus,
  onDelete,
}: {
  slug: string;
  post: Post;
  voted: boolean;
  isAdmin: boolean;
  onVote: () => void;
  onStatus: (s: Status) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const statusColor: Record<Status, string> = {
    planned: "bg-status-planned",
    progress: "bg-status-progress",
    done: "bg-status-done",
  };
  return (
    <li className="group flex items-start gap-4 rounded-2xl border border-border bg-surface p-4 hover:border-border-strong transition-colors">
      <button
        onClick={onVote}
        className={`flex flex-col items-center justify-center min-w-[56px] rounded-xl px-3 py-2 transition-all ${
          voted
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-foreground hover:bg-primary-soft"
        }`}
        aria-label={voted ? t("board.voteRemove") : t("board.voteAdd")}
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
          <path d="M12 4l8 10H4z" fill="currentColor" />
        </svg>
        <span className="text-sm font-semibold tabular-nums mt-0.5">{post.votes_count}</span>
      </button>
      <div className="flex-1 min-w-0">
        <Link
          to="/$slug/posts/$id"
          params={{ slug, id: post.id }}
          className="font-medium hover:underline"
        >
          {post.title}
        </Link>
        {post.description && (
          <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">
            {post.description}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
          {post.tag && (
            <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-muted-foreground">
              {post.tag}
            </span>
          )}
          {isAdmin ? (
            <div className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5">
              <span className={`h-1.5 w-1.5 rounded-full ${statusColor[post.status]}`} />
              <select
                value={post.status}
                onChange={(e) => onStatus(e.target.value as Status)}
                className="bg-transparent text-muted-foreground hover:text-foreground focus:outline-none cursor-pointer"
              >
                <option value="planned">{t("board.filters.planned")}</option>
                <option value="progress">{t("board.filters.progress")}</option>
                <option value="done">{t("board.filters.done")}</option>
              </select>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className={`h-1.5 w-1.5 rounded-full ${statusColor[post.status]}`} />
              {t(`board.filters.${post.status}`)}
            </span>
          )}
          {isAdmin && (
            <button
              onClick={onDelete}
              className="ml-auto text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {t("common.delete")}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function RoadmapView({ posts }: { posts: Post[] }) {
  const { t } = useTranslation();
  const cols: { key: Status; color: string }[] = [
    { key: "planned", color: "bg-status-planned" },
    { key: "progress", color: "bg-status-progress" },
    { key: "done", color: "bg-status-done" },
  ];
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {cols.map((col) => {
        const list = posts.filter((p) => p.status === col.key);
        return (
          <div key={col.key} className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${col.color}`} />
                <span className="font-medium text-sm">{t(`board.roadmap.${col.key}`)}</span>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{list.length}</span>
            </div>
            <ul className="space-y-2">
              {list.map((p) => (
                <li key={p.id} className="rounded-xl border border-border bg-background p-3">
                  <p className="text-sm font-medium">{p.title}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="rounded bg-secondary px-1.5 py-0.5">{p.tag || "—"}</span>
                    <span className="tabular-nums">▲ {p.votes_count}</span>
                  </div>
                </li>
              ))}
              {list.length === 0 && (
                <li className="text-sm text-muted-foreground italic py-4 text-center">
                  {t("board.roadmap.emptyCol")}
                </li>
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

type SimilarHint = {
  id: string;
  title: string;
  votes_count: number;
  status: Status;
  score: number;
};

function Composer({
  slug,
  onClose,
  onCreated,
}: {
  slug: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tag, setTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [similar, setSimilar] = useState<SimilarHint[]>([]);
  const [votingId, setVotingId] = useState<string | null>(null);

  // Debounced duplicate-detection while typing the title (#1).
  useEffect(() => {
    const q = title.trim();
    if (q.length < 4) {
      setSimilar([]);
      return;
    }
    let cancelled = false;
    const tm = setTimeout(() => {
      findSimilarPostsFn({ data: { slug, query: q } })
        .then((rows) => {
          if (!cancelled) setSimilar((rows as SimilarHint[]) ?? []);
        })
        .catch(() => {
          if (!cancelled) setSimilar([]);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(tm);
    };
  }, [title, slug]);

  const voteExisting = async (postId: string) => {
    setVotingId(postId);
    try {
      await toggleVoteFn({ data: { slug, postId } });
      onCreated(); // closes the composer + refreshes the board
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setVotingId(null);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createPostFn({
        data: {
          slug,
          title: title.trim(),
          description: description.trim() || null,
          tag: tag.trim() || null,
        },
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-lg rounded-3xl border border-border bg-surface p-6 shadow-lifted"
      >
        <h2 className="font-display text-2xl font-medium tracking-tight">
          {t("board.composer.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t("board.composer.hint")}</p>

        <div className="mt-5 space-y-3">
          <Field label={t("board.composer.fields.title")}>
            <input
              required
              minLength={3}
              maxLength={140}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("board.composer.placeholders.title")}
              className="cmp-input"
              autoFocus
            />
          </Field>

          {similar.length > 0 && (
            <div className="rounded-xl border border-ai/30 bg-ai-soft/40 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-ai text-background text-[9px] font-bold">
                  AI
                </span>
                <p className="text-xs font-medium">{t("similar.heading")}</p>
              </div>
              <ul className="space-y-1.5">
                {similar.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-2 rounded-lg bg-background border border-border px-2.5 py-1.5"
                  >
                    <span className="flex-1 min-w-0 truncate text-sm">{s.title}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                      {Math.round(s.score * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => voteExisting(s.id)}
                      disabled={!!votingId}
                      className="shrink-0 inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-2.5 py-1 text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
                    >
                      ▲ {s.votes_count} · {votingId === s.id ? "…" : t("similar.vote")}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground mt-2">{t("similar.note")}</p>
            </div>
          )}

          <Field label={t("board.composer.fields.description")}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder={t("board.composer.placeholders.description")}
              className="cmp-input resize-none"
            />
          </Field>
          <Field label={t("board.composer.fields.tag")}>
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder={t("board.composer.placeholders.tag")}
              className="cmp-input"
              maxLength={40}
            />
          </Field>
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-foreground text-background px-4 py-2 text-sm font-medium hover:bg-foreground/90 disabled:opacity-50"
          >
            {busy ? t("board.composer.submitting") : t("board.composer.submit")}
          </button>
        </div>

        <style>{`
          .cmp-input {
            width: 100%;
            border-radius: 0.75rem;
            border: 1px solid var(--color-border-strong);
            background: var(--color-background);
            padding: 0.625rem 0.875rem;
            font-size: 0.875rem;
            outline: none;
            font-family: inherit;
          }
          .cmp-input:focus {
            border-color: var(--color-primary);
            box-shadow: 0 0 0 3px color-mix(in oklch, var(--color-primary) 18%, transparent);
          }
        `}</style>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground font-medium mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
