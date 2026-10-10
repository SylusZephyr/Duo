import { createFileRoute, Link } from "@tanstack/react-router";

import { LegalPage, Section } from "@/components/legal-page";
import { SUPPORT_EMAIL } from "@/lib/legal";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms — Duo" },
      {
        name: "description",
        content: "The rules for using Duo: who owns what, what is not allowed, and the limits.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage title="Terms of use">
      <p className="text-[15px] leading-relaxed">
        These are the terms you agree to by creating an account. They are short on purpose.
      </p>

      <Section title="Your account">
        <p>
          You must be 13 or older. One person per account — a space holds two accounts, not one
          shared login, so that each of you can leave with your own data.
        </p>
        <p>Keep your password to yourself. Anyone holding it can read everything in your space.</p>
      </Section>

      <Section title="Your content stays yours">
        <p>
          You own what you upload. You give us only the permission needed to run the app: to store
          your content, and to display it to you, to your partner, and — for moments you mark public
          — to anyone who visits Explore or your public page. That permission ends when you delete
          the content, apart from backups rolling off and any copies other people already made of
          something you had published.
        </p>
      </Section>

      <Section title="What is not allowed">
        <p>
          Do not publish sexual content, content involving a minor, violence or gore, hate speech,
          harassment, spam or scams. Do not publish someone else&apos;s private photos or
          information without their agreement, and do not upload what you have no right to.
        </p>
        <p>
          Do not try to reach another space&apos;s data, hammer the service, or get around its
          limits.
        </p>
        <p>
          Anyone signed in can report a public moment. A moderator may take it down from Explore and
          public pages; it stays in the couple&apos;s own space. Repeated or severe violations can
          cost you the account.
        </p>
      </Section>

      <Section title="Ending it">
        <p>
          You can delete your account at any time from Settings — see the{" "}
          <Link to="/privacy" className="text-foreground underline">
            privacy policy
          </Link>{" "}
          for exactly what that removes and what stays with your partner. We may suspend or close an
          account that breaks these terms, and will say why where we can.
        </p>
      </Section>

      <Section title="What we do not promise">
        <p>
          Duo is provided as it is, without warranty. We work to keep it available and your data
          intact, but we do not guarantee uninterrupted service or that nothing will ever be lost.
          Export anything you would be upset to lose.
        </p>
        <p>
          To the extent the law allows, we are not liable for indirect or consequential loss, and
          our total liability is limited to what you have paid us — which, on the free tier, is
          nothing.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          We will announce a material change in the app before it takes effect. Continuing to use
          Duo afterwards means you accept the new version.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-foreground underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </Section>
    </LegalPage>
  );
}
