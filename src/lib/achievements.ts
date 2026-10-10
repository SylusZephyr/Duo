export type BadgeKey =
  | "first_moment"
  | "ten_moments"
  | "fifty_moments"
  | "hundred_moments"
  | "three_cities"
  | "five_cities"
  | "two_countries"
  | "five_countries"
  | "journal_starter"
  | "ten_entries"
  | "week_streak"
  | "month_streak"
  | "first_year"
  | "five_years";

export type BadgeDef = {
  key: BadgeKey;
  title: string;
  hint: string;
  target: number;
  metric: "moments" | "cities" | "countries" | "entries" | "streak" | "years";
};

export const BADGES: BadgeDef[] = [
  { key: "first_moment", title: "First frame", hint: "Share your first moment", target: 1, metric: "moments" },
  { key: "ten_moments", title: "Ten moments", hint: "Share 10 moments together", target: 10, metric: "moments" },
  { key: "fifty_moments", title: "Fifty moments", hint: "Share 50 moments together", target: 50, metric: "moments" },
  { key: "hundred_moments", title: "A hundred", hint: "Share 100 moments together", target: 100, metric: "moments" },
  { key: "three_cities", title: "Three cities", hint: "Post from 3 different cities", target: 3, metric: "cities" },
  { key: "five_cities", title: "Five cities", hint: "Post from 5 different cities", target: 5, metric: "cities" },
  { key: "two_countries", title: "Border crossers", hint: "Post from 2 countries", target: 2, metric: "countries" },
  { key: "five_countries", title: "Far and wide", hint: "Post from 5 countries", target: 5, metric: "countries" },
  { key: "journal_starter", title: "Pen to paper", hint: "Write your first journal entry", target: 1, metric: "entries" },
  { key: "ten_entries", title: "Ten entries", hint: "Write 10 journal entries", target: 10, metric: "entries" },
  { key: "week_streak", title: "Seven days", hint: "Post 7 days in a row", target: 7, metric: "streak" },
  { key: "month_streak", title: "Thirty days", hint: "Post 30 days in a row", target: 30, metric: "streak" },
  { key: "first_year", title: "One year", hint: "Celebrate your first anniversary", target: 1, metric: "years" },
  { key: "five_years", title: "Five years", hint: "Celebrate five years together", target: 5, metric: "years" },
];

export type BadgeMetrics = Record<BadgeDef["metric"], number>;

export function postingStreak(dates: string[]) {
  const unique = Array.from(new Set(dates.map((d) => d.slice(0, 10)))).sort().reverse();
  if (unique.length === 0) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (unique[0] !== today && unique[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < unique.length; i += 1) {
    const prev = new Date(unique[i - 1] + "T00:00:00").getTime();
    const cur = new Date(unique[i] + "T00:00:00").getTime();
    if (prev - cur === 86400000) streak += 1;
    else break;
  }
  return streak;
}

export function evaluateBadges(metrics: BadgeMetrics) {
  return BADGES.map((badge) => ({
    ...badge,
    progress: Math.min(metrics[badge.metric] ?? 0, badge.target),
    earned: (metrics[badge.metric] ?? 0) >= badge.target,
  }));
}
