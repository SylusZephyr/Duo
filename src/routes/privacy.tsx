import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, Section } from "@/components/legal-page";
import { SUPPORT_EMAIL, STORY_RETENTION_HOURS } from "@/lib/legal";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — Duo" },
      {
        name: "description",
        content:
          "What Duo stores, who can see it, how long it is kept, and how to export or delete it.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage title="Privacy">
      <p className="text-[15px] leading-relaxed">
        Duo is a private space for two people. This page describes exactly what it stores, who can
        read it, and how to take it back. It is written to be read, not to be survived.
      </p>

      <Section title="What we store">
        <p>
          <strong className="text-foreground">Your account.</strong> An email address and a password
          hash, held by our authentication provider. We never see your password.
        </p>
        <p>
          <strong className="text-foreground">What you put in.</strong> Your display name, handle
          and bio; the photos, captions, places and dates of your moments; journal entries,
          messages, milestones, bucket-list items, countdowns, gift ideas, stories, game answers and
          prompt answers. All of it because you typed or uploaded it.
        </p>
        <p>
          <strong className="text-foreground">What the app derives.</strong> Notifications, streaks
          and badges, computed from the above.
        </p>
        <p>
          We do not run advertising, we do not sell data, and there are no third-party analytics or
          tracking scripts in the app.
        </p>
      </Section>

      <Section title="Who can see it">
        <p>
          Everything in your space is readable only by the two people in that space. This is
          enforced in the database with row-level security, not only in the interface — a request
          for someone else&apos;s space returns nothing, even if the app is modified.
        </p>
        <p>
          The one exception is a moment you explicitly mark public. Those appear on Explore and on
          your space&apos;s public page, visible to anyone with the link. You can un-publish a
          moment at any time; copies other people already made are, inevitably, beyond our reach.
        </p>
        <p>
          A moderator can view a public moment that has been reported, in order to review the
          report. Private moments are never in that queue.
        </p>
      </Section>

      <Section title="Who we share it with">
        <p>
          Only the services needed to run the app: Supabase (database, authentication, file storage)
          and Cloudflare (hosting and content delivery). Place search and address lookup send the
          text of your query — not your account or your space — to Google Maps Platform.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          Your content stays until you delete it. Stories expire on their own after{" "}
          {STORY_RETENTION_HOURS} hours. Deleting your account removes your records immediately,
          with the one shared-history exception below; backups roll off within 30 days.
        </p>
      </Section>

      <Section title="Getting your data out">
        <p>
          Settings → Your data → <strong className="text-foreground">Export</strong> downloads one
          JSON file containing your account, your space and everything in it, plus hour-long
          download links for every photo. No request, no waiting period.
        </p>
      </Section>

      <Section title="Deleting your account">
        <p>
          Settings → Your data → <strong className="text-foreground">Delete account</strong>. It is
          immediate and irreversible, and it removes your account, profile, notifications, reactions
          and preferences.
        </p>
        <p>
          <strong className="text-foreground">
            What happens to moments you shared with your partner is the part worth reading before
            you press it.
          </strong>{" "}
          A space belongs to both of you, so your leaving does not erase it. Posts, comments,
          messages and journal entries you wrote stay in the space for your partner, with your name
          removed — they show as written by a deleted account. We chose this because the other
          person&apos;s copy of a shared memory is theirs too, and one partner should not be able to
          delete the other&apos;s history.
        </p>
        <p>
          If you were the last member of the space, there is nobody left for it to belong to: the
          space and everything in it is deleted with your account.
        </p>
        <p>
          If you want the shared content gone as well, delete those moments individually before
          deleting your account.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          If the GDPR or the CCPA applies to you, the export and deletion controls above are how you
          exercise your rights of access, portability and erasure directly. For correction,
          restriction, objection, or any question about this policy, write to{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-foreground underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </Section>

      <Section title="Children">
        <p>
          Duo is not for anyone under 13, and we do not knowingly keep accounts for them. Tell us at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-foreground underline">
            {SUPPORT_EMAIL}
          </a>{" "}
          if you believe a child has created one and we will remove it.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If this policy changes in a way that affects what we do with your data, we will say so in
          the app before the change takes effect. The date at the top is the version you are
          reading.
        </p>
      </Section>
    </LegalPage>
  );
}
