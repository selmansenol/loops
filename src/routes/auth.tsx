import { createFileRoute, useNavigate, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";
import { useAuth } from "@/lib/auth-context";
import { LoopMark } from "@/components/site-header";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Loops · Sign in" },
      { name: "description", content: "Sign in or create a Loops account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/board", replace: true });
    }
  }, [user, loading, navigate]);

  const translateAuthError = (msg: string): string => {
    const m = msg.toLowerCase();
    if (m.includes("invalid email or password") || m.includes("invalid login"))
      return t("auth.errors.invalidLogin");
    if (m.includes("already exists") || m.includes("already registered"))
      return t("auth.errors.alreadyRegistered");
    if (m.includes("password") && (m.includes("short") || m.includes("at least")))
      return t("auth.errors.shortPassword");
    return msg;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await authClient.signUp.email({
          email,
          password,
          name: username || email.split("@")[0],
        });
        if (error) throw new Error(error.message ?? "Sign up failed");
        await router.invalidate();
        navigate({ to: "/board", replace: true });
      } else {
        const { error } = await authClient.signIn.email({ email, password });
        if (error) throw new Error(error.message ?? "Sign in failed");
        await router.invalidate();
        navigate({ to: "/board", replace: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(translateAuthError(msg));
    } finally {
      setBusy(false);
    }
  };

  const handleSocial = async (provider: "google" | "github") => {
    setError(null);
    setBusy(true);
    try {
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: `${window.location.origin}/board`,
      });
      if (error) {
        setError(error.message ?? String(error));
        setBusy(false);
      }
      // On success better-auth redirects to the provider; nothing else to do.
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
              {mode === "signin" ? t("auth.signInTitle") : t("auth.signUpTitle")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "signin" ? t("auth.signInSubtitle") : t("auth.signUpSubtitle")}
            </p>

            <div className="mt-6 grid gap-2">
              <button
                onClick={() => handleSocial("google")}
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
              >
                <GoogleIcon /> {t("auth.google")}
              </button>
              <button
                onClick={() => handleSocial("github")}
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
              >
                <GitHubIcon /> {t("auth.github")}
              </button>
            </div>

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              {t("auth.orEmail")}
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "signup" && (
                <Field label={t("auth.fields.username")}>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t("auth.placeholders.username")}
                    className="input"
                  />
                </Field>
              )}
              <Field label={t("auth.fields.email")}>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("auth.placeholders.email")}
                  className="input"
                />
              </Field>
              <Field label={t("auth.fields.password")}>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("auth.placeholders.password")}
                  className="input"
                />
              </Field>
              {error && (
                <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              {notice && (
                <p className="text-xs text-foreground bg-primary-soft rounded-lg px-3 py-2">
                  {notice}
                </p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-foreground text-background py-2.5 text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
              >
                {busy ? "..." : mode === "signin" ? t("auth.signIn") : t("auth.signUp")}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              {mode === "signin" ? t("auth.noAccount") : t("auth.hasAccount")}
              <button
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setError(null);
                  setNotice(null);
                }}
                className="text-foreground font-medium hover:underline"
              >
                {mode === "signin" ? t("auth.signUp") : t("auth.signIn")}
              </button>
            </p>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-6">
            <Link to="/board" className="hover:text-foreground">
              {t("auth.justBrowse")}
            </Link>
          </p>
        </div>
      </main>
      <style>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid var(--color-border-strong);
          background: var(--color-background);
          padding: 0.625rem 0.875rem;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .input:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px color-mix(in oklch, var(--color-primary) 18%, transparent);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground font-medium mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23 12.27c0-.78-.07-1.53-.2-2.27H12v4.51h6.16c-.27 1.4-1.07 2.59-2.28 3.39v2.82h3.69C21.7 18.84 23 15.85 23 12.27z"
      />
      <path
        fill="#34A853"
        d="M12 23c3.08 0 5.66-1.02 7.56-2.78l-3.69-2.82c-1.02.69-2.33 1.1-3.87 1.1-2.97 0-5.49-2-6.39-4.69H1.82v2.91A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.61 13.81A6.6 6.6 0 0 1 5.27 12c0-.63.11-1.24.34-1.81V7.28H1.82A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.92l3.43-2.91z"
      />
      <path
        fill="#EA4335"
        d="M12 5.5c1.68 0 3.18.58 4.36 1.71l3.27-3.27C17.66 2.11 15.08 1 12 1 7.7 1 3.99 3.47 1.82 7.08l3.79 2.91C6.51 7.5 9.03 5.5 12 5.5z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 1C5.92 1 1 5.92 1 12c0 4.87 3.15 8.99 7.52 10.45.55.1.75-.24.75-.53v-1.85c-3.06.67-3.71-1.47-3.71-1.47-.5-1.27-1.22-1.61-1.22-1.61-1-.68.08-.67.08-.67 1.1.08 1.68 1.13 1.68 1.13.98 1.69 2.58 1.2 3.21.92.1-.71.38-1.2.69-1.48-2.44-.28-5.01-1.22-5.01-5.43 0-1.2.43-2.18 1.13-2.95-.11-.28-.49-1.4.11-2.92 0 0 .92-.3 3.02 1.13a10.4 10.4 0 0 1 5.5 0c2.1-1.43 3.02-1.13 3.02-1.13.6 1.52.22 2.64.11 2.92.7.77 1.13 1.75 1.13 2.95 0 4.22-2.58 5.15-5.03 5.42.4.34.74 1.01.74 2.04v3.03c0 .29.2.64.76.53A11.01 11.01 0 0 0 23 12c0-6.08-4.92-11-11-11z" />
    </svg>
  );
}
