import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-header";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Loops · Privacy Policy" },
      { name: "description", content: "Privacy Policy for getloops.co." },
    ],
  }),
  component: PrivacyPage,
});

const UPDATED = "21 June 2026";
const CONTACT = "support@getloops.co";

function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Legal</p>
        <h1 className="font-display text-4xl font-medium tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mt-2">Last updated: {UPDATED}</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
          <Section title="Overview">
            This policy explains what data <strong>getloops.co</strong> collects and how we use it.
            If you self-host Loops, you control your own data and this policy does not apply to your
            instance.
          </Section>

          <Section title="What we collect">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Account data:</strong> your email address, display name, and (if you use
                social login) basic profile info from Google/GitHub.
              </li>
              <li>
                <strong>Content you create:</strong> boards, posts, comments, votes, and settings.
              </li>
              <li>
                <strong>Technical data:</strong> a session cookie to keep you signed in, and basic
                server logs (e.g. IP address, request time) used for security and debugging.
              </li>
            </ul>
          </Section>

          <Section title="How we use it">
            To operate the Service: authenticate you, store and display your boards, prevent abuse,
            and fix problems. We do <strong>not</strong> sell your personal data or use it for
            third-party advertising.
          </Section>

          <Section title="Email">
            We use <strong>Resend</strong> to send transactional emails (email verification and
            password reset). Your email address is shared with Resend solely to deliver these
            messages.
          </Section>

          <Section title="AI providers">
            AI features use an API key <strong>you</strong> provide per workspace. When you run
            them, relevant board content is sent to the AI provider you chose (OpenAI, Anthropic, or
            Google) to generate the result. That processing is governed by the provider’s own
            privacy policy. We store your provider key only to make those calls on your behalf.
          </Section>

          <Section title="Cookies">
            We use a single essential cookie for your authenticated session. We do not use
            third-party tracking or advertising cookies.
          </Section>

          <Section title="Public content">
            Content on a public board (posts, comments, votes, roadmap, changelog) is visible to
            anyone with the link. Don’t post anything there you wish to keep private.
          </Section>

          <Section title="Retention & deletion">
            We keep your data while your account is active. You can delete posts and comments, and
            you can request deletion of your account and associated data by emailing us. Backups are
            retained for a limited period and then rotated out.
          </Section>

          <Section title="Children">
            The Service is not directed to children under 13 (or the minimum age required in your
            country). We don’t knowingly collect their data.
          </Section>

          <Section title="Changes">
            We may update this policy; the “Last updated” date above reflects the latest version.
          </Section>

          <Section title="Contact">
            Privacy questions or deletion requests:{" "}
            <a href={`mailto:${CONTACT}`} className="text-primary hover:underline">
              {CONTACT}
            </a>
            .
          </Section>
        </div>

        <div className="mt-10 pt-6 border-t border-border text-sm">
          <Link to="/terms" className="text-primary hover:underline">
            Terms of Service →
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg font-medium tracking-tight mb-1.5">{title}</h2>
      <div className="text-muted-foreground">{children}</div>
    </section>
  );
}
