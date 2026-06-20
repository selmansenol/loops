import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { applyClientLanguage } from "@/lib/i18n";

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
  const { user, isAdmin, loading, signOut } = useAuth();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    applyClientLanguage();
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    await router.invalidate();
  };

  const toggleLang = () => {
    const next = i18n.language?.startsWith("en") ? "tr" : "en";
    try {
      localStorage.setItem("loop_lang", next);
    } catch {
      /* ignore */
    }
    i18n.changeLanguage(next);
  };

  const currentLang = mounted && i18n.language?.startsWith("en") ? "EN" : "TR";

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border">
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <LoopMark />
          <span className="font-display text-xl font-semibold tracking-tight">Loops</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
          <NavItem to="/board" label={t("nav.board")} />
          <NavItem to="/roadmap" label={t("roadmap.eyebrow")} />
          <NavItem to="/changelog" label={t("changelog.eyebrow")} />
          {mounted && isAdmin && (
            <>
              <NavItem to="/insights" label={t("nav.insights")} accent="ai" />
              <NavItem to="/settings/ai" label={t("nav.ai")} />
              <NavItem to="/settings/api-keys" label={t("nav.api")} />
              <NavItem to="/settings/webhooks" label={t("nav.webhooks")} />
            </>
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
          <button
            onClick={toggleLang}
            aria-label="Toggle language"
            title={currentLang === "TR" ? "Switch to English" : "Türkçe'ye geç"}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-3 w-3"
              aria-hidden
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
            </svg>
            {currentLang}
          </button>
          {loading ? (
            <div className="h-8 w-20 rounded-full bg-muted animate-pulse" />
          ) : user ? (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-xs text-muted-foreground">
                {user.email?.split("@")[0]}
              </span>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
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
        </div>
      </div>
    </header>
  );
}

function NavItem({ to, label, accent }: { to: string; label: string; accent?: "ai" }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");
  const base = "px-3 py-1.5 rounded-full transition-colors text-sm";
  if (isActive) {
    return (
      <Link
        to={to}
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
    <Link to={to} className={`${base} ${idle}`}>
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
  return (
    <footer className="border-t border-border mt-32">
      <div className="mx-auto max-w-6xl px-6 py-12 flex flex-col md:flex-row gap-6 md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <LoopMark />
          <span className="font-display text-lg font-semibold">Loops</span>
          <span className="text-sm text-muted-foreground ml-2">{t("footer.tagline")}</span>
        </div>
        <div className="flex gap-6 text-sm text-muted-foreground">
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-foreground">
            {t("nav.github")}
          </a>
          <Link to="/docs" className="hover:text-foreground">
            {t("nav.docs")}
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
