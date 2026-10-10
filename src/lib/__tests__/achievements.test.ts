import { describe, expect, it, vi } from "vitest";

import { BADGES, evaluateBadges, postingStreak } from "@/lib/achievements";

/** Fixed "today" so streak assertions do not drift with the clock. */
const TODAY = "2026-03-15";

function withToday<T>(run: () => T): T {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
  try {
    return run();
  } finally {
    vi.useRealTimers();
  }
}

describe("postingStreak", () => {
  it("is zero with no posts", () => {
    expect(withToday(() => postingStreak([]))).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    const streak = withToday(() => postingStreak(["2026-03-15", "2026-03-14", "2026-03-13"]));
    expect(streak).toBe(3);
  });

  it("still counts a streak that ends yesterday, so the day is not lost mid-day", () => {
    const streak = withToday(() => postingStreak(["2026-03-14", "2026-03-13"]));
    expect(streak).toBe(2);
  });

  it("breaks when a day is missed", () => {
    const streak = withToday(() => postingStreak(["2026-03-15", "2026-03-13", "2026-03-12"]));
    expect(streak).toBe(1);
  });

  it("is zero once the last post is older than yesterday", () => {
    expect(withToday(() => postingStreak(["2026-03-10"]))).toBe(0);
  });

  it("treats several posts on one day as one day", () => {
    const streak = withToday(() =>
      postingStreak(["2026-03-15T09:00:00Z", "2026-03-15T20:00:00Z", "2026-03-14"]),
    );
    expect(streak).toBe(2);
  });

  it("does not count duplicates as length", () => {
    const streak = withToday(() => postingStreak(["2026-03-15", "2026-03-15", "2026-03-15"]));
    expect(streak).toBe(1);
  });
});

describe("evaluateBadges", () => {
  const zero = { moments: 0, cities: 0, countries: 0, entries: 0, streak: 0, years: 0 };

  it("returns every badge, none earned, at zero", () => {
    const badges = evaluateBadges(zero);
    expect(badges).toHaveLength(BADGES.length);
    expect(badges.every((b) => !b.earned)).toBe(true);
    expect(badges.every((b) => b.progress === 0)).toBe(true);
  });

  it("earns a badge on the exact target", () => {
    const badges = evaluateBadges({ ...zero, moments: 10 });
    const ten = badges.find((b) => b.key === "ten_moments")!;
    expect(ten.earned).toBe(true);
    expect(ten.progress).toBe(10);
  });

  it("caps progress at the target so bars never overflow", () => {
    const badges = evaluateBadges({ ...zero, moments: 5000 });
    expect(badges.find((b) => b.key === "hundred_moments")!.progress).toBe(100);
  });

  it("earns every lower tier of a metric once the top tier is reached", () => {
    const badges = evaluateBadges({ ...zero, countries: 5 });
    expect(badges.find((b) => b.key === "two_countries")!.earned).toBe(true);
    expect(badges.find((b) => b.key === "five_countries")!.earned).toBe(true);
  });

  it("has unique badge keys", () => {
    expect(new Set(BADGES.map((b) => b.key)).size).toBe(BADGES.length);
  });
});
