import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { useAuth } from "@/lib/auth-context";
import { useIsWorkspaceAdmin } from "@/lib/workspace-context";
import {
  listWebhooks,
  createWebhook,
  deleteWebhook,
  toggleWebhook,
} from "@/lib/webhooks.functions";

export const Route = createFileRoute("/$slug/settings/webhooks")({
  ssr: false,
  head: () => ({ meta: [{ title: "Loops · Webhooks" }] }),
  component: WebhooksPage,
});

type WebhookEvent = "post.created" | "post.status_changed" | "vote.created";

type Webhook = {
  id: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  active: boolean;
  last_delivery_at: string | null;
  last_status: number | null;
  last_error: string | null;
  created_at: string;
};

function WebhooksPage() {
  const { slug } = Route.useParams();
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const isAdmin = useIsWorkspaceAdmin();
  const create = useServerFn(createWebhook);
  const del = useServerFn(deleteWebhook);
  const toggle = useServerFn(toggleWebhook);
  const list = useServerFn(listWebhooks);

  const [hooks, setHooks] = useState<Webhook[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const data = await list({ data: { slug } });
    setHooks((data as Webhook[]) ?? []);
  };

  useEffect(() => {
    if (isAdmin) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, slug]);

  if (loading)
    return (
      <Shell>
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </Shell>
    );
  if (!user || !isAdmin) {
    return (
      <Shell>
        <h1 className="font-display text-3xl font-medium mb-3">{t("common.denied")}</h1>
        <p className="text-muted-foreground mb-6">{t("settings.webhooks.deniedDesc")}</p>
        <Link
          to="/$slug"
          params={{ slug }}
          className="rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium"
        >
          {t("settings.webhooks.back")}
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 mb-8">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
            {t("settings.webhooks.eyebrow")}
          </p>
          <h1 className="font-display text-4xl font-medium tracking-tight">
            {t("settings.webhooks.title")}
          </h1>
          <p className="text-muted-foreground mt-2">{t("settings.webhooks.lead")}</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:bg-foreground/90"
        >
          {t("settings.webhooks.newHook")}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-3xl border border-border bg-surface overflow-hidden">
        {hooks.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            {t("settings.webhooks.emptyA")}
            <Link to="/docs" hash="webhooks" className="underline">
              {t("settings.webhooks.emptyLink")}
            </Link>
            {t("settings.webhooks.emptyB")}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {hooks.map((h) => (
              <li key={h.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{h.name}</span>
                      <button
                        onClick={async () => {
                          try {
                            await toggle({ data: { slug, id: h.id, active: !h.active } });
                            await refresh();
                          } catch (e) {
                            setError(e instanceof Error ? e.message : String(e));
                          }
                        }}
                        className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${h.active ? "bg-status-done/15 text-status-done" : "bg-secondary text-muted-foreground"}`}
                      >
                        {h.active ? t("settings.webhooks.active") : t("settings.webhooks.inactive")}
                      </button>
                      {h.last_error && (
                        <span
                          className="text-[10px] rounded px-1.5 py-0.5 bg-destructive/10 text-destructive font-medium"
                          title={h.last_error}
                        >
                          {t("settings.webhooks.lastError")}
                        </span>
                      )}
                    </div>
                    <code className="block text-xs text-muted-foreground font-mono truncate mt-0.5">
                      {h.url}
                    </code>
                    <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
                      {h.events.map((ev) => (
                        <span
                          key={ev}
                          className="rounded bg-secondary text-muted-foreground px-1.5 py-0.5"
                        >
                          {t(`settings.webhooks.events.${ev}`)}
                        </span>
                      ))}
                    </div>
                    <details className="mt-2">
                      <summary className="text-xs text-muted-foreground hover:text-foreground cursor-pointer select-none">
                        {t("common.showSecret")}
                      </summary>
                      <code className="mt-1 block text-[11px] font-mono bg-background border border-border rounded p-2 break-all">
                        {h.secret}
                      </code>
                    </details>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm(t("settings.webhooks.confirmDelete"))) return;
                      try {
                        await del({ data: { slug, id: h.id } });
                        await refresh();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : String(e));
                      }
                    }}
                    className="shrink-0 text-xs text-muted-foreground hover:text-destructive"
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-secondary/40 p-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
          {t("settings.webhooks.verificationTitle")}
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("settings.webhooks.verificationA")}
          <code className="text-xs bg-background px-1.5 py-0.5 rounded">X-Loop-Signature</code>
          {t("settings.webhooks.verificationB")}
          <code>HMAC-SHA256(body)</code>
          {t("settings.webhooks.verificationC")}
          <Link to="/docs" hash="webhooks" className="underline">
            {t("settings.webhooks.verificationLink")}
          </Link>
          .
        </p>
      </div>

      {open && (
        <CreateModal
          busy={busy}
          onClose={() => setOpen(false)}
          onCreate={async (input) => {
            setBusy(true);
            setError(null);
            try {
              await create({ data: { slug, ...input } });
              setOpen(false);
              await refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-10">{children}</div>
      <SiteFooter />
    </div>
  );
}

function CreateModal({
  busy,
  onClose,
  onCreate,
}: {
  busy: boolean;
  onClose: () => void;
  onCreate: (input: { name: string; url: string; events: WebhookEvent[] }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>(["post.created"]);

  const toggle = (e: WebhookEvent) =>
    setEvents((p) => (p.includes(e) ? p.filter((x) => x !== e) : [...p, e]));

  const allEvents: WebhookEvent[] = ["post.created", "post.status_changed", "vote.created"];

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (events.length === 0) return;
          onCreate({ name: name.trim(), url: url.trim(), events });
        }}
        className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-lifted"
      >
        <h2 className="font-display text-2xl font-medium tracking-tight">
          {t("settings.webhooks.modalTitle")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t("settings.webhooks.modalLead")}</p>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("settings.webhooks.fName")}
            </span>
            <input
              required
              minLength={1}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("settings.webhooks.fNamePh")}
              className="mt-1 w-full rounded-xl border border-border-strong bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              autoFocus
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("settings.webhooks.fUrl")}
            </span>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="mt-1 w-full rounded-xl border border-border-strong bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none"
            />
          </label>
          <div>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("settings.webhooks.fEvents")}
            </span>
            <div className="mt-1 flex flex-col gap-1.5">
              {allEvents.map((ev) => (
                <label key={ev} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={events.includes(ev)}
                    onChange={() => toggle(ev)}
                  />
                  <span>{t(`settings.webhooks.events.${ev}`)}</span>
                  <code className="text-xs text-muted-foreground">{ev}</code>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={busy || events.length === 0}
            className="rounded-xl bg-foreground text-background px-4 py-2 text-sm font-medium hover:bg-foreground/90 disabled:opacity-50"
          >
            {busy ? t("common.creating") : t("common.create")}
          </button>
        </div>
      </form>
    </div>
  );
}
