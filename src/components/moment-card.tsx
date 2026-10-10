import { Globe2, Lock, MapPin, MessageCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { SignedImage } from "@/components/signed-image";
import { placeLabel, relativeTime } from "@/lib/format";
import { moodOf } from "@/lib/moods";
import type { Member, Moment } from "@/lib/queries";
import { useToggleReaction } from "@/lib/queries";

const EMOJIS = ["❤️", "🔥", "🥹", "😂"];

export function MomentCard({
  moment,
  members,
  userId,
  spaceId,
}: {
  moment: Moment;
  members: Member[];
  userId: string | undefined;
  spaceId: string | undefined;
}) {
  const author = members.find((m) => m.user_id === moment.author_id);
  const toggle = useToggleReaction(spaceId);
  const place = placeLabel(moment);
  const mood = moodOf(moment.mood);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const [burst, setBurst] = useState(false);

  function love() {
    if (!userId) return;
    const mine = moment.reactions.find((r) => r.emoji === "❤️" && r.user_id === userId);
    if (!mine) {
      setBurst(true);
      window.setTimeout(() => setBurst(false), 700);
      toggle.mutate({ postId: moment.id, emoji: "❤️", userId });
    }
  }

  return (
    <article className="overflow-hidden rounded-3xl border border-border/70 bg-card">
      <header className="flex items-center gap-3 px-4 py-3.5">
        <div className="size-9 overflow-hidden rounded-full bg-secondary ring-1 ring-ember/25">
          {author?.avatar_url ? (
            <img src={author.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {author?.display_name ?? "Someone"}
            {mood ? <span className="ml-1.5 text-muted-foreground">{mood.emoji}</span> : null}
          </p>
          <p className="truncate text-xs text-muted-foreground">{relativeTime(moment.taken_at)}</p>
        </div>
        <span className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {moment.visibility === "public" ? (
            <>
              <Globe2 className="size-3" /> Public
            </>
          ) : (
            <>
              <Lock className="size-3" /> Just us
            </>
          )}
        </span>
      </header>

      {moment.media.length > 0 ? (
        <div className="relative" onDoubleClick={love}>
          <div
            ref={scrollerRef}
            onScroll={(event) => {
              const el = event.currentTarget;
              const next = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
              if (next !== index) setIndex(next);
            }}
            className="hide-scrollbar flex snap-x snap-mandatory overflow-x-auto"
          >
            {moment.media.map((media) => (
              <SignedImage
                key={media.id}
                path={media.storage_path}
                blurDataUrl={media.blur_data_url}
                alt={moment.caption || "Shared moment"}
                className="aspect-[4/5] w-full shrink-0 snap-center"
              />
            ))}
          </div>

          {moment.media.length > 1 ? (
            <>
              <span className="absolute right-3 top-3 rounded-full bg-background/70 px-2 py-0.5 text-[10px] tabular-nums text-foreground/80 backdrop-blur">
                {index + 1}/{moment.media.length}
              </span>
              <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                {moment.media.map((media, i) => (
                  <span
                    key={media.id}
                    className={`size-1.5 rounded-full transition-all duration-300 ${
                      i === index ? "w-4 bg-gold" : "bg-foreground/35"
                    }`}
                  />
                ))}
              </div>
            </>
          ) : null}

          {burst ? (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-6xl duo-burst">
              ❤️
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3 px-4 py-4">
        {place ? (
          <p className="flex items-center gap-1.5 text-xs text-gold">
            <MapPin className="size-3.5" /> {place}
          </p>
        ) : null}
        {moment.caption ? (
          <p className="text-[15px] leading-relaxed text-foreground/90">{moment.caption}</p>
        ) : null}

        <div className="flex items-center gap-1.5 pt-1">
          {EMOJIS.map((emoji) => {
            const mine = moment.reactions.find((r) => r.emoji === emoji && r.user_id === userId);
            const count = moment.reactions.filter((r) => r.emoji === emoji).length;
            return (
              <button
                key={emoji}
                onClick={() =>
                  userId &&
                  toggle.mutate({
                    postId: moment.id,
                    emoji,
                    userId,
                    ...(mine ? { existingId: mine.id } : {}),
                  })
                }
                className={`rounded-full border px-2.5 py-1 text-sm transition-all active:scale-90 ${
                  mine ? "border-ember/60 bg-ember/10" : "border-border hover:border-ember/40"
                }`}
              >
                {emoji}
                {count > 0 ? (
                  <span className="ml-1 text-xs text-muted-foreground">{count}</span>
                ) : null}
              </button>
            );
          })}
          <Link
            to="/moment/$momentId"
            params={{ momentId: moment.id }}
            className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <MessageCircle className="size-4" />
            {moment.comment_count > 0 ? moment.comment_count : "Say something"}
          </Link>
        </div>
      </div>
    </article>
  );
}
