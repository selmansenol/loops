import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { useAuth } from "@/lib/auth-context";
import { useIsWorkspaceAdmin } from "@/lib/workspace-context";
import {
  getAiSettings,
  saveAiProviderKey,
  deleteAiProviderKey,
  type AiSettingsResult,
  type AiProviderStatus,
} from "@/lib/ai-settings.functions";

export const Route = createFileRoute("/$slug/settings/ai")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Loops · AI Provider" },
      {
        name: "description",
        content: "Configure your own OpenAI, Anthropic or Gemini API key for Loops' AI insights.",
      },
    ],
  }),
  component: AiSettingsPage,
});

function AiSettingsPage() {
  const { slug } = Route.useParams();
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const isAdmin = useIsWorkspaceAdmin();
  const fetchSettings = useServerFn(getAiSettings);
  const [settings, setSettings] = useState<AiSettingsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    setError(null);
    try {
      setSettings(await fetchSettings({ data: { slug } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAdmin) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (loading) return null;

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-6 py-20 text-center">
          <h1 className="font-display text-3xl font-medium tracking-tight">{t("common.denied")}</h1>
          <p className="text-muted-foreground mt-3">{t("settingsAi.deniedDesc")}</p>
          <Link
            to="/$slug"
            params={{ slug }}
            className="inline-flex mt-6 rounded-full bg-foreground text-background px-5 py-2 text-sm font-medium"
          >
            {t("settingsAi.back")}
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
          {t("settingsAi.eyebrow")}
        </p>
        <div className="flex items-start justify-between gap-4 mb-3">
          <h1 className="font-display text-4xl font-medium tracking-tight">
            {t("settingsAi.title")}
          </h1>
          <button
            onClick={load}
            disabled={refreshing}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {refreshing ? t("common.loading") : t("settingsAi.refresh")}
          </button>
        </div>
        <p className="text-muted-foreground mb-8 max-w-xl">{t("settingsAi.lead")}</p>

        {error && (
          <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/5 text-destructive p-4 text-sm">
            {error}
          </div>
        )}

        {settings && (
          <>
            <div className="mb-8 rounded-3xl border border-border bg-surface p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                {t("settingsAi.activeTitle")}
              </p>
              {settings.active ? (
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-display text-2xl font-medium">
                    {providerLabel(settings.active.provider)}
                  </span>
                  <code className="text-sm bg-secondary px-2 py-0.5 rounded">
                    {settings.active.modelId}
                  </code>
                  <span className="text-xs text-muted-foreground">
                    ·{" "}
                    {settings.active.source === "db"
                      ? t("settingsAi.fromUi")
                      : t("settingsAi.fromEnv")}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("settingsAi.noneActive")}</p>
              )}
              {settings.override && (
                <p className="text-xs text-muted-foreground mt-3">
                  {t("settingsAi.overrideNote", { provider: settings.override })}
                </p>
              )}
            </div>

            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {t("settingsAi.providersTitle")}
            </h2>
            <div className="grid gap-4 mb-10">
              {settings.providers.map((p) => (
                <ProviderCard key={p.id} slug={slug} provider={p} onChanged={load} />
              ))}
            </div>

            <details className="rounded-2xl border border-border bg-surface p-4 text-sm">
              <summary className="cursor-pointer font-medium">{t("settingsAi.envTitle")}</summary>
              <p className="text-xs text-muted-foreground mt-2 mb-3">{t("settingsAi.envLead")}</p>
              <pre className="overflow-x-auto rounded-xl bg-foreground text-background p-4 text-xs font-mono">
                {`OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=AIza...

LOOP_AI_PROVIDER=openai      # optional override
LOOP_AI_MODEL=gpt-4o-mini    # optional model override`}
              </pre>
            </details>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function ProviderCard({
  slug,
  provider,
  onChanged,
}: {
  slug: string;
  provider: AiProviderStatus;
  onChanged: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const save = useServerFn(saveAiProviderKey);
  const del = useServerFn(deleteAiProviderKey);
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const configured = provider.source !== null;

  const handleSave = async () => {
    setBusy(true);
    setErr(null);
    try {
      await save({ data: { slug, provider: provider.id, apiKey: key.trim() } });
      setKey("");
      setOpen(false);
      await onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t("settingsAi.deleteConfirm"))) return;
    setBusy(true);
    setErr(null);
    try {
      await del({ data: { slug, provider: provider.id } });
      await onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border p-4 ${configured ? "border-status-done/40 bg-status-done/5" : "border-border bg-surface"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{provider.label}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("settingsAi.defaultModel")}: <code>{provider.defaultModel}</code>
          </p>
          {configured && provider.last4 && (
            <p className="text-xs text-muted-foreground mt-1">
              {provider.source === "db"
                ? t("settingsAi.savedKey")
                : t("settingsAi.envKey", { env: provider.envVar })}{" "}
              · <code className="bg-secondary px-1.5 py-0.5 rounded">…{provider.last4}</code>
            </p>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span
            className={`text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${configured ? "bg-status-done text-background" : "bg-secondary text-muted-foreground"}`}
          >
            {configured ? t("settingsAi.configured") : t("settingsAi.missing")}
          </span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-full border border-border bg-background px-3 py-1 text-xs hover:text-foreground"
          >
            {configured ? t("settingsAi.replace") : t("settingsAi.add")}
          </button>
          {provider.source === "db" && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="rounded-full border border-destructive/40 text-destructive px-3 py-1 text-xs hover:bg-destructive/5 disabled:opacity-50"
            >
              {t("settingsAi.remove")}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-2">
          <label className="block text-xs text-muted-foreground">{t("settingsAi.apiKey")}</label>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={provider.keyHint}
            autoComplete="off"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-mono"
          />
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={busy || key.trim().length < 10}
              className="rounded-full bg-foreground text-background px-4 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              {busy ? t("common.loading") : t("settingsAi.save")}
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setKey("");
                setErr(null);
              }}
              className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground"
            >
              {t("settingsAi.cancel")}
            </button>
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
      )}
    </div>
  );
}

function providerLabel(id: string) {
  if (id === "openai") return "OpenAI · ChatGPT";
  if (id === "anthropic") return "Anthropic · Claude";
  if (id === "google") return "Google · Gemini";
  return id;
}
