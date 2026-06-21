import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { useAuth } from "@/lib/auth-context";
import { useIsWorkspaceAdmin } from "@/lib/workspace-context";
import { getPostFn, updatePostStatusFn } from "@/lib/posts.functions";
import { listMyVotesFn, toggleVoteFn } from "@/lib/votes.functions";
import {
  listCommentsFn,
  createCommentFn,
  deleteCommentFn,
  toggleOfficialFn,
} from "@/lib/comments.functions";
import { getProfilesFn } from "@/lib/profiles.functions";

export const Route = createFileRoute("/$slug/posts/$id")({
  head: () => ({
    meta: [
      { title: "Loops · Feedback" },
      { name: "description", content: "Loops feedback detail and discussion." },
    ],
  }),
  component: PostDetailPage,
});

type Status = "planned" | "progress" | "done";
type PostRow = {
  id: string;
  title: string;
  description: string | null;
  tag: string | null;
  status: Status;
  votes_count: number;
  author_id: string | null;
  created_at: string;
};
type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  is_official: boolean;
  created_at: string;
};
type Profile = { id: string; username: string | null; avatar_url: string | null };

function PostDetailPage() {
  const { slug, id } = Route.useParams();
  const { user } = useAuth();
  const isAdmin = useIsWorkspaceAdmin();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [post, setPost] = useState<PostRow | null>(null);
  const [voted, setVoted] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = async () => {
    const p = await getPostFn({ data: { slug, id } });
    if (!p) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setPost(p as PostRow);

    const list = ((await listCommentsFn({ data: { slug, postId: id } })) ?? []) as CommentRow[];
    setComments(list);

    const ids = Array.from(
      new Set(
        [(p as PostRow).author_id, ...list.map((c) => c.author_id)].filter(Boolean) as string[],
      ),
    );
    if (ids.length) {
      const profs = await getProfilesFn({ data: { ids } });
      const map: Record<string, Profile> = {};
      (profs ?? []).forEach((pr) => {
        map[pr.id] = pr as Profile;
      });
      setProfiles(map);
    }

    if (user) {
      const votedIds = await listMyVotesFn({ data: { slug } });
      setVoted(votedIds.includes(id));
    } else {
      setVoted(false);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, slug, user?.id]);

  const toggleVote = async () => {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    if (!post) return;
    await toggleVoteFn({ data: { slug, postId: post.id } });
    refresh();
  };

  const changeStatus = async (status: Status) => {
    if (!post) return;
    await updatePostStatusFn({ data: { slug, id: post.id, status } });
    refresh();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-3xl px-6 py-16 text-center text-muted-foreground">
          {t("common.loading")}
        </div>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-3xl px-6 py-16">
          <p className="text-muted-foreground">{t("post.notFound")}</p>
          <Link
            to="/$slug"
            params={{ slug }}
            className="text-primary hover:underline mt-4 inline-block"
          >
            {t("post.backToBoard")}
          </Link>
        </div>
      </div>
    );
  }

  const statusColor: Record<Status, string> = {
    planned: "bg-status-planned",
    progress: "bg-status-progress",
    done: "bg-status-done",
  };
  const authorName = post.author_id
    ? (profiles[post.author_id]?.username ?? t("comments.anonymous"))
    : t("comments.anonymous");
  const createdDate = new Date(post.created_at).toLocaleDateString(
    i18n.language === "en" ? "en-US" : "tr-TR",
    { year: "numeric", month: "long", day: "numeric" },
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link
          to="/$slug"
          params={{ slug }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {t("post.backToBoard")}
        </Link>

        <div className="mt-4 flex items-start gap-4 rounded-3xl border border-border bg-surface p-6">
          <button
            onClick={toggleVote}
            className={`flex flex-col items-center justify-center min-w-[64px] rounded-2xl px-3 py-3 transition-all ${
              voted
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground hover:bg-primary-soft"
            }`}
            aria-label={voted ? t("board.voteRemove") : t("board.voteAdd")}
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path d="M12 4l8 10H4z" fill="currentColor" />
            </svg>
            <span className="text-base font-semibold tabular-nums mt-1">{post.votes_count}</span>
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl md:text-3xl font-medium tracking-tight">
              {post.title}
            </h1>
            {post.description && (
              <p className="mt-2 text-foreground/80 whitespace-pre-wrap">{post.description}</p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {post.tag && <span className="rounded-md bg-secondary px-2 py-0.5">{post.tag}</span>}
              <span className="inline-flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${statusColor[post.status]}`} />
                {t(`board.filters.${post.status}`)}
              </span>
              <span>
                · {t("post.by")} <span className="text-foreground/80">{authorName}</span>{" "}
                {t("post.on")} {createdDate}
              </span>
              <button
                onClick={copyLink}
                className="ml-auto rounded-md border border-border px-2 py-1 hover:border-border-strong hover:text-foreground transition-colors"
              >
                {copied ? t("post.linkCopied") : t("post.shareLink")}
              </button>
            </div>

            {isAdmin && (
              <div className="mt-3 inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs">
                <span className="text-muted-foreground">{t("post.statusLabel")}:</span>
                <select
                  value={post.status}
                  onChange={(e) => changeStatus(e.target.value as Status)}
                  className="bg-transparent text-foreground focus:outline-none cursor-pointer"
                >
                  <option value="planned">{t("board.filters.planned")}</option>
                  <option value="progress">{t("board.filters.progress")}</option>
                  <option value="done">{t("board.filters.done")}</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <CommentsSection
          slug={slug}
          postId={post.id}
          comments={comments}
          profiles={profiles}
          user={user}
          isAdmin={isAdmin}
          onChange={refresh}
        />
      </div>

      <SiteFooter />
    </div>
  );
}

function CommentsSection({
  slug,
  postId,
  comments,
  profiles,
  user,
  isAdmin,
  onChange,
}: {
  slug: string;
  postId: string;
  comments: CommentRow[];
  profiles: Record<string, Profile>;
  user: ReturnType<typeof useAuth>["user"];
  isAdmin: boolean;
  onChange: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !body.trim()) return;
    setBusy(true);
    try {
      await createCommentFn({ data: { slug, postId, body: body.trim() } });
      setBody("");
      onChange();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(t("comments.confirmDelete"))) return;
    await deleteCommentFn({ data: { slug, id } });
    onChange();
  };

  const toggleOfficial = async (c: CommentRow) => {
    await toggleOfficialFn({ data: { slug, id: c.id, isOfficial: !c.is_official } });
    onChange();
  };

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-medium tracking-tight">{t("comments.title")}</h2>
        <span className="text-xs text-muted-foreground">
          {t("comments.count", { count: comments.length })}
        </span>
      </div>

      {user ? (
        <form onSubmit={submit} className="mt-4 rounded-2xl border border-border bg-surface p-3">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("comments.placeholder")}
            rows={3}
            maxLength={4000}
            className="w-full bg-transparent border-0 focus:outline-none resize-none text-sm"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="submit"
              disabled={busy || !body.trim()}
              className="rounded-xl bg-foreground text-background px-4 py-1.5 text-sm font-medium hover:bg-foreground/90 disabled:opacity-50"
            >
              {busy ? t("comments.submitting") : t("comments.submit")}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface p-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{t("comments.signInPrompt")}</p>
          <Link
            to="/auth"
            className="rounded-full bg-foreground text-background px-3 py-1.5 text-xs font-medium hover:bg-foreground/90"
          >
            {t("comments.signInCta")}
          </Link>
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {comments.length === 0 ? (
          <li className="text-sm text-muted-foreground italic py-4 text-center">
            {t("comments.empty")}
          </li>
        ) : (
          comments.map((c) => {
            const author = profiles[c.author_id];
            const name = author?.username ?? t("comments.anonymous");
            const date = new Date(c.created_at).toLocaleString(
              i18n.language === "en" ? "en-US" : "tr-TR",
              { dateStyle: "medium", timeStyle: "short" },
            );
            const canDelete = isAdmin || user?.id === c.author_id;
            return (
              <li
                key={c.id}
                className={`group rounded-2xl border p-4 ${c.is_official ? "border-ai/40 bg-ai-soft/40" : "border-border bg-surface"}`}
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-foreground">{name}</span>
                  {c.is_official && (
                    <span className="rounded-full bg-ai text-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                      {t("comments.official")}
                    </span>
                  )}
                  <span className="text-muted-foreground">· {date}</span>
                  <div className="ml-auto flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isAdmin && (
                      <button
                        onClick={() => toggleOfficial(c)}
                        className="text-xs text-muted-foreground hover:text-ai"
                      >
                        {c.is_official ? t("comments.unmarkOfficial") : t("comments.markOfficial")}
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => remove(c.id)}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        {t("comments.delete")}
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-sm text-foreground/90 whitespace-pre-wrap">{c.body}</p>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
