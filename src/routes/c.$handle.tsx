import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";

import { daysBetween, formatShortDay } from "@/lib/format";
import { getPublicSpace } from "@/lib/public.functions";

const spaceQuery = (handle: string) =>
  queryOptions({
    queryKey: ["public-space", handle],
    queryFn: async () => {
      const space = await getPublicSpace({ data: { handle } });
      if (!space) throw notFound();
      return space;
    },
  });

export const Route = createFileRoute("/c/$handle")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(spaceQuery(params.handle)),
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return { meta: [{ title: "Page not found — Duo" }, { name: "robots", content: "noindex" }] };
    }
    const title = `${loaderData.name} on Duo`;
    const description = `Public moments shared by ${loaderData.name}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: `/c/${params.handle}` },
      ],
    };
  },
  errorComponent: () => (
    <div className="px-6 py-24 text-center text-sm text-muted-foreground">
      This page couldn&apos;t load right now.
    </div>
  ),
  notFoundComponent: () => (
    <div className="px-6 py-24 text-center">
      <h1 className="text-3xl">No such page</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This couple hasn&apos;t made a public page, or the link changed.
      </p>
    </div>
  ),
  component: PublicSpacePage,
});

function PublicSpacePage() {
  const { handle } = Route.useParams();
  const { data: space } = useSuspenseQuery(spaceQuery(handle));
  const days = space.anniversary_date ? daysBetween(space.anniversary_date) : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
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

      <div className="mx-auto max-w-4xl px-6 pb-20">
        <h1 className="text-5xl leading-tight">{space.name}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {days !== null ? `${days.toLocaleString()} days together · ` : ""}
          {space.moments.length} public moment{space.moments.length === 1 ? "" : "s"}
        </p>

        {space.moments.length === 0 ? (
          <p className="mt-12 rounded-3xl border border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
            Nothing public here yet.
          </p>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {space.moments.map((moment) => (
              <article
                key={moment.id}
                className="overflow-hidden rounded-3xl border border-border bg-card"
              >
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
                    {formatShortDay(moment.taken_at)}
                  </p>
                  {moment.caption ? (
                    <p className="text-[15px] leading-relaxed text-foreground/90">
                      {moment.caption}
                    </p>
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
