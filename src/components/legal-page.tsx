import { Link } from "@tanstack/react-router";

import { LEGAL_LAST_UPDATED } from "@/lib/legal";

/**
 * Shell for the privacy policy and terms.
 *
 * Reachable without an account on purpose: someone deciding whether to sign up
 * needs to read these first, and an app store or a payment processor will
 * fetch them unauthenticated.
 */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link to="/" className="font-display text-2xl">
          Duo
        </Link>
        <Link
          to="/auth"
          className="rounded-full bg-ember px-5 py-2 text-sm font-medium text-ember-foreground"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24">
        <h1 className="font-display text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated {LEGAL_LAST_UPDATED}</p>

        <div className="mt-10 space-y-8">{children}</div>

        <nav className="mt-16 flex gap-4 border-t border-border pt-6 text-xs text-muted-foreground">
          <Link to="/privacy" className="underline-offset-2 hover:underline">
            Privacy
          </Link>
          <span>·</span>
          <Link to="/terms" className="underline-offset-2 hover:underline">
            Terms
          </Link>
          <span>·</span>
          <Link to="/" className="underline-offset-2 hover:underline">
            Home
          </Link>
        </nav>
      </main>
    </div>
  );
}

/** A titled run of prose. Keeps heading sizes consistent across both docs. */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
