import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SiteHeader, SiteFooter, LoopMark, GITHUB_URL } from "@/components/site-header";
import { getAppModeFn } from "@/lib/workspace.functions";

function useFeedbackSlug() {
  const [slug, setSlug] = useState<string | null>(null);
  useEffect(() => {
    getAppModeFn()
      .then((m) => setSlug(m.feedbackSlug))
      .catch(() => {});
  }, []);
  return slug;
}

export const Route = createFileRoute("/")({
  // Single-tenant (self-host) → the app is one board; skip the marketing page.
  beforeLoad: async () => {
    const { getAppModeFn } = await import("@/lib/workspace.functions");
    const mode = await getAppModeFn();
    if (mode.singleTenantSlug) {
      throw redirect({ to: "/$slug", params: { slug: mode.singleTenantSlug } });
    }
  },
  head: () => ({
    meta: [
      { title: "Loops — Open-source feedback board organized by AI" },
      {
        name: "description",
        content:
          "Not a board that just collects user requests — one that organizes them for you. Open source. One-command self-host.",
      },
      { property: "og:title", content: "Loops — AI-powered feedback board" },
      {
        property: "og:description",
        content: "Like Canny, but AI organizes feedback for you — and it's open source.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <Hero />
      <SocialProof />
      <Features />
      <AISection />
      <ClusterDemo />
      <SelfHost />
      <CTA />
      <SiteFooter />
    </div>
  );
}

function Hero() {
  const { t } = useTranslation();
  const feedbackSlug = useFeedbackSlug();
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-60" aria-hidden>
        <div className="absolute top-20 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full bg-primary-soft blur-3xl opacity-50" />
        <div className="absolute top-60 right-10 h-64 w-64 rounded-full bg-ai-soft blur-3xl opacity-60" />
      </div>
      <div className="mx-auto max-w-5xl px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground shadow-soft mb-8">
          <span className="h-1.5 w-1.5 rounded-full bg-status-done" />
          {t("landing.eyebrowBadge")}
        </div>
        <h1 className="font-display text-5xl md:text-7xl font-medium leading-[1.05] tracking-tight">
          {t("landing.h1a")}{" "}
          <span className="relative inline-block">
            <span className="relative z-10">{t("landing.h1b")}</span>
            <svg
              viewBox="0 0 200 12"
              className="absolute -bottom-1 left-0 w-full"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path
                d="M2 8 Q 50 2, 100 6 T 198 4"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                className="text-muted-foreground/40"
              />
            </svg>
          </span>{" "}
          {t("landing.h1c")}
          <br />
          <span className="text-primary">{t("landing.h1d")}</span>
          {t("landing.h1e")}
        </h1>
        <p className="mt-7 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          {t("landing.lead")}
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/demo"
            className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-6 py-3 text-sm font-medium hover:bg-foreground/90 transition-all hover:scale-[1.02] shadow-card"
          >
            {t("landing.tryDemo")}
            <span aria-hidden>→</span>
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-6 py-3 text-sm font-medium hover:bg-accent transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.07 11.07 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.41-5.26 5.69.41.36.78 1.05.78 2.13v3.16c0 .31.21.67.8.55C20.22 21.38 23.5 17.07 23.5 12 23.5 5.65 18.35.5 12 .5z" />
            </svg>
            {t("landing.starGitHub")}
          </a>
          {feedbackSlug && (
            <Link
              to="/$slug"
              params={{ slug: feedbackSlug }}
              className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-6 py-3 text-sm font-medium hover:bg-accent transition-colors"
            >
              💬 {t("landing.giveFeedback")}
            </Link>
          )}
        </div>
        <p className="mt-5 text-xs text-muted-foreground">{t("landing.sublead")}</p>
      </div>

      <div className="mx-auto max-w-5xl px-6 pb-12">
        <PreviewCard />
      </div>
    </section>
  );
}

function PreviewCard() {
  const { t } = useTranslation();
  return (
    <div className="relative rounded-3xl border border-border bg-surface shadow-lifted overflow-hidden">
      <div className="flex items-center gap-2 px-4 h-10 border-b border-border bg-surface-elevated">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-status-progress/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-status-done/60" />
        <span className="ml-3 text-xs text-muted-foreground font-mono">getloops.co/acme</span>
      </div>
      <div className="grid md:grid-cols-[1fr_280px] gap-0">
        <div className="p-6 space-y-3">
          <PreviewPost
            votes={142}
            title={t("landing.previewPosts.darkTheme")}
            tag={t("landing.previewTags.ui")}
            status="planned"
          />
          <PreviewPost
            votes={98}
            title={t("landing.previewPosts.slack")}
            tag={t("landing.previewTags.integration")}
            status="progress"
          />
          <PreviewPost
            votes={67}
            title={t("landing.previewPosts.csv")}
            tag={t("landing.previewTags.export")}
            status="planned"
          />
          <PreviewPost
            votes={54}
            title={t("landing.previewPosts.mobile")}
            tag={t("landing.previewTags.mobile")}
            status="planned"
            muted
          />
          <PreviewPost
            votes={31}
            title={t("landing.previewPosts.webhook")}
            tag={t("landing.previewTags.api")}
            status="done"
          />
        </div>
        <aside className="border-l border-border bg-ai-soft/40 p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-medium text-ai">
            <SparkleIcon />
            {t("landing.aiSummary")}
          </div>
          <p className="text-sm leading-relaxed text-foreground">
            {t("landing.aiSummaryBody1")}
            <strong>{t("landing.aiSummaryBody2")}</strong>
            {t("landing.aiSummaryBody3")}
          </p>
          <div className="space-y-2 pt-2 border-t border-border/60">
            <ClusterChip count={4} label={t("landing.clusters.theme")} />
            <ClusterChip count={3} label={t("landing.clusters.integrations")} />
            <ClusterChip count={2} label={t("landing.clusters.export")} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function PreviewPost({
  votes,
  title,
  tag,
  status,
  muted = false,
}: {
  votes: number;
  title: string;
  tag: string;
  status: "planned" | "progress" | "done";
  muted?: boolean;
}) {
  const { t } = useTranslation();
  const statusColor = {
    planned: "bg-status-planned",
    progress: "bg-status-progress",
    done: "bg-status-done",
  }[status];
  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border border-border p-3 hover:border-border-strong transition-colors ${muted ? "opacity-70" : ""}`}
    >
      <div className="flex flex-col items-center justify-center min-w-[48px] rounded-xl bg-secondary px-3 py-2">
        <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 text-foreground">
          <path d="M12 4l8 10H4z" fill="currentColor" />
        </svg>
        <span className="text-sm font-semibold tabular-nums">{votes}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5">
            {tag}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} />
            {t(`landing.previewStatus.${status}`)}
          </span>
        </div>
      </div>
    </div>
  );
}

function ClusterChip({ count, label }: { count: number; label: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-xs border border-border/60">
      <span className="text-foreground">{label}</span>
      <span className="rounded-md bg-ai/10 text-ai px-1.5 py-0.5 font-medium tabular-nums">
        {count}
      </span>
    </div>
  );
}

function SparkleIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2zM19 14l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 14z" />
    </svg>
  );
}

function SocialProof() {
  const { t } = useTranslation();
  const items = t("landing.audience", { returnObjects: true }) as [string, string][];
  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      <p className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-6">
        {t("landing.socialEyebrow")}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        {items.map(([title, desc]) => (
          <div key={title} className="rounded-2xl border border-border bg-surface p-4">
            <p className="font-medium">{title}</p>
            <p className="text-muted-foreground text-xs mt-1 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const { t } = useTranslation();
  const icons = ["📋", "🚦", "🧩", "🛠", "🔑", "🐳"];
  const features = (t("landing.features", { returnObjects: true }) as [string, string][]).map(
    ([title, desc], i) => ({ title, desc, icon: icons[i] }),
  );
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-24 scroll-mt-20">
      <div className="max-w-2xl mb-14">
        <p className="text-sm font-medium text-primary mb-3">{t("landing.featuresEyebrow")}</p>
        <h2 className="font-display text-4xl md:text-5xl font-medium tracking-tight">
          {t("landing.featuresTitle")}
        </h2>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((f) => (
          <div
            key={f.title}
            className="group rounded-2xl border border-border bg-surface p-6 hover:shadow-card hover:border-border-strong transition-all"
          >
            <div className="text-2xl mb-4">{f.icon}</div>
            <h3 className="font-display text-lg font-semibold mb-1">{f.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AISection() {
  const { t } = useTranslation();
  const bullets = t("landing.aiBullets", { returnObjects: true }) as string[];
  return (
    <section id="ai" className="relative scroll-mt-20">
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-ai-soft/30 to-transparent"
        aria-hidden
      />
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm font-medium text-ai mb-3 flex items-center gap-2">
              <SparkleIcon /> {t("landing.aiEyebrow")}
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-medium tracking-tight leading-tight">
              {t("landing.aiTitle1")}
              <br />
              <span className="text-ai">{t("landing.aiTitle2")}</span>
              <br />
              {t("landing.aiTitle3")}
            </h2>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              {t("landing.aiLeadA")}
              <strong>{t("landing.aiLeadB")}</strong>
              {t("landing.aiLeadC")}
            </p>
            <ul className="mt-8 space-y-3 text-sm">
              {bullets.map((line) => (
                <li key={line} className="flex gap-3 items-start">
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-ai/10 text-ai shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3">
                      <path
                        d="M5 12l5 5L20 7"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 inline-flex items-center gap-2 text-xs text-muted-foreground rounded-full border border-border bg-surface px-3 py-1.5">
              {t("landing.aiProviderNote")}
            </div>
          </div>

          <ClusterVisual />
        </div>
      </div>
    </section>
  );
}

function ClusterVisual() {
  const { t } = useTranslation();
  const labels = t("landing.clusterVisual.items", { returnObjects: true }) as string[];
  const angles = [-25, 10, -8, 22];
  return (
    <div className="relative rounded-3xl border border-border bg-surface p-8 shadow-card aspect-square max-w-md mx-auto">
      <div className="absolute inset-8 grid grid-cols-2 gap-3">
        {labels.map((text, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground self-center"
            style={{ transform: `rotate(${angles[i] * 0.2}deg)` }}
          >
            "{text}"
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="rounded-2xl bg-foreground text-background px-5 py-3 shadow-lifted">
          <div className="flex items-center gap-2 text-xs opacity-70 mb-1">
            <SparkleIcon className="h-3 w-3" /> {t("landing.clusterVisual.badge")}
          </div>
          <p className="text-sm font-medium">{t("landing.clusterVisual.suggest")}</p>
          <p className="text-xs opacity-70 mt-0.5">{t("landing.clusterVisual.suggestSub")}</p>
        </div>
      </div>
    </div>
  );
}

function ClusterDemo() {
  const { t } = useTranslation();
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="rounded-3xl border border-border bg-gradient-to-br from-surface to-primary-soft/30 p-10 md:p-14 text-center">
        <h2 className="font-display text-3xl md:text-4xl font-medium tracking-tight max-w-2xl mx-auto">
          {t("landing.demoCardTitle")}
        </h2>
        <p className="mt-4 text-muted-foreground max-w-xl mx-auto">{t("landing.demoCardLead")}</p>
        <Link
          to="/demo"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-foreground text-background px-6 py-3 text-sm font-medium hover:bg-foreground/90 transition-all hover:scale-[1.02] shadow-card"
        >
          {t("landing.demoCardCta")}
          <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}

function SelfHost() {
  const { t } = useTranslation();
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-24 scroll-mt-20">
      <div className="grid lg:grid-cols-2 gap-12 items-start">
        <div>
          <p className="text-sm font-medium text-primary mb-3">{t("landing.selfHostEyebrow")}</p>
          <h2 className="font-display text-4xl md:text-5xl font-medium tracking-tight">
            {t("landing.selfHostTitleA")}
            <br />
            {t("landing.selfHostTitleB")}
            <br />
            {t("landing.selfHostTitleC")}
          </h2>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-md">
            {t("landing.selfHostLead")}
          </p>
        </div>
        <div className="rounded-2xl border border-border-strong bg-foreground text-background overflow-hidden shadow-lifted">
          <div className="flex items-center gap-2 px-4 h-9 border-b border-white/10 text-xs text-background/60 font-mono">
            terminal
          </div>
          <pre className="p-6 text-sm font-mono leading-relaxed overflow-x-auto">
            {`$ git clone github.com/selmansenol/loops
$ cd loops
$ cp .env.example .env

${t("landing.selfHostTerminalComment")}
$ echo "OPENAI_API_KEY=sk-..." >> .env

$ docker compose up -d

`}
            <span className="text-status-done">{t("landing.selfHostTerminalReady")}</span>
          </pre>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  const { t } = useTranslation();
  const feedbackSlug = useFeedbackSlug();
  return (
    <section className="mx-auto max-w-4xl px-6 py-24 text-center">
      <LoopMark className="!h-12 !w-12 mx-auto mb-6" />
      <h2 className="font-display text-4xl md:text-5xl font-medium tracking-tight">
        {t("landing.ctaTitle")}
      </h2>
      <p className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto">{t("landing.ctaLead")}</p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/demo"
          className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-6 py-3 text-sm font-medium hover:bg-foreground/90 transition-all shadow-card"
        >
          {t("landing.ctaPrimary")}
        </Link>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-6 py-3 text-sm font-medium hover:bg-accent transition-colors"
        >
          ★ {t("landing.starGitHub")}
        </a>
        {feedbackSlug && (
          <Link
            to="/$slug"
            params={{ slug: feedbackSlug }}
            className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-6 py-3 text-sm font-medium hover:bg-accent transition-colors"
          >
            💬 {t("landing.giveFeedback")}
          </Link>
        )}
      </div>
    </section>
  );
}
