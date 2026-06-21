import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-header";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Loops · Terms of Service" },
      { name: "description", content: "Terms of Service for getloops.co." },
    ],
  }),
  component: TermsPage,
});

const UPDATED = "21 June 2026";
const CONTACT = "support@getloops.co";

function TermsPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Legal</p>
        <h1 className="font-display text-4xl font-medium tracking-tight">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mt-2">Last updated: {UPDATED}</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
          <Section title="1. Acceptance">
            By creating an account or using <strong>getloops.co</strong> (the “Service”), you agree
            to these Terms. If you don’t agree, don’t use the Service. The Service is operated from
            Türkiye and provided by the Loops maintainers (“we”, “us”).
          </Section>

          <Section title="2. The Service">
            Loops is an open-source feedback board. The hosted version at getloops.co lets you
            create boards where users post feature requests, vote, comment, and view a roadmap and
            changelog. The hosted Service is currently offered free of charge and may change, be
            limited, or be discontinued at any time. The source code is available under the MIT
            license for self-hosting.
          </Section>

          <Section title="3. Accounts">
            You must provide a valid email address and keep your credentials secure. You are
            responsible for all activity under your account and for the content on boards you own or
            administer. You must be old enough to form a binding contract in your jurisdiction.
          </Section>

          <Section title="4. Acceptable use">
            You agree not to: post unlawful, infringing, hateful, or abusive content; spam or
            manipulate votes; upload malware; attempt to breach, overload, or reverse-engineer the
            Service’s infrastructure; or use the Service to violate others’ rights. We may remove
            content or suspend accounts that break these rules.
          </Section>

          <Section title="5. Your content">
            You retain ownership of the content you submit. You grant us a non-exclusive license to
            host, store, and display that content as needed to operate the Service. Public boards
            are public by design — anything you post to a public board can be seen by anyone with
            the link. You are responsible for ensuring you have the right to post your content.
          </Section>

          <Section title="6. AI features">
            AI features (duplicate detection, conversational capture, roadmap, insights) use an AI
            provider key that <strong>you</strong> supply per workspace. When you use them, relevant
            board content is sent to your chosen provider (e.g. OpenAI, Anthropic, Google) and is
            subject to that provider’s terms and privacy policy. We are not responsible for the
            provider’s processing of that data.
          </Section>

          <Section title="7. Availability & “as is”">
            The Service is provided <strong>“as is”</strong> and <strong>“as available”</strong>,
            without warranties of any kind. We do not guarantee uptime, error-free operation, or
            that data will never be lost. To the maximum extent permitted by law, we are not liable
            for any indirect, incidental, or consequential damages, or for loss of data or profits,
            arising from your use of the Service.
          </Section>

          <Section title="8. Termination">
            You may stop using the Service and delete your account at any time. We may suspend or
            terminate accounts that violate these Terms or where required by law. You can also
            self-host Loops to run the software entirely under your own control.
          </Section>

          <Section title="9. Changes">
            We may update these Terms. Material changes will be reflected by the “Last updated” date
            above. Continued use after changes means you accept the updated Terms.
          </Section>

          <Section title="10. Contact">
            Questions about these Terms? Email{" "}
            <a href={`mailto:${CONTACT}`} className="text-primary hover:underline">
              {CONTACT}
            </a>
            .
          </Section>
        </div>

        <div className="mt-10 pt-6 border-t border-border text-sm">
          <Link to="/privacy" className="text-primary hover:underline">
            Privacy Policy →
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
      <p className="text-muted-foreground">{children}</p>
    </section>
  );
}
