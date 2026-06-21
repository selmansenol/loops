import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";
import { LoopMark } from "@/components/site-header";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({ meta: [{ title: "Loops · Set a new password" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // better-auth appends ?token=... to the reset link.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tk = params.get("token");
    if (tk) setToken(tk);
    else setError(t("resetPw.invalidLink"));
  }, [t]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (password !== confirm) {
      setError(t("resetPw.mismatch"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error } = await authClient.resetPassword({ newPassword: password, token });
      if (error) throw new Error(error.message ?? "Reset failed");
      setDone(true);
      setTimeout(() => navigate({ to: "/auth", replace: true }), 1800);
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
              {t("resetPw.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t("resetPw.subtitle")}</p>

            {done ? (
              <div className="mt-6 rounded-xl bg-primary-soft px-4 py-3 text-sm">
                {t("resetPw.done")}
              </div>
            ) : (
              <form onSubmit={submit} className="mt-6 space-y-3">
                <label className="block">
                  <span className="text-xs text-muted-foreground font-medium mb-1.5 block">
                    {t("resetPw.newPassword")}
                  </span>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-border-strong bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-muted-foreground font-medium mb-1.5 block">
                    {t("resetPw.confirmPassword")}
                  </span>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
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
                  disabled={busy || !token}
                  className="w-full rounded-xl bg-foreground text-background py-2.5 text-sm font-medium hover:bg-foreground/90 disabled:opacity-50"
                >
                  {busy ? "..." : t("resetPw.submit")}
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
