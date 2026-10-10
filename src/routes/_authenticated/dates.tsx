import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarHeart, Check, ExternalLink, Gift, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { EmptyState, ListSkeleton } from "@/components/states";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/queries";
import {
  daysUntil,
  nextOccurrence,
  useCountdowns,
  useGifts,
  useSocialRealtime,
} from "@/lib/social";
import { useRequireSpace } from "@/lib/use-require-space";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dates")({
  head: () => ({
    meta: [
      { title: "Dates & gifts — Duo" },
      {
        name: "description",
        content: "Countdowns to the days that matter and a shared gift idea list.",
      },
      { property: "og:title", content: "Dates & gifts — Duo" },
      { property: "og:description", content: "Countdowns and gift ideas for two." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DatesPage,
});

const EMOJIS = ["✨", "💍", "🎂", "✈️", "🎄", "🌹", "🎉", "🏡"];

function DatesPage() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data } = useRequireSpace();
  const spaceId = data?.space.id;
  const { data: countdowns, isLoading } = useCountdowns(spaceId);
  const { data: gifts, isLoading: loadingGifts } = useGifts(spaceId);
  useSocialRealtime(spaceId, me?.id);
  const [tab, setTab] = useState<"dates" | "gifts">("dates");

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [emoji, setEmoji] = useState("✨");
  const [yearly, setYearly] = useState(false);
  const [gift, setGift] = useState({ title: "", url: "", price: "" });

  const partner = data?.members.find((m) => m.user_id !== me?.id);

  const sorted = (countdowns ?? [])
    .map((c) => ({ ...c, next: nextOccurrence(c.happens_at, c.repeats_yearly) }))
    .map((c) => ({ ...c, days: daysUntil(c.next) }))
    .sort((a, b) => (a.days < 0 ? 1e6 : a.days) - (b.days < 0 ? 1e6 : b.days));

  // Gifts I add are for my partner and hidden from them; they see only their own ideas for me.
  const visibleGifts = (gifts ?? []).filter((g) => g.created_by === me?.id);

  async function addCountdown() {
    if (!title.trim() || !date || !me || !spaceId) return;
    const { error } = await supabase.from("countdowns").insert({
      space_id: spaceId,
      created_by: me.id,
      title: title.trim().slice(0, 120),
      emoji,
      happens_at: date,
      repeats_yearly: yearly,
    });
    if (error) {
      toast.error("Couldn't add that date");
      return;
    }
    setTitle("");
    setDate("");
    setYearly(false);
    toast.success("Countdown added");
    void qc.invalidateQueries({ queryKey: ["countdowns", spaceId] });
  }

  async function removeCountdown(id: string) {
    await supabase.from("countdowns").delete().eq("id", id);
    void qc.invalidateQueries({ queryKey: ["countdowns", spaceId] });
  }

  async function addGift() {
    if (!gift.title.trim() || !me || !spaceId) return;
    const url = gift.url.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      toast.error("Links must start with http:// or https://");
      return;
    }
    const { error } = await supabase.from("gift_ideas").insert({
      space_id: spaceId,
      created_by: me.id,
      title: gift.title.trim().slice(0, 160),
      url: url || null,
      price: gift.price.trim().slice(0, 40) || null,
      for_user: partner?.user_id ?? null,
    });
    if (error) {
      toast.error("Couldn't save gift idea");
      return;
    }
    setGift({ title: "", url: "", price: "" });
    void qc.invalidateQueries({ queryKey: ["gift_ideas", spaceId] });
  }

  async function updateGift(id: string, patch: { claimed?: boolean }, remove = false) {
    if (remove) await supabase.from("gift_ideas").delete().eq("id", id);
    else await supabase.from("gift_ideas").update(patch).eq("id", id);
    void qc.invalidateQueries({ queryKey: ["gift_ideas", spaceId] });
  }

  const hero = sorted.find((c) => c.days >= 0);

  return (
    <AppShell title="Dates" subtitle="Countdowns & gifts">
      <div className="mb-5 flex rounded-full border border-border bg-card p-1 shadow-soft">
        {(["dates", "gifts"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-full py-2 text-sm font-bold capitalize transition-colors",
              tab === t ? "bg-gradient-candy text-white" : "text-muted-foreground",
            )}
          >
            {t === "dates" ? "Countdowns" : "Gift ideas"}
          </button>
        ))}
      </div>

      {tab === "dates" ? (
        <>
          {hero ? (
            <div className="bg-gradient-candy mb-5 rounded-[28px] p-6 text-white shadow-glow">
              <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-85">Next up</p>
              <p className="mt-1 font-display text-2xl font-extrabold">
                {hero.emoji} {hero.title}
              </p>
              <p className="mt-3 font-display text-6xl font-extrabold leading-none">
                {hero.days === 0 ? "Today!" : hero.days}
              </p>
              {hero.days > 0 ? (
                <p className="text-sm font-semibold opacity-85">
                  {hero.days === 1 ? "day to go" : "days to go"}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mb-6 rounded-3xl border border-border bg-card p-4 shadow-soft">
            <div className="hide-scrollbar mb-3 flex gap-1.5 overflow-x-auto">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-full text-lg",
                    emoji === e ? "bg-candy-soft ring-2 ring-candy" : "bg-secondary",
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Anniversary, trip, birthday…"
              maxLength={120}
              className="mb-2 h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none focus:border-candy"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11 flex-1 rounded-2xl border border-border bg-secondary px-3 text-sm outline-none"
              />
              <label className="flex items-center gap-2 rounded-2xl bg-secondary px-3 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={yearly}
                  onChange={(e) => setYearly(e.target.checked)}
                  className="accent-[var(--candy)]"
                />{" "}
                Yearly
              </label>
              <button
                onClick={addCountdown}
                aria-label="Add countdown"
                className="press bg-gradient-candy grid size-11 place-items-center rounded-2xl text-white"
              >
                <Plus className="size-5" />
              </button>
            </div>
          </div>

          {isLoading ? (
            <ListSkeleton />
          ) : sorted.length === 0 ? (
            <EmptyState
              icon={<CalendarHeart className="mx-auto size-7 text-candy" />}
              title="Nothing to count down to"
              body="Add your anniversary, next trip or a date night."
            />
          ) : (
            <div className="space-y-3">
              {sorted.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-4 rounded-3xl border border-border bg-card p-4 shadow-soft"
                >
                  <span className="grid size-12 place-items-center rounded-2xl bg-candy-soft text-2xl">
                    {c.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.next.toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {c.repeats_yearly ? " · every year" : ""}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "text-right font-display text-xl font-extrabold",
                      c.days < 0 ? "text-muted-foreground" : "text-candy",
                    )}
                  >
                    {c.days < 0 ? "Passed" : c.days === 0 ? "Today" : `${c.days}d`}
                  </p>
                  <button
                    aria-label="Delete"
                    onClick={() => removeCountdown(c.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <p className="mb-3 rounded-2xl bg-candy-soft px-4 py-3 text-xs font-semibold text-candy">
            🤫 Your gift ideas are a secret — {partner?.display_name ?? "your person"} can't see
            this list.
          </p>
          <div className="mb-6 space-y-2 rounded-3xl border border-border bg-card p-4 shadow-soft">
            <input
              value={gift.title}
              onChange={(e) => setGift({ ...gift, title: e.target.value })}
              placeholder="Gift idea"
              maxLength={160}
              className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none focus:border-candy"
            />
            <div className="flex gap-2">
              <input
                value={gift.url}
                onChange={(e) => setGift({ ...gift, url: e.target.value })}
                placeholder="Link (optional)"
                className="h-11 min-w-0 flex-1 rounded-2xl border border-border bg-secondary px-4 text-sm outline-none"
              />
              <input
                value={gift.price}
                onChange={(e) => setGift({ ...gift, price: e.target.value })}
                placeholder="Price"
                className="h-11 w-24 rounded-2xl border border-border bg-secondary px-3 text-sm outline-none"
              />
              <button
                onClick={addGift}
                aria-label="Add gift"
                className="press bg-gradient-candy grid size-11 place-items-center rounded-2xl text-white"
              >
                <Plus className="size-5" />
              </button>
            </div>
          </div>
          {loadingGifts ? (
            <ListSkeleton />
          ) : visibleGifts.length === 0 ? (
            <EmptyState
              icon={<Gift className="mx-auto size-7 text-candy" />}
              title="No gift ideas yet"
              body="Jot ideas down the moment you hear a hint."
            />
          ) : (
            <div className="space-y-3">
              {visibleGifts.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center gap-3 rounded-3xl border border-border bg-card p-4 shadow-soft"
                >
                  <button
                    onClick={() => updateGift(g.id, { claimed: !g.claimed })}
                    aria-label="Mark as bought"
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full border-2",
                      g.claimed
                        ? "bg-gradient-candy border-transparent text-white"
                        : "border-border",
                    )}
                  >
                    {g.claimed ? <Check className="size-4" /> : null}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate font-bold",
                        g.claimed && "text-muted-foreground line-through",
                      )}
                    >
                      {g.title}
                    </p>
                    {g.price ? <p className="text-xs text-muted-foreground">{g.price}</p> : null}
                  </div>
                  {g.url ? (
                    <a
                      href={g.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Open link"
                      className="text-muted-foreground hover:text-candy"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  ) : null}
                  <button
                    aria-label="Delete"
                    onClick={() => updateGift(g.id, {}, true)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
