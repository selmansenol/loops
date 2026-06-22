import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter, GITHUB_URL } from "@/components/site-header";

export const Route = createFileRoute("/vs/canny")({
  head: () => ({
    meta: [
      { title: "Loops vs Canny — Open-source Canny alternative" },
      {
        name: "description",
        content:
          "Looking for a Canny alternative? Loops is a free, open-source, self-hostable feedback board with built-in AI. Compare Loops vs Canny: pricing, open source, AI, self-hosting and integrations.",
      },
      { property: "og:title", content: "Loops vs Canny — Open-source Canny alternative" },
      {
        property: "og:description",
        content: "Free, open-source, AI-native Canny alternative. Self-host or use getloops.co.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://getloops.co/vs/canny" },
      { property: "og:image", content: "https://getloops.co/og.png" },
    ],
  }),
  component: VsCanny,
});

const WINS: Array<[string, string]> = [
  ["Open source (MIT)", "Self-host anywhere; own your data. Canny is closed-source SaaS only."],
  [
    "Free",
    "Use it for free — hosted on getloops.co or self-hosted. Canny's paid plans start high.",
  ],
  ["Bring your own AI key", "Use your own OpenAI, Anthropic or Gemini key and pick the model."],
  [
    "AI-native by default",
    "Duplicate detection, conversational capture, AI roadmap and clustering/insights built in.",
  ],
  ["Guest voting", "Visitors vote without creating an account (IP-deduplicated)."],
  ["One-command self-host", "npx create-loops, or Docker Compose. 17 languages + RTL."],
];

const CANNY_HAS: Array<[string, string]> = [
  ["Deep 2-way integrations", "Intercom, Zendesk, Jira/Linear two-way sync, Salesforce, Segment."],
  ["Revenue-weighted priority", "Tie feedback to MRR and company/user segments."],
  ["SSO / SAML & private boards", "Enterprise auth and internal boards with granular roles."],
  ["Email digests", "Scheduled summary emails to your team."],
  ["Maturity & support", "Battle-tested at scale with dedicated support."],
];

function VsCanny() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-14">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Comparison</p>
        <h1 className="font-display text-4xl md:text-5xl font-medium tracking-tight">
          Loops vs Canny
        </h1>
        <p className="text-lg text-muted-foreground mt-4 leading-relaxed">
          <strong>Loops is an open-source Canny alternative.</strong> If you want a feedback board
          where users post requests, vote and discuss — plus a roadmap, a changelog and AI that
          organizes everything — but you'd rather it be <strong>free</strong>,{" "}
          <strong>open source</strong> and <strong>self-hostable</strong>, Loops is for you.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/demo"
            className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:bg-foreground/90"
          >
            Try the live demo →
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-5 py-2.5 text-sm font-medium hover:bg-accent"
          >
            ★ Star on GitHub
          </a>
        </div>

        <Section title="Where Loops wins">
          {WINS.map(([h, d]) => (
            <Row key={h} head={h} desc={d} good />
          ))}
        </Section>

        <Section title="Where Canny is still ahead (our roadmap)">
          <p className="text-sm text-muted-foreground mb-4">
            Being honest: Canny is a mature product. These are areas we don't fully cover yet —
            several are on our roadmap.
          </p>
          {CANNY_HAS.map(([h, d]) => (
            <Row key={h} head={h} desc={d} />
          ))}
        </Section>

        <div className="mt-12 rounded-3xl border border-border bg-surface p-8 text-center">
          <h2 className="font-display text-2xl font-medium tracking-tight">
            Try the open-source Canny alternative
          </h2>
          <p className="text-muted-foreground mt-2">
            Spin up a board in seconds on getloops.co, or self-host with one command.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:bg-foreground/90"
            >
              Get started free
            </Link>
            <Link
              to="/docs"
              className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-5 py-2.5 text-sm font-medium hover:bg-accent"
            >
              Read the docs
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl font-medium tracking-tight mb-5">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({ head, desc, good }: { head: string; desc: string; good?: boolean }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-border bg-surface p-4">
      <span className={`shrink-0 text-lg ${good ? "text-status-done" : "text-muted-foreground"}`}>
        {good ? "✓" : "•"}
      </span>
      <div>
        <p className="font-medium">{head}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
