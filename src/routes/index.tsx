import { createFileRoute, Link } from "@tanstack/react-router";
import { BookHeart, Globe2, Images, Map } from "lucide-react";

import heroImage from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Duo — the private social app for two" },
      {
        name: "description",
        content:
          "Duo is a private space for couples: a shared feed of moments, a world map of the places you've been, a journal with sealed letters, and milestones worth keeping.",
      },
      { property: "og:title", content: "Duo — the private social app for two" },
      {
        property: "og:description",
        content: "A shared feed, a world map, a journal and your milestones — just the two of you.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Images,
    title: "A feed for two",
    body: "Photos, captions, little reactions. No followers, no algorithm, no performance.",
  },
  {
    icon: Map,
    title: "Your world, pinned",
    body: "Tag a place and it becomes a pin. Zoom from the whole planet down to the street you kissed on.",
  },
  {
    icon: BookHeart,
    title: "Journal & sealed letters",
    body: "Write together, or seal a letter that stays hidden until the date you choose.",
  },
  {
    icon: Globe2,
    title: "Share when you want",
    body: "Every moment is private by default. Flip one public and it appears on your shared page.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="font-display text-2xl">Duo</span>
        <nav className="flex items-center gap-5 text-sm">
          <Link to="/explore" className="text-muted-foreground transition-colors hover:text-foreground">
            Explore
          </Link>
          <Link
            to="/auth"
            className="rounded-full bg-ember px-5 py-2 text-sm font-medium text-ember-foreground"
          >
            Start
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-5xl px-6 pt-10 pb-16">
        <p className="text-xs uppercase tracking-[0.28em] text-gold">A space for two</p>
        <h1 className="mt-5 max-w-3xl text-balance-tight text-5xl leading-[1.02] md:text-7xl">
          Everything you two make together, in one private place.
        </h1>
        <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Duo holds your photos, the places you&apos;ve been, the things you write and the milestones
          you pass. Only the two of you are inside — until you decide to let the world see something.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link
            to="/auth"
            className="inline-flex h-12 items-center rounded-full bg-ember px-7 text-sm font-medium text-ember-foreground"
          >
            Create your space
          </Link>
          <Link
            to="/explore"
            className="inline-flex h-12 items-center rounded-full border border-border px-7 text-sm"
          >
            See public moments
          </Link>
        </div>

        <div className="mt-14 overflow-hidden rounded-[2rem] border border-border">
          <img
            src={heroImage}
            alt="Two hands together on dark linen surrounded by printed photographs and a folded map"
            width={1600}
            height={1200}
            className="h-[46vh] w-full object-cover md:h-[62vh]"
          />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-3xl border border-border bg-card p-6">
              <feature.icon className="size-5 text-ember" />
              <h2 className="mt-4 text-2xl">{feature.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 px-6 py-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between text-xs text-muted-foreground">
          <span className="font-display text-base text-foreground">Duo</span>
          <Link to="/auth">Sign in</Link>
        </div>
      </footer>
    </div>
  );
}
