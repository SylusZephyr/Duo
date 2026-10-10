import { createFileRoute } from "@tanstack/react-router";
import { Dices, Lock, Trophy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { EmptyState, ListSkeleton } from "@/components/states";
import { useMe } from "@/lib/queries";
import { useAnswerRound, useGameRounds, useSocialRealtime, useStartRound } from "@/lib/social";
import { useRequireSpace } from "@/lib/use-require-space";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/games")({
  head: () => ({
    meta: [
      { title: "Games — Duo" },
      { name: "description", content: "Daily couple games: would you rather, who's more likely, and how well you know each other." },
      { property: "og:title", content: "Games — Duo" },
      { property: "og:description", content: "Play little games together every day." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GamesPage,
});

const GAMES = {
  wyr: {
    label: "Would you rather",
    emoji: "🤔",
    color: "from-candy to-blueberry",
    bank: [
      ["Beach sunrise", "Mountain sunset"],
      ["Cook together", "Order in & cuddle"],
      ["Road trip", "First-class flight"],
      ["Love letter", "Surprise gift"],
      ["Rainy movie day", "Sunny picnic"],
      ["Travel the world", "Build a dream home"],
      ["Dance in the kitchen", "Karaoke night"],
      ["Breakfast in bed", "Midnight snack run"],
    ],
  },
  likely: {
    label: "Who's more likely",
    emoji: "👀",
    color: "from-honey to-candy",
    bank: [
      ["Who's more likely to cry at a movie?"],
      ["Who's more likely to get lost?"],
      ["Who's more likely to plan a surprise?"],
      ["Who's more likely to fall asleep first?"],
      ["Who's more likely to eat the last slice?"],
      ["Who's more likely to say sorry first?"],
      ["Who's more likely to adopt a pet on a whim?"],
    ],
  },
  know: {
    label: "How well do you know me",
    emoji: "💘",
    color: "from-blueberry to-candy",
    bank: [
      ["What's my comfort food?"],
      ["Where would I go on a dream holiday?"],
      ["What song reminds me of us?"],
      ["What's my biggest pet peeve?"],
      ["What was my first impression of you?"],
      ["What would I do with a free Saturday?"],
      ["What's my love language?"],
    ],
  },
} as const;

type GameKey = keyof typeof GAMES;

function GamesPage() {
  const { data: me } = useMe();
  const { data } = useRequireSpace();
  const spaceId = data?.space.id;
  const { data: rounds, isLoading } = useGameRounds(spaceId);
  const start = useStartRound(spaceId);
  const answer = useAnswerRound(spaceId);
  useSocialRealtime(spaceId, me?.id);

  const members = data?.members ?? [];
  const nameOf = (id: string) => (id === me?.id ? "You" : (members.find((m) => m.user_id === id)?.display_name ?? "Them"));
  const bothAnswered = (rounds ?? []).filter((r) => r.answers.length >= 2);
  const matches = bothAnswered.filter((r) => r.game !== "know" && r.answers[0]?.answer === r.answers[1]?.answer).length;

  function startGame(key: GameKey) {
    if (!me) return;
    const game = GAMES[key];
    const used = new Set((rounds ?? []).map((r) => r.question));
    const pool = game.bank.filter((q) => !used.has(questionText(key, q)));
    const pick = (pool.length ? pool : game.bank)[Math.floor(Math.random() * (pool.length || game.bank.length))]!;
    const options =
      key === "wyr" ? [...pick] : key === "likely" ? members.map((m) => m.display_name) : [];
    start.mutate(
      { game: key, question: questionText(key, pick), options, userId: me.id },
      { onSuccess: () => toast.success("New round! Answer it, then wait for your person."), onError: () => toast.error("Couldn't start a round") },
    );
  }

  return (
    <AppShell title="Games" subtitle="Play every day">
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="Rounds" value={(rounds ?? []).length} />
        <Stat label="Both played" value={bothAnswered.length} />
        <Stat label="In sync" value={matches} icon />
      </div>

      <div className="mb-7 grid gap-3">
        {(Object.keys(GAMES) as GameKey[]).map((key) => (
          <button
            key={key}
            onClick={() => startGame(key)}
            disabled={start.isPending}
            className={cn("press flex items-center gap-4 rounded-3xl bg-gradient-to-br p-5 text-left text-white shadow-lift", GAMES[key].color)}
          >
            <span className="text-4xl">{GAMES[key].emoji}</span>
            <span className="flex-1">
              <span className="block font-display text-lg font-extrabold">{GAMES[key].label}</span>
              <span className="text-xs font-semibold opacity-85">Tap to deal a new round</span>
            </span>
            <Dices className="size-5" />
          </button>
        ))}
      </div>

      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Rounds</h2>
      {isLoading ? (
        <ListSkeleton />
      ) : (rounds ?? []).length === 0 ? (
        <EmptyState icon={<Dices className="mx-auto size-7 text-candy" />} title="No rounds yet" body="Pick a game above. Answers stay hidden until you've both played." />
      ) : (
        <div className="space-y-4">
          {rounds!.map((r) => (
            <RoundCard
              key={r.id}
              round={r}
              userId={me?.id}
              nameOf={nameOf}
              onAnswer={(value) =>
                me && answer.mutate({ roundId: r.id, answer: value, userId: me.id }, { onError: () => toast.error("Couldn't save answer") })
              }
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function questionText(key: GameKey, pick: readonly string[]) {
  return key === "wyr" ? `${pick[0]} or ${pick[1]}?` : pick[0]!;
}

function Stat({ label, value, icon }: { label: string; value: number; icon?: boolean }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-4 text-center shadow-soft">
      <p className="flex items-center justify-center gap-1 font-display text-2xl font-extrabold text-candy">
        {icon ? <Trophy className="size-4" /> : null}
        {value}
      </p>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
    </div>
  );
}

function RoundCard({
  round,
  userId,
  nameOf,
  onAnswer,
}: {
  round: { id: string; game: string; question: string; options: string[]; answers: { id: string; user_id: string; answer: string }[]; created_at: string };
  userId: string | undefined;
  nameOf: (id: string) => string;
  onAnswer: (value: string) => void;
}) {
  const [text, setText] = useState("");
  const game = GAMES[round.game as GameKey];
  const mine = round.answers.find((a) => a.user_id === userId);
  const revealed = round.answers.length >= 2;
  const same = revealed && round.answers[0]?.answer === round.answers[1]?.answer;

  return (
    <div className="duo-rise rounded-3xl border border-border bg-card p-5 shadow-soft">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-candy">
        {game?.emoji} {game?.label}
      </p>
      <p className="mt-1.5 font-display text-lg font-bold leading-snug">{round.question}</p>

      {!mine ? (
        round.options.length ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {round.options.map((o) => (
              <button key={o} onClick={() => onAnswer(o)} className="press rounded-2xl border border-border bg-secondary px-3 py-3 text-sm font-semibold hover:border-candy/50">
                {o}
              </button>
            ))}
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) onAnswer(text.trim());
            }}
            className="mt-4 flex gap-2"
          >
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Your answer…" className="h-11 flex-1 rounded-2xl border border-border bg-secondary px-4 text-sm outline-none focus:border-candy" />
            <button className="press bg-gradient-candy rounded-2xl px-4 text-sm font-bold text-white">Lock in</button>
          </form>
        )
      ) : revealed ? (
        <div className="mt-4 space-y-2">
          {round.answers.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-2xl bg-secondary px-4 py-2.5 text-sm">
              <span className="font-semibold text-muted-foreground">{nameOf(a.user_id)}</span>
              <span className="font-bold">{a.answer}</span>
            </div>
          ))}
          {round.game !== "know" ? (
            <p className={cn("pt-1 text-center text-sm font-bold", same ? "text-candy" : "text-muted-foreground")}>
              {same ? "💞 Perfectly in sync!" : "Opposites attract 😄"}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-candy-soft px-4 py-3 text-sm font-semibold text-candy">
          <Lock className="size-4" /> You answered "{mine.answer}". Waiting for your person…
        </p>
      )}
    </div>
  );
}
