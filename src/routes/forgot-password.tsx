import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";
import { useAuth } from "@/lib/auth-context";
import { getAppModeFn } from "@/lib/workspace.functions";
import { LoopMark } from "@/components/site-header";

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  head: () => ({ meta: [{ title: "Loops · Reset password" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  // If this deployment has no email provider, password reset can't work.
  useEffect(() => {
    getAppModeFn()
      .then((m) => {
        if (!m.emailVerification) setError(t("forgotPw.unavailable"));
      })
      .catch(() => {});
  }, [t]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-5 border-b border-border">
        <Link to="/" className="inline-flex items-center gap-2">
          <LoopMark />
          <span className="font-display text-lg font-semibold">Loops</span>
        </Link>
      </header>
      <main className="flex-1 grid place-items-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-border bg-surface p-8 shadow-card">
            <h1 className="font-display text-3xl font-medium tracking-tight">
              {t("forgotPw.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t("forgotPw.subtitle")}</p>

            {sent ? (
              <div className="mt-6 rounded-xl bg-primary-soft px-4 py-3 text-sm">
                {t("forgotPw.sent")}
              </div>
            ) : (
              <form onSubmit={submit} className="mt-6 space-y-3">
                <label className="block">
                  <span className="text-xs text-muted-foreground font-medium mb-1.5 block">
                    {t("auth.fields.email")}
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("auth.placeholders.email")}
                    className="w-full rounded-xl border border-border-strong bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
                  />
                </label>
                {error && (
                  <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-foreground text-background py-2.5 text-sm font-medium hover:bg-foreground/90 disabled:opacity-50"
                >
                  {busy ? "..." : t("forgotPw.submit")}
                </button>
              </form>
            )}

            <p className="mt-5 text-center text-sm text-muted-foreground">
              <Link to="/auth" className="text-foreground font-medium hover:underline">
                {t("forgotPw.backToSignIn")}
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
