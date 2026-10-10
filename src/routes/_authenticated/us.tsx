import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Award, Check, Copy, LogOut, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { evaluateBadges, postingStreak, type BadgeKey } from "@/lib/achievements";
import { daysBetween, formatDay } from "@/lib/format";
import { badgeTitle, useEarnedBadges, useRecordBadges } from "@/lib/notifications";
import { useBucketList, useJournal, useMe, useMilestones, useSpaceStats } from "@/lib/queries";
import { useRequireSpace } from "@/lib/use-require-space";

export const Route = createFileRoute("/_authenticated/us")({
  head: () => ({
    meta: [
      { title: "Us — Duo" },
      {
        name: "description",
        content: "Milestones, achievements and the settings for your shared space.",
      },
      { property: "og:title", content: "Us — Duo" },
      { property: "og:description", content: "Your milestones and badges." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UsPage,
});

function UsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { data } = useRequireSpace();
  const { data: stats } = useSpaceStats(data?.space.id);
  const { data: entries } = useJournal(data?.space.id);
  const { data: milestones } = useMilestones(data?.space.id);
  const { data: bucket } = useBucketList(data?.space.id);

  const [adding, setAdding] = useState(false);
  const [addingWish, setAddingWish] = useState(false);
  const [wish, setWish] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [happenedAt, setHappenedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [handle, setHandle] = useState(data?.space.handle ?? "");
  const [busy, setBusy] = useState(false);

  // The dates come from the database already deduplicated and newest-first;
  // the streak itself is still worked out by the function the tests cover.
  const streak = useMemo(() => postingStreak(stats?.posting_dates ?? []), [stats]);

  async function addWish() {
    if (!me || !data || wish.trim().length === 0) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("bucket_list").insert({
        space_id: data.space.id,
        created_by: me.id,
        title: wish.trim().slice(0, 120),
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["bucket_list", data.space.id] });
      setWish("");
      setAddingWish(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't add that");
    } finally {
      setBusy(false);
    }
  }

  async function toggleWish(id: string, done: boolean) {
    if (!data || !me) return;
    const { error } = await supabase
      .from("bucket_list")
      .update({
        done: !done,
        done_at: done ? null : new Date().toISOString(),
        done_by: done ? null : me.id,
      })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["bucket_list", data.space.id] });
  }

  const badges = useMemo(() => {
    const years = data?.space.anniversary_date
      ? Math.floor(daysBetween(data.space.anniversary_date) / 365)
      : 0;
    return evaluateBadges({
      moments: stats?.moments ?? 0,
      cities: stats?.cities ?? 0,
      countries: stats?.countries ?? 0,
      entries: stats?.journal_entries ?? (entries ?? []).length,
      streak,
      years,
    });
  }, [stats, entries, streak, data?.space.anniversary_date]);

  const { data: recorded } = useEarnedBadges(data?.space.id);
  const recordBadges = useRecordBadges(data?.space.id, me?.id);

  const recordedKeys = useMemo(() => new Set((recorded ?? []).map((row) => row.key)), [recorded]);

  const earned = badges.filter((badge) => badge.earned);

  const earnedAt = useMemo(
    () => new Map((recorded ?? []).map((row) => [row.key, row.earned_at])),
    [recorded],
  );

  /**
   * Bank any badge the couple has reached but never had recorded. The insert
   * is the unlock: it dates the badge and tells both of them. It is idempotent,
   * so this is safe on every visit and from both devices at once — but we still
   * only fire once per set of keys, to keep a render loop out of the network.
   */
  const bankedRef = useRef("");
  useEffect(() => {
    if (!data?.space.id || recorded === undefined) return;

    const missing = earned
      .filter((badge) => !recordedKeys.has(badge.key))
      .map((badge) => badge.key as BadgeKey);
    if (missing.length === 0) return;

    const signature = missing.slice().sort().join(",");
    if (bankedRef.current === signature) return;
    bankedRef.current = signature;

    recordBadges.mutate(missing, {
      onSuccess: (keys) => {
        if (keys.length === 1) {
          toast.success(`Badge unlocked — ${badgeTitle(keys[0]!)}`);
        } else if (keys.length > 1) {
          toast.success(`${keys.length} badges unlocked`);
        }
      },
      onError: () => {
        // Let the next visit try again rather than losing the unlock.
        bankedRef.current = "";
      },
    });
  }, [data?.space.id, recorded, recordedKeys, earned, recordBadges]);

  async function addMilestone() {
    if (!me || !data || title.trim().length === 0) {
      toast.error("Give the milestone a name");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("milestones").insert({
        space_id: data.space.id,
        created_by: me.id,
        title: title.trim().slice(0, 120),
        description: description.trim().slice(0, 500) || null,
        happened_at: happenedAt,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["milestones", data.space.id] });
      setTitle("");
      setDescription("");
      setAdding(false);
      toast.success("Milestone added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't add that");
    } finally {
      setBusy(false);
    }
  }

  async function updateSpace(patch: { is_public?: boolean; handle?: string | null }) {
    if (!data) return;
    const { error } = await supabase.from("spaces").update(patch).eq("id", data.space.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["space"] });
    toast.success("Saved");
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const days = data?.space.anniversary_date ? daysBetween(data.space.anniversary_date) : null;

  return (
    <AppShell title="Us" subtitle={days !== null ? `Day ${days.toLocaleString()}` : "Your story"}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Moments" value={stats?.moments ?? 0} />
        <Stat label="Places" value={stats?.cities ?? 0} />
        <Stat label="Day streak" value={streak} />
        <Stat label="Badges" value={earned.length} />
      </div>

      <section className="mt-7">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl">Someday list</h2>
          <button
            onClick={() => setAddingWish((value) => !value)}
            className="flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-ember"
          >
            <Plus className="size-3.5" /> Add
          </button>
        </div>

        {addingWish ? (
          <div className="duo-rise mt-4 flex gap-2">
            <Input
              value={wish}
              onChange={(event) => setWish(event.target.value)}
              maxLength={120}
              placeholder="See the northern lights"
              className="h-12 rounded-2xl bg-secondary/40"
              onKeyDown={(event) => event.key === "Enter" && void addWish()}
            />
            <Button
              onClick={addWish}
              disabled={busy}
              className="h-12 rounded-2xl bg-ember px-5 text-ember-foreground hover:bg-ember/90"
            >
              Add
            </Button>
          </div>
        ) : null}

        {(bucket ?? []).length === 0 ? (
          <p className="mt-4 rounded-3xl border border-border bg-card px-6 py-8 text-center text-sm text-muted-foreground">
            The things you keep saying you'll do — write them down, then tick them off.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {(bucket ?? []).map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => void toggleWish(item.id, item.done)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                    item.done
                      ? "border-gold/35 bg-gold/[0.04]"
                      : "border-border bg-card hover:border-ember/40"
                  }`}
                >
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                      item.done ? "border-gold bg-gold/20 text-gold" : "border-border"
                    }`}
                  >
                    {item.done ? <Check className="size-3" /> : null}
                  </span>
                  <span
                    className={`text-sm ${item.done ? "text-muted-foreground line-through" : ""}`}
                  >
                    {item.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-7">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl">Milestones</h2>
          <button
            onClick={() => setAdding((value) => !value)}
            className="flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-ember"
          >
            <Plus className="size-3.5" /> Add
          </button>
        </div>

        {adding ? (
          <div className="mt-4 space-y-3 rounded-3xl border border-border bg-card p-5">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              placeholder="Moved in together"
              className="h-12 rounded-2xl bg-secondary/40"
            />
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              placeholder="A line about it"
              className="min-h-20 rounded-2xl border-border bg-secondary/40"
            />
            <div className="space-y-2">
              <Label htmlFor="happened">When</Label>
              <Input
                id="happened"
                type="date"
                value={happenedAt}
                onChange={(event) => setHappenedAt(event.target.value)}
                className="h-12 rounded-2xl bg-secondary/40"
              />
            </div>
            <Button
              onClick={addMilestone}
              disabled={busy}
              className="h-12 w-full rounded-2xl bg-ember text-ember-foreground hover:bg-ember/90"
            >
              Save milestone
            </Button>
          </div>
        ) : null}

        {(milestones ?? []).length === 0 ? (
          <p className="mt-4 rounded-3xl border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
            First date, first trip, first apartment — mark the ones that mattered.
          </p>
        ) : (
          <ol className="mt-4 space-y-0 border-l border-border pl-5">
            {(milestones ?? []).map((milestone) => (
              <li key={milestone.id} className="relative pb-6">
                <span className="absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full bg-ember" />
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {formatDay(milestone.happened_at)}
                </p>
                <h3 className="mt-1 text-xl">{milestone.title}</h3>
                {milestone.description ? (
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {milestone.description}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-2xl">Achievements</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {badges.map((badge) => (
            <div
              key={badge.key}
              className={`rounded-2xl border p-4 ${
                badge.earned ? "border-gold/40 bg-gold/5" : "border-border bg-card"
              }`}
            >
              <Award className={`size-4 ${badge.earned ? "text-gold" : "text-muted-foreground"}`} />
              <p className="mt-2 text-sm">{badge.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {earnedAt.get(badge.key)
                  ? `Unlocked ${formatDay(earnedAt.get(badge.key))}`
                  : badge.hint}
              </p>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-gold"
                  style={{ width: `${(badge.progress / badge.target) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-5">
        <h2 className="text-2xl">Sharing</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm">Public page</p>
            <p className="text-xs text-muted-foreground">
              Show only the moments you marked public.
            </p>
          </div>
          <Switch
            checked={data?.space.is_public ?? false}
            onCheckedChange={(checked) => updateSpace({ is_public: checked })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="handle">Your public link</Label>
          <div className="flex gap-2">
            <Input
              id="handle"
              value={handle}
              onChange={(event) =>
                setHandle(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
              }
              maxLength={30}
              placeholder="alex-and-sam"
              className="h-12 rounded-2xl bg-secondary/40"
            />
            <Button
              variant="outline"
              onClick={() => updateSpace({ handle: handle.trim() || null })}
              className="h-12 rounded-2xl border-border bg-transparent"
            >
              Save
            </Button>
          </div>
          {data?.space.handle ? (
            <p className="text-xs text-muted-foreground">duo.app/c/{data.space.handle}</p>
          ) : null}
        </div>
        <button
          onClick={() => {
            if (!data) return;
            navigator.clipboard.writeText(data.space.invite_code);
            toast.success("Invite code copied");
          }}
          className="flex w-full items-center justify-between rounded-2xl border border-border px-4 py-3 text-left"
        >
          <span className="text-sm">
            Invite code <span className="font-mono text-gold">{data?.space.invite_code}</span>
          </span>
          <Copy className="size-4 text-muted-foreground" />
        </button>
      </section>

      <button
        onClick={signOut}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm text-muted-foreground"
      >
        <LogOut className="size-4" /> Sign out
      </button>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-4 text-center">
      <p className="font-display text-3xl leading-none">{value}</p>
      <p className="mt-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
