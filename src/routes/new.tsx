import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { useAuth } from "@/lib/auth-context";
import {
  checkSlugFn,
  createWorkspaceFn,
  getAppModeFn,
  listMyWorkspacesFn,
} from "@/lib/workspace.functions";

export const Route = createFileRoute("/new")({
  ssr: false,
  head: () => ({ meta: [{ title: "Loops · New board" }] }),
  component: NewWorkspacePage,
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

type SlugState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok" }
  | { status: "taken"; reason: string };

function NewWorkspacePage() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugState, setSlugState] = useState<SlugState>({ status: "idle" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Free-tier usage: how many boards the user owns vs the allowed max.
  const [limit, setLimit] = useState<number | null>(null);
  const [owned, setOwned] = useState<number | null>(null);
  const atLimit = limit !== null && owned !== null && owned >= limit;

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([getAppModeFn(), listMyWorkspacesFn()])
      .then(([m, ws]) => {
        setLimit(m.maxBoards);
        setOwned((ws as Array<{ role: string }>).filter((w) => w.role === "owner").length);
      })
      .catch(() => {});
  }, [user]);

  // Keep slug in sync with the name until the user edits it directly.
  useEffect(() => {
    if (!slugEdited) setSlug(slugify(name));
  }, [name, slugEdited]);

  // Debounced availability check.
  useEffect(() => {
    const s = slug.trim();
    if (s.length < 2) {
      setSlugState({ status: "idle" });
      return;
    }
    setSlugState({ status: "checking" });
    let cancelled = false;
    const tm = setTimeout(() => {
      checkSlugFn({ data: { slug: s } })
        .then((r) => {
          if (cancelled) return;
          if (r.available) setSlugState({ status: "ok" });
          else setSlugState({ status: "taken", reason: r.reason ?? "taken" });
        })
        .catch(() => {
          if (!cancelled) setSlugState({ status: "idle" });
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(tm);
    };
  }, [slug]);

  const canSubmit =
    name.trim().length >= 2 &&
    slug.trim().length >= 2 &&
    slugState.status === "ok" &&
    !busy &&
    !atLimit;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const { slug: created } = await createWorkspaceFn({
        data: { name: name.trim(), slug: slug.trim() },
      });
      // Land on AI settings so the owner can add their key right away.
      navigate({ to: "/$slug/settings/ai", params: { slug: created } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        msg.startsWith("BOARD_LIMIT") ? t("newWs.limitReached", { count: limit ?? 0 }) : msg,
      );
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-xl px-6 py-12">
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          ← {t("nav.dashboard")}
        </Link>
        <h1 className="font-display text-4xl font-medium tracking-tight mt-4">
          {t("newWs.title")}
        </h1>
        <p className="text-muted-foreground mt-2 mb-4">{t("newWs.lead")}</p>

        {limit !== null && owned !== null && (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
              atLimit
                ? "border-destructive/30 bg-destructive/5 text-destructive"
                : "border-border bg-surface text-muted-foreground"
            }`}
          >
            {atLimit
              ? t("newWs.limitReached", { count: limit })
              : t("newWs.usage", { used: owned, max: limit })}
          </div>
        )}

        <form
          onSubmit={submit}
          className="rounded-3xl border border-border bg-surface p-6 space-y-5"
        >
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("newWs.nameLabel")}
            </span>
            <input
              required
              minLength={2}
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("newWs.namePh")}
              className="mt-1 w-full rounded-xl border border-border-strong bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              autoFocus
            />
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("newWs.slugLabel")}
            </span>
            <div className="mt-1 flex items-center rounded-xl border border-border-strong bg-background px-3 py-2 focus-within:border-primary">
              <span className="text-sm text-muted-foreground font-mono select-none">
                getloops.co/
              </span>
              <input
                required
                minLength={2}
                maxLength={40}
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(slugify(e.target.value));
                }}
                placeholder="acme"
                className="flex-1 bg-transparent text-sm font-mono focus:outline-none"
              />
            </div>
            <p className="mt-1.5 text-xs min-h-[1rem]">
              {slugState.status === "checking" && (
                <span className="text-muted-foreground">{t("newWs.slugChecking")}</span>
              )}
              {slugState.status === "ok" && (
                <span className="text-status-done">{t("newWs.slugAvailable")}</span>
              )}
              {slugState.status === "taken" && (
                <span className="text-destructive">
                  {t(`newWs.slugReason.${slugState.reason}`, t("newWs.slugTaken"))}
                </span>
              )}
            </p>
          </label>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-xl bg-foreground text-background py-2.5 text-sm font-medium hover:bg-foreground/90 disabled:opacity-50"
          >
            {busy ? t("common.creating") : t("newWs.submit")}
          </button>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
