import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { useAuth } from "@/lib/auth-context";
import { listApiKeys, createApiKey, revokeApiKey } from "@/lib/api-keys.functions";

export const Route = createFileRoute("/settings/api-keys")({
  ssr: false,
  head: () => ({ meta: [{ title: "Loop · API Keys" }] }),
  component: ApiKeysPage,
});

type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  key_type: "secret" | "publishable";
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

type Scope = "read" | "write" | "admin";

function ApiKeysPage() {
  const { t, i18n } = useTranslation();
  const { user, isAdmin, loading } = useAuth();
  const create = useServerFn(createApiKey);
  const revoke = useServerFn(revokeApiKey);
  const list = useServerFn(listApiKeys);

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<{ plain: string; name: string } | null>(null);

  const locale = i18n.language?.startsWith("en") ? "en-US" : "tr-TR";

  const refresh = async () => {
    const data = await list();
    setKeys((data as ApiKey[]) ?? []);
  };

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin]);

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
        <p className="text-muted-foreground mb-6">{t("settings.apiKeys.deniedDesc")}</p>
        <Link
          to="/board"
          className="rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium"
        >
          {t("settings.apiKeys.back")}
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 mb-8">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
            {t("settings.apiKeys.eyebrow")}
          </p>
          <h1 className="font-display text-4xl font-medium tracking-tight">
            {t("settings.apiKeys.title")}
          </h1>
          <p className="text-muted-foreground mt-2">{t("settings.apiKeys.lead")}</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:bg-foreground/90"
        >
          {t("settings.apiKeys.newKey")}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-3xl border border-border bg-surface overflow-hidden">
        {keys.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            {t("settings.apiKeys.empty")}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {keys.map((k) => (
              <li key={k.id} className="p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{k.name}</span>
                    <span
                      className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${k.key_type === "secret" ? "bg-foreground/10 text-foreground" : "bg-ai-soft text-ai"}`}
                    >
                      {t(`settings.apiKeys.types.${k.key_type}`)}
                    </span>
                    {k.revoked_at && (
                      <span className="text-[10px] rounded px-1.5 py-0.5 bg-destructive/10 text-destructive font-medium">
                        {t("settings.apiKeys.revoked")}
                      </span>
                    )}
                  </div>
                  <code className="text-xs text-muted-foreground font-mono">{k.key_prefix}…</code>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      {t("settings.apiKeys.scope")}: {k.scopes.join(", ")}
                    </span>
                    <span>•</span>
                    <span>
                      {t("settings.apiKeys.created")}:{" "}
                      {new Date(k.created_at).toLocaleDateString(locale)}
                    </span>
                    {k.last_used_at && (
                      <>
                        <span>•</span>
                        <span>
                          {t("settings.apiKeys.lastUsed")}:{" "}
                          {new Date(k.last_used_at).toLocaleDateString(locale)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {!k.revoked_at && (
                  <button
                    onClick={async () => {
                      if (!confirm(t("settings.apiKeys.confirmRevoke"))) return;
                      try {
                        await revoke({ data: { id: k.id } });
                        await refresh();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : String(e));
                      }
                    }}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    {t("settings.apiKeys.revoke")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-secondary/40 p-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
          {t("settings.apiKeys.tip")}
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          <strong className="text-foreground">{t("settings.apiKeys.tipBody1")}</strong>
          {t("settings.apiKeys.tipBody2")}
          <strong className="text-foreground">{t("settings.apiKeys.tipBody3")}</strong>
          {t("settings.apiKeys.tipBody4")}
          <code className="text-xs bg-background px-1.5 py-0.5 rounded">
            Authorization: Bearer &lt;key&gt;
          </code>
          .
        </p>
      </div>

      {open && (
        <CreateModal
          onClose={() => setOpen(false)}
          busy={busy}
          onCreate={async (input) => {
            setBusy(true);
            setError(null);
            try {
              const r = await create({ data: input });
              setNewKey({ plain: r.plain_key, name: r.name });
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

      {newKey && <NewKeyDialog data={newKey} onClose={() => setNewKey(null)} />}
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
  onClose,
  busy,
  onCreate,
}: {
  onClose: () => void;
  busy: boolean;
  onCreate: (input: {
    name: string;
    type: "secret" | "publishable";
    scopes: Scope[];
  }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [type, setType] = useState<"secret" | "publishable">("secret");
  const [scopes, setScopes] = useState<Scope[]>(["read", "write"]);

  const toggle = (s: Scope) =>
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (scopes.length === 0) return;
          onCreate({ name: name.trim(), type, scopes });
        }}
        className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-lifted"
      >
        <h2 className="font-display text-2xl font-medium tracking-tight">
          {t("settings.apiKeys.modalTitle")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t("settings.apiKeys.modalLead")}</p>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("settings.apiKeys.fName")}
            </span>
            <input
              required
              minLength={1}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("settings.apiKeys.fNamePh")}
              className="mt-1 w-full rounded-xl border border-border-strong bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              autoFocus
            />
          </label>

          <div>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("settings.apiKeys.fType")}
            </span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(["secret", "publishable"] as const).map((tk) => (
                <button
                  key={tk}
                  type="button"
                  onClick={() => setType(tk)}
                  className={`rounded-xl border px-3 py-2 text-sm text-left transition-colors ${type === tk ? "border-foreground bg-foreground/5" : "border-border bg-background hover:border-border-strong"}`}
                >
                  <p className="font-medium">{tk === "secret" ? "Secret" : "Publishable"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tk === "secret"
                      ? t("settings.apiKeys.typeSecretDesc")
                      : t("settings.apiKeys.typePubDesc")}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("settings.apiKeys.fScopes")}
            </span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(["read", "write", "admin"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggle(s)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${scopes.includes(s) ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("settings.apiKeys.scopeHint")}
            </p>
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
            disabled={busy || scopes.length === 0}
            className="rounded-xl bg-foreground text-background px-4 py-2 text-sm font-medium hover:bg-foreground/90 disabled:opacity-50"
          >
            {busy ? t("common.creating") : t("common.create")}
          </button>
        </div>
      </form>
    </div>
  );
}

function NewKeyDialog({
  data,
  onClose,
}: {
  data: { plain: string; name: string };
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-surface p-6 shadow-lifted">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ai text-background text-xs font-bold">
            ✓
          </span>
          <h2 className="font-display text-2xl font-medium tracking-tight">
            {t("settings.apiKeys.createdTitle")}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          <strong>{data.name}</strong>
          {t("settings.apiKeys.createdBodyA")}
          <strong className="text-destructive">{t("settings.apiKeys.createdBodyB")}</strong>
          {t("settings.apiKeys.createdBodyC")}
        </p>
        <div className="rounded-xl border border-border-strong bg-background p-3 font-mono text-xs break-all">
          {data.plain}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(data.plain);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="rounded-xl bg-secondary text-foreground px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {copied ? t("common.copied") : t("common.copy")}
          </button>
          <button
            onClick={onClose}
            className="rounded-xl bg-foreground text-background px-4 py-2 text-sm font-medium hover:bg-foreground/90"
          >
            {t("common.ok")}
          </button>
        </div>
      </div>
    </div>
  );
}
