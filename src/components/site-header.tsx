import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace, useIsWorkspaceAdmin } from "@/lib/workspace-context";
import { getAppModeFn } from "@/lib/workspace.functions";
import { applyClientLanguage, LOCALES } from "@/lib/i18n";

export const GITHUB_URL = "https://github.com/selmansenol/loops";
export const SPONSOR_URL = "https://github.com/sponsors/selmansenol";

function HeartIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 21s-7.5-4.6-10-9.2C.6 9 1.4 5.7 4.3 4.7c1.9-.7 3.9.1 4.9 1.7L12 9l2.8-2.6c1-1.6 3-2.4 4.9-1.7 2.9 1 3.7 4.3 2.3 7.1C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

export function SiteHeader() {
  const { user, loading, signOut } = useAuth();
  const ws = useWorkspace();
  const isAdmin = useIsWorkspaceAdmin();
  const router = useRouter();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [feedbackSlug, setFeedbackSlug] = useState<string | null>(null);

  useEffect(() => {
    applyClientLanguage();
    setMounted(true);
    getAppModeFn()
      .then((m) => setFeedbackSlug(m.feedbackSlug))
      .catch(() => {});
  }, []);

  const handleSignOut = async () => {
    await signOut();
    await router.invalidate();
  };

  const slug = ws?.slug;

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border">
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <LoopMark />
          <span className="font-display text-xl font-semibold tracking-tight">Loops</span>
          {ws && (
            <span className="hidden sm:inline text-sm text-muted-foreground border-l border-border pl-2 ml-1 max-w-[12rem] truncate">
              {ws.name}
            </span>
          )}
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
          {slug ? (
            <>
              <NavItem to="/$slug" params={{ slug }} exact label={t("nav.board")} />
              <NavItem to="/$slug/roadmap" params={{ slug }} label={t("roadmap.eyebrow")} />
              <NavItem to="/$slug/changelog" params={{ slug }} label={t("changelog.eyebrow")} />
              {mounted && isAdmin && (
                <>
                  <NavItem to="/$slug/admin" params={{ slug }} label={t("nav.admin")} />
                  <NavItem
                    to="/$slug/insights"
                    params={{ slug }}
                    label={t("nav.insights")}
                    accent="ai"
                  />
                  <SettingsMenu slug={slug} />
                </>
              )}
            </>
          ) : (
            mounted && user && <NavItem to="/dashboard" label={t("nav.dashboard")} />
          )}
          {!slug && feedbackSlug && (
            <NavItem to="/$slug" params={{ slug: feedbackSlug }} label={t("footer.feedback")} />
          )}
          <NavItem to="/docs" label={t("nav.docs")} />
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-full hover:text-foreground hover:bg-accent transition-colors"
          >
            {t("nav.github")}
          </a>
          <a
            href={SPONSOR_URL}
            target="_blank"
            rel="noreferrer"
            className="ml-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#EA4AAA]/40 text-[#EA4AAA] hover:bg-[#EA4AAA]/10 transition-colors"
          >
            <HeartIcon />
            {t("nav.sponsor")}
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <LanguageMenu mounted={mounted} />
          {loading ? (
            <div className="h-8 w-20 rounded-full bg-muted animate-pulse" />
          ) : user ? (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-xs text-muted-foreground">
                {user.name || user.email?.split("@")[0]}
              </span>
              <button
                onClick={handleSignOut}
                className="hidden md:inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                {t("nav.signOut")}
              </button>
            </div>
          ) : (
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-4 py-2 text-sm font-medium hover:bg-foreground/90 transition-colors"
            >
              {t("nav.signIn")}
              <span aria-hidden>→</span>
            </Link>
          )}
          <MobileNav
            slug={slug}
            isAdmin={isAdmin}
            hasUser={!!user}
            feedbackSlug={feedbackSlug}
            mounted={mounted}
            onSignOut={handleSignOut}
          />
        </div>
      </div>
    </header>
  );
}

function MobileNav({
  slug,
  isAdmin,
  hasUser,
  feedbackSlug,
  mounted,
  onSignOut,
}: {
  slug?: string;
  isAdmin: boolean;
  hasUser: boolean;
  feedbackSlug: string | null;
  mounted: boolean;
  onSignOut: () => void;
}) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  // Close when the route changes or Escape is pressed.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const item = "block rounded-xl px-4 py-3 text-base text-foreground hover:bg-accent";

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-foreground hover:bg-accent transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
          {open ? (
            <path
              d="M6 6l12 12M18 6 6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}
        </svg>
      </button>
      {open && (
        <>
          <div
            className="fixed inset-x-0 bottom-0 top-16 z-40 bg-foreground/20"
            onClick={close}
            aria-hidden
          />
          <div
            role="menu"
            className="fixed inset-x-0 top-16 z-50 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-border bg-background shadow-lifted"
          >
            <nav className="mx-auto max-w-6xl px-4 py-3 space-y-0.5">
              {slug ? (
                <>
                  <Link to="/$slug" params={{ slug }} className={item} onClick={close}>
                    {t("nav.board")}
                  </Link>
                  <Link to="/$slug/roadmap" params={{ slug }} className={item} onClick={close}>
                    {t("roadmap.eyebrow")}
                  </Link>
                  <Link to="/$slug/changelog" params={{ slug }} className={item} onClick={close}>
                    {t("changelog.eyebrow")}
                  </Link>
                  {mounted && isAdmin && (
                    <>
                      <Link to="/$slug/admin" params={{ slug }} className={item} onClick={close}>
                        {t("nav.admin")}
                      </Link>
                      <Link to="/$slug/insights" params={{ slug }} className={item} onClick={close}>
                        {t("nav.insights")}
                      </Link>
                      <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("nav.settings")}
                      </div>
                      <Link
                        to="/$slug/settings/share"
                        params={{ slug }}
                        className={item}
                        onClick={close}
                      >
                        {t("nav.share")}
                      </Link>
                      <Link
                        to="/$slug/settings/ai"
                        params={{ slug }}
                        className={item}
                        onClick={close}
                      >
                        {t("nav.ai")}
                      </Link>
                      <Link
                        to="/$slug/settings/api-keys"
                        params={{ slug }}
                        className={item}
                        onClick={close}
                      >
                        {t("nav.api")}
                      </Link>
                      <Link
                        to="/$slug/settings/webhooks"
                        params={{ slug }}
                        className={item}
                        onClick={close}
                      >
                        {t("nav.webhooks")}
                      </Link>
                    </>
                  )}
                </>
              ) : (
                mounted &&
                hasUser && (
                  <Link to="/dashboard" className={item} onClick={close}>
                    {t("nav.dashboard")}
                  </Link>
                )
              )}
              {!slug && feedbackSlug && (
                <Link to="/$slug" params={{ slug: feedbackSlug }} className={item} onClick={close}>
                  {t("footer.feedback")}
                </Link>
              )}
              <Link to="/docs" className={item} onClick={close}>
                {t("nav.docs")}
              </Link>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className={item}
                onClick={close}
              >
                {t("nav.github")}
              </a>
              <a
                href={SPONSOR_URL}
                target="_blank"
                rel="noreferrer"
                className={`${item} inline-flex items-center gap-1.5 text-[#EA4AAA]`}
                onClick={close}
              >
                <HeartIcon />
                {t("nav.sponsor")}
              </a>
              {mounted && hasUser && (
                <button
                  onClick={() => {
                    close();
                    onSignOut();
                  }}
                  className={`${item} w-full text-start text-muted-foreground`}
                >
                  {t("nav.signOut")}
                </button>
              )}
            </nav>
          </div>
        </>
      )}
    </div>
  );
}

function LanguageMenu({ mounted }: { mounted: boolean }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = (mounted ? i18n.language || "en" : "en").split("-")[0];
  const currentMeta = LOCALES.find((l) => l.code === current) ?? LOCALES[0];

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (code: string) => {
    try {
      localStorage.setItem("loop_lang", code);
    } catch {
      /* ignore */
    }
    i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Language"
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-3.5 w-3.5"
          aria-hidden
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
        {currentMeta.code.toUpperCase()}
        <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 opacity-60" aria-hidden>
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-2 max-h-[70vh] w-56 overflow-y-auto overscroll-contain rounded-2xl border border-border bg-surface p-1.5 shadow-lifted z-50"
        >
          {LOCALES.map((l) => {
            const active = l.code === current;
            return (
              <button
                key={l.code}
                role="option"
                aria-selected={active}
                onClick={() => choose(l.code)}
                dir={l.dir}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <span className="flex-1 truncate text-start">{l.label}</span>
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {l.code}
                </span>
                {active && <span className="shrink-0 text-primary">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SettingsMenu({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = pathname.startsWith(`/${slug}/settings`);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemClass =
    "block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground";
  const base = "px-3 py-1.5 rounded-full transition-colors text-sm inline-flex items-center gap-1";
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${base} ${
          isActive
            ? "bg-foreground text-background font-medium shadow-soft"
            : "text-muted-foreground hover:text-foreground hover:bg-accent"
        }`}
      >
        {t("nav.settings")}
        <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 opacity-60" aria-hidden>
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-44 rounded-2xl border border-border bg-surface p-1.5 shadow-lifted z-50"
        >
          <Link
            to="/$slug/settings/share"
            params={{ slug }}
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            {t("nav.share")}
          </Link>
          <Link
            to="/$slug/settings/ai"
            params={{ slug }}
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            {t("nav.ai")}
          </Link>
          <Link
            to="/$slug/settings/api-keys"
            params={{ slug }}
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            {t("nav.api")}
          </Link>
          <Link
            to="/$slug/settings/webhooks"
            params={{ slug }}
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            {t("nav.webhooks")}
          </Link>
        </div>
      )}
    </div>
  );
}

function NavItem({
  to,
  params,
  label,
  accent,
  exact,
}: {
  to: string;
  params?: Record<string, string>;
  label: string;
  accent?: "ai";
  exact?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Resolve `$slug`-style segments against params so active detection works.
  const resolved = params
    ? Object.entries(params).reduce((p, [k, v]) => p.replace(`$${k}`, v), to)
    : to;
  const isActive =
    resolved === "/"
      ? pathname === "/"
      : exact
        ? pathname === resolved
        : pathname === resolved || pathname.startsWith(resolved + "/");
  const base = "px-3 py-1.5 rounded-full transition-colors text-sm";
  if (isActive) {
    return (
      <Link
        to={to}
        params={params}
        aria-current="page"
        className={`${base} bg-foreground text-background font-medium shadow-soft`}
      >
        {label}
      </Link>
    );
  }
  const idle =
    accent === "ai"
      ? "text-ai/80 hover:text-ai hover:bg-ai-soft"
      : "text-muted-foreground hover:text-foreground hover:bg-accent";
  return (
    <Link to={to} params={params} className={`${base} ${idle}`}>
      {label}
    </Link>
  );
}

export function LoopMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-8 w-8 items-center justify-center rounded-xl bg-foreground text-background font-display font-semibold ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
        <path
          d="M7 12a5 5 0 0 1 5-5h0a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5H7"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="7" cy="17" r="1.5" fill="currentColor" />
      </svg>
    </span>
  );
}

export function SiteFooter() {
  const { t } = useTranslation();
  // getloops.co dogfoods Loops — link to our own public feedback board.
  const [feedbackSlug, setFeedbackSlug] = useState<string | null>(null);
  useEffect(() => {
    getAppModeFn()
      .then((m) => setFeedbackSlug(m.feedbackSlug))
      .catch(() => {});
  }, []);
  return (
    <footer className="border-t border-border mt-32">
      <div className="mx-auto max-w-6xl px-6 py-12 flex flex-col md:flex-row gap-6 md:items-center md:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <LoopMark />
          <span className="font-display text-lg font-semibold">Loops</span>
          <span className="hidden sm:inline text-sm text-muted-foreground ml-2 truncate">
            {t("footer.tagline")}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
          {feedbackSlug && (
            <Link to="/$slug" params={{ slug: feedbackSlug }} className="hover:text-foreground">
              {t("footer.feedback")}
            </Link>
          )}
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-foreground">
            {t("nav.github")}
          </a>
          <Link to="/docs" className="hover:text-foreground">
            {t("nav.docs")}
          </Link>
          <Link to="/terms" className="hover:text-foreground">
            {t("footer.terms")}
          </Link>
          <Link to="/privacy" className="hover:text-foreground">
            {t("footer.privacy")}
          </Link>
          <a
            href={SPONSOR_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[#EA4AAA] hover:opacity-80"
          >
            <HeartIcon />
            {t("nav.sponsor")}
          </a>
        </div>
      </div>
    </footer>
  );
}
