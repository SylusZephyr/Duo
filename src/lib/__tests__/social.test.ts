import { describe, expect, it, vi } from "vitest";

import { daysUntil, nextOccurrence } from "@/lib/social";

function at<T>(now: string, run: () => T): T {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
  try {
    return run();
  } finally {
    vi.useRealTimers();
  }
}

describe("nextOccurrence", () => {
  it("returns the date itself when it is still ahead", () => {
    const next = at("2026-03-15T12:00:00", () => nextOccurrence("2026-06-01", false));
    expect(next.toISOString().slice(0, 10)).toBe("2026-06-01");
  });

  it("returns a past one-off date unchanged, so it can be shown as passed", () => {
    const next = at("2026-03-15T12:00:00", () => nextOccurrence("2020-01-01", false));
    expect(next.getFullYear()).toBe(2020);
  });

  it("rolls a yearly date forward into this year when it has not happened yet", () => {
    const next = at("2026-03-15T12:00:00", () => nextOccurrence("2001-06-01", true));
    expect(next.toISOString().slice(0, 10)).toBe("2026-06-01");
  });

  it("rolls a yearly date into next year once it has passed", () => {
    const next = at("2026-07-01T12:00:00", () => nextOccurrence("2001-06-01", true));
    expect(next.toISOString().slice(0, 10)).toBe("2027-06-01");
  });

  it("treats a yearly date falling today as today, not next year", () => {
    const next = at("2026-06-01T18:00:00", () => nextOccurrence("2001-06-01", true));
    expect(next.toISOString().slice(0, 10)).toBe("2026-06-01");
  });
});

describe("daysUntil", () => {
  it("is zero for today", () => {
    expect(at("2026-03-15T23:00:00", () => daysUntil(new Date("2026-03-15T00:00:00")))).toBe(0);
  });

  it("counts forward", () => {
    expect(at("2026-03-15T01:00:00", () => daysUntil(new Date("2026-03-25T00:00:00")))).toBe(10);
  });

  it("goes negative for a date that has passed", () => {
    expect(at("2026-03-15T01:00:00", () => daysUntil(new Date("2026-03-10T00:00:00")))).toBe(-5);
  });
});
