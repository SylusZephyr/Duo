import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy, Images, Sparkle } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { MomentCard } from "@/components/moment-card";
import { EmptyState, ErrorState, FeedSkeleton } from "@/components/states";
import { daysBetween } from "@/lib/format";
import { useDailyPrompt, useMe, useMoments } from "@/lib/queries";
import { useSpaceRealtime } from "@/lib/realtime";
import { useRequireSpace } from "@/lib/use-require-space";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({
    meta: [
      { title: "Your moments — Duo" },
      {
        name: "description",
        content: "The private feed of moments you and your person share.",
      },
      { property: "og:title", content: "Your moments — Duo" },
      { property: "og:description", content: "A feed only the two of you can see." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FeedPage,
});

function FeedPage() {
  const { data: me } = useMe();
  const { data, isLoading } = useRequireSpace();
  const spaceId = data?.space.id;
  const {
    data: moments,
    isLoading: loadingMoments,
    isError,
    refetch,
  } = useMoments(spaceId);
  const { data: prompt } = useDailyPrompt(spaceId);

  useSpaceRealtime(spaceId);

  const days = data?.space.anniversary_date ? daysBetween(data.space.anniversary_date) : null;
  const alone = (data?.members.length ?? 0) < 2;

  return (
    <AppShell
      title={data?.space.name ?? "Moments"}
      subtitle={days !== null ? `${days.toLocaleString()} days together` : "Just the two of you"}
    >
      {alone && data ? (
        <button
          onClick={() => {
            navigator.clipboard.writeText(data.space.invite_code);
            toast.success("Invite code copied");
          }}
          className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-ember/30 bg-ember/5 px-4 py-3.5 text-left"
        >
          <div className="flex-1">
            <p className="text-sm">Invite your person</p>
            <p className="text-xs text-muted-foreground">
              Share code <span className="font-mono text-gold">{data.space.invite_code}</span>
            </p>
          </div>
          <Copy className="size-4 text-muted-foreground" />
        </button>
      ) : null}

      {prompt ? (
        <Link
          to="/journal"
          className="mb-5 block rounded-2xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-gold/40"
        >
          <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-gold">
            <Sparkle className="size-3" /> Today's question
          </p>
          <p className="mt-1.5 text-[15px] leading-relaxed">{prompt.body}</p>
        </Link>
      ) : null}

      {isError ? (
        <ErrorState
          title="Your feed didn't load"
          body="We couldn't reach your space just now."
          onRetry={() => void refetch()}
        />
      ) : isLoading || loadingMoments ? (
        <FeedSkeleton />
      ) : (moments ?? []).length === 0 ? (
        <EmptyState
          icon={<Images className="mx-auto size-7" />}
          title="Nothing here yet"
          body="Add your first photo and it becomes a pin on your map, a page in your story."
          action={
            <Link
              to="/compose"
              className="inline-flex h-11 items-center rounded-full bg-ember px-6 text-sm font-medium text-ember-foreground"
            >
              Add a moment
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          {groupByMonth(moments ?? []).map(([label, group]) => (
            <section key={label}>
              <h2 className="sticky top-0 z-10 -mx-1 mb-3 bg-background/85 px-1 py-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground backdrop-blur">
                {label}
              </h2>
              <div className="space-y-5">
                {group.map((moment, i) => (
                  <div key={moment.id} className="duo-rise" style={{ animationDelay: `${i * 40}ms` }}>
                    <MomentCard
                      moment={moment}
                      members={data?.members ?? []}
                      userId={me?.id}
                      spaceId={spaceId}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}

/** Feed reads as a story: moments collect under the month they happened in. */
function groupByMonth<T extends { taken_at: string }>(moments: T[]) {
  const groups = new Map<string, T[]>();
  for (const moment of moments) {
    const label = new Date(moment.taken_at).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
    const bucket = groups.get(label);
    if (bucket) bucket.push(moment);
    else groups.set(label, [moment]);
  }
  return Array.from(groups.entries());
}
