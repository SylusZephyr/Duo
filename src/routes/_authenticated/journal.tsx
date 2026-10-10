import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, PenLine, Search, Unlock } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatDay } from "@/lib/format";
import { MOODS, moodOf } from "@/lib/moods";
import { useJournal, useMe } from "@/lib/queries";
import { useRequireSpace } from "@/lib/use-require-space";

export const Route = createFileRoute("/_authenticated/journal")({
  head: () => ({
    meta: [
      { title: "Journal — Duo" },
      { name: "description", content: "Write together, or seal a letter to open on a future date." },
      { property: "og:title", content: "Journal — Duo" },
      { property: "og:description", content: "Shared entries and sealed letters." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: JournalPage,
});

type Filter = "all" | "shared" | "sealed";

function JournalPage() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { data } = useRequireSpace();
  const { data: entries } = useJournal(data?.space.id);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [sealUntil, setSealUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const list = entries ?? [];

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return list.filter((entry) => {
      const locked = entry.is_sealed && entry.unlock_at && new Date(entry.unlock_at) > new Date();
      if (filter === "sealed" && !entry.is_sealed) return false;
      if (filter === "shared" && entry.is_sealed) return false;
      if (!needle) return true;
      if (locked) return false;
      return `${entry.title} ${entry.body}`.toLowerCase().includes(needle);
    });
  }, [list, filter, query]);

  const sealedCount = list.filter(
    (entry) => entry.is_sealed && entry.unlock_at && new Date(entry.unlock_at) > new Date(),
  ).length;

  async function save() {
    if (!me || !data || body.trim().length === 0) {
      toast.error("Write something first");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("journal_entries").insert({
        space_id: data.space.id,
        author_id: me.id,
        title: title.trim().slice(0, 120) || "Untitled",
        body: body.trim().slice(0, 10000),
        mood,
        is_sealed: Boolean(sealUntil),
        unlock_at: sealUntil ? new Date(sealUntil + "T09:00:00").toISOString() : null,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["journal", data.space.id] });
      setTitle("");
      setBody("");
      setMood(null);
      setSealUntil("");
      setOpen(false);
      toast.success(sealUntil ? "Sealed until then" : "Entry saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save that entry");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      title="Journal"
      subtitle={
        sealedCount > 0
          ? `${list.length} entries · ${sealedCount} sealed`
          : `${list.length} entries`
      }
      action={
        <button
          onClick={() => setOpen((value) => !value)}
          className="rounded-full border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Write an entry"
        >
          <PenLine className="size-4" />
        </button>
      }
    >
      {open ? (
        <div className="duo-rise mb-6 space-y-4 rounded-3xl border border-border bg-card p-5">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            placeholder="Title"
            className="h-12 rounded-2xl bg-secondary/40 font-display text-lg"
          />
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={10000}
            placeholder="Today…"
            className="min-h-40 rounded-2xl border-border bg-secondary/40 text-[15px] leading-relaxed"
          />
          <div className="space-y-2">
            <Label>How it felt</Label>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setMood(mood === option.key ? null : option.key)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    mood === option.key
                      ? "border-gold/60 bg-gold/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-gold/40"
                  }`}
                >
                  <span className="text-sm">{option.emoji}</span>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="seal">Seal until (optional)</Label>
            <Input
              id="seal"
              type="date"
              value={sealUntil}
              onChange={(event) => setSealUntil(event.target.value)}
              className="h-12 rounded-2xl bg-secondary/40"
            />
            <p className="text-xs text-muted-foreground">
              Sealed entries stay hidden — even from each other — until the date arrives.
            </p>
          </div>
          <Button
            onClick={save}
            disabled={busy}
            className="h-12 w-full rounded-2xl bg-ember text-ember-foreground hover:bg-ember/90"
          >
            {sealUntil ? "Seal it" : "Save entry"}
          </Button>
        </div>
      ) : null}

      {list.length > 0 ? (
        <div className="mb-5 space-y-3">
          <div className="hide-scrollbar flex gap-2 overflow-x-auto">
            {(
              [
                ["all", "Everything"],
                ["shared", "Shared"],
                ["sealed", "Sealed letters"],
              ] as [Filter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                  filter === key
                    ? "border-ember/60 bg-ember/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-ember/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search your entries"
              className="h-11 rounded-2xl bg-secondary/40 pl-10"
            />
          </div>
        </div>
      ) : null}

      {list.length === 0 ? (
        <EmptyState
          icon={<PenLine className="mx-auto size-7" />}
          title="Nothing written yet"
          body="Start with today — a line is enough. Or seal a letter for a date far from now."
        />
      ) : visible.length === 0 ? (
        <p className="rounded-3xl border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          Nothing matches that.
        </p>
      ) : (
        <div className="space-y-4">
          {visible.map((entry, i) => {
            const locked = entry.is_sealed && entry.unlock_at && new Date(entry.unlock_at) > new Date();
            const entryMood = moodOf(entry.mood);
            return (
              <article
                key={entry.id}
                className={`duo-rise rounded-3xl border p-5 ${
                  locked ? "border-gold/30 bg-gold/[0.04]" : "border-border bg-card"
                }`}
                style={{ animationDelay: `${i * 35}ms` }}
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl">
                    {locked ? "A sealed letter" : entry.title}
                    {!locked && entryMood ? (
                      <span className="ml-2 align-middle text-base" title={entryMood.label}>
                        {entryMood.emoji}
                      </span>
                    ) : null}
                  </h2>
                  {entry.is_sealed ? (
                    <span className="flex shrink-0 items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-gold">
                      {locked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
                      {locked ? "Sealed" : "Open"}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {formatDay(entry.entry_date)}
                </p>
                <p
                  className={`mt-3 whitespace-pre-wrap text-[15px] leading-relaxed ${
                    locked ? "text-muted-foreground italic" : "text-foreground/90"
                  }`}
                >
                  {locked
                    ? `Opens ${formatDay(entry.unlock_at)}. Whatever is in here can wait.`
                    : entry.body}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
