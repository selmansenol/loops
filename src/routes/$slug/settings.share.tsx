import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { useAuth } from "@/lib/auth-context";
import { useIsWorkspaceAdmin } from "@/lib/workspace-context";
import { getWorkspaceFn, updateBoardSettingsFn } from "@/lib/workspace.functions";
import { createApiKey } from "@/lib/api-keys.functions";

export const Route = createFileRoute("/$slug/settings/share")({
  ssr: false,
  head: () => ({ meta: [{ title: "Loops · Share & Embed" }] }),
  component: SharePage,
});

function SharePage() {
  const { slug } = Route.useParams();
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const isAdmin = useIsWorkspaceAdmin();
  const fetchWs = useServerFn(getWorkspaceFn);
  const saveSettings = useServerFn(updateBoardSettingsFn);
  const createKey = useServerFn(createApiKey);

  const [origin, setOrigin] = useState("https://getloops.co");
  const [allowGuest, setAllowGuest] = useState(true);
  const [savingGuest, setSavingGuest] = useState(false);
  const [embedKey, setEmbedKey] = useState<string | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    if (isAdmin) {
      fetchWs({ data: { slug } })
        .then((w) => w && setAllowGuest(w.allowGuestVotes))
        .catch(() => {});
    }
  }, [isAdmin, slug, fetchWs]);

  if (loading) return null;
  if (!user || !isAdmin) {
    return (
      <Shell>
        <h1 className="font-display text-3xl font-medium mb-3">{t("common.denied")}</h1>
        <Link
          to="/$slug"
          params={{ slug }}
          className="rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium"
        >
          {t("share.back")}
        </Link>
      </Shell>
    );
  }

  const boardUrl = `${origin}/${slug}`;
  const embedCode = `<div id="loop-board"></div>
<script src="${origin}/loop-widget.js"
        data-key="${embedKey ?? "loop_pk_..."}"
        data-host="${origin}"
        data-target="#loop-board"></script>`;

  const copy = async (text: string, which: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const toggleGuest = async (next: boolean) => {
    setAllowGuest(next);
    setSavingGuest(true);
    setErr(null);
    try {
      await saveSettings({ data: { slug, allowGuestVotes: next } });
    } catch (e) {
      setAllowGuest(!next);
      setErr((e as Error).message);
    } finally {
      setSavingGuest(false);
    }
  };

  const genEmbedKey = async () => {
    setGenBusy(true);
    setErr(null);
    try {
      const r = await createKey({
        data: { slug, name: "Embed widget", type: "publishable", scopes: ["read", "write"] },
      });
      setEmbedKey(r.plain_key);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setGenBusy(false);
    }
  };

  return (
    <Shell>
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
        {t("share.eyebrow")}
      </p>
      <h1 className="font-display text-4xl font-medium tracking-tight">{t("share.title")}</h1>
      <p className="text-muted-foreground mt-2 mb-8 max-w-xl">{t("share.lead")}</p>

      {err && (
        <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/5 text-destructive p-4 text-sm">
          {err}
        </div>
      )}

      {/* 1. Public link */}
      <Card title={t("share.linkTitle")} desc={t("share.linkDesc")}>
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 truncate rounded-xl border border-border bg-background px-3 py-2 text-sm font-mono">
            {boardUrl}
          </code>
          <button onClick={() => copy(boardUrl, "link")} className="btn-sm">
            {copied === "link" ? t("common.copied") : t("common.copy")}
          </button>
          <a href={boardUrl} target="_blank" rel="noreferrer" className="btn-sm">
            {t("share.open")}
          </a>
        </div>
      </Card>

      {/* 2. Participation: guest voting */}
      <Card title={t("share.participationTitle")} desc={t("share.guestVotesDesc")}>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={allowGuest}
            disabled={savingGuest}
            onChange={(e) => toggleGuest(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm">{t("share.guestVotes")}</span>
        </label>
      </Card>

      {/* 3. Embed widget */}
      <Card title={t("share.embedTitle")} desc={t("share.embedLead")}>
        {!embedKey && (
          <button onClick={genEmbedKey} disabled={genBusy} className="btn-primary mb-3">
            {genBusy ? t("common.creating") : t("share.genKey")}
          </button>
        )}
        {embedKey && <p className="text-xs text-status-done mb-2">{t("share.keyOnce")}</p>}
        <div className="relative">
          <pre className="overflow-x-auto rounded-xl bg-foreground text-background p-4 text-xs font-mono">
            {embedCode}
          </pre>
          <button
            onClick={() => copy(embedCode, "embed")}
            className="btn-sm absolute top-2 right-2"
          >
            {copied === "embed" ? t("common.copied") : t("common.copy")}
          </button>
        </div>
      </Card>

      {/* 4. API / mobile */}
      <Card title={t("share.apiTitle")} desc={t("share.apiLead")}>
        <Link to="/docs" className="text-primary hover:underline text-sm">
          {t("share.apiCta")} →
        </Link>
      </Card>

      <style>{`
        .btn-sm { white-space:nowrap; border-radius:9999px; border:1px solid var(--color-border-strong); background:var(--color-surface); padding:0.4rem 0.85rem; font-size:0.8rem; }
        .btn-sm:hover { background:var(--color-accent); }
        .btn-primary { border-radius:9999px; background:var(--color-foreground); color:var(--color-background); padding:0.5rem 1.1rem; font-size:0.8rem; font-weight:500; }
        .btn-primary:disabled { opacity:0.5; }
      `}</style>
    </Shell>
  );
}

function Card({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5 rounded-3xl border border-border bg-surface p-5">
      <h2 className="font-display text-lg font-medium tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-4">{desc}</p>
      {children}
    </section>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>
      <SiteFooter />
    </div>
  );
}
