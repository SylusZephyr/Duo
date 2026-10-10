import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";

import { listPublicMoments } from "@/lib/public.functions";
import { formatShortDay } from "@/lib/format";

const publicMomentsQuery = queryOptions({
  queryKey: ["public-moments"],
  queryFn: () => listPublicMoments(),
});

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore public moments — Duo" },
      {
        name: "description",
        content: "Moments couples chose to share with the world: photos, places and small stories.",
      },
      { property: "og:title", content: "Explore public moments — Duo" },
      { property: "og:description", content: "Photos and places couples chose to share publicly." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicMomentsQuery),
  errorComponent: () => (
    <div className="px-6 py-24 text-center text-sm text-muted-foreground">
      Explore couldn&apos;t load right now. Try refreshing.
    </div>
  ),
  notFoundComponent: () => (
    <div className="px-6 py-24 text-center text-sm text-muted-foreground">Nothing here.</div>
  ),
  component: ExplorePage,
});

function ExplorePage() {
  const { data: moments } = useSuspenseQuery(publicMomentsQuery);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link to="/" className="font-display text-2xl">
          Duo
        </Link>
        <Link
          to="/auth"
          className="rounded-full bg-ember px-5 py-2 text-sm font-medium text-ember-foreground"
        >
          Start yours
        </Link>
      </header>

      <div className="mx-auto max-w-5xl px-6 pb-20">
        <h1 className="text-5xl leading-tight">Shared with the world.</h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
          Everything below was private first. These are the moments couples chose to let out.
        </p>

        {moments.length === 0 ? (
          <p className="mt-12 rounded-3xl border border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
            No public moments yet. Be the first.
          </p>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {moments.map((moment) => (
              <article key={moment.id} className="overflow-hidden rounded-3xl border border-border bg-card">
                {moment.photos[0] ? (
                  <img
                    src={moment.photos[0]}
                    alt={moment.caption || "A shared moment"}
                    loading="lazy"
                    className="aspect-[4/5] w-full object-cover"
                  />
                ) : null}
                <div className="space-y-2 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {moment.space.handle ? (
                      <Link to="/c/$handle" params={{ handle: moment.space.handle }} className="text-gold">
                        {moment.space.name}
                      </Link>
                    ) : (
                      moment.space.name
                    )}{" "}
                    · {formatShortDay(moment.taken_at)}
                  </p>
                  {moment.caption ? (
                    <p className="text-[15px] leading-relaxed text-foreground/90">{moment.caption}</p>
                  ) : null}
                  {moment.place_name || moment.city ? (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="size-3.5" />
                      {[moment.place_name, moment.city, moment.country].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
