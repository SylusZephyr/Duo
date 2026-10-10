import { describe, expect, it, vi } from "vitest";

import { daysBetween, placeLabel, relativeTime } from "@/lib/format";

describe("daysBetween", () => {
  it("is zero on the same day", () => {
    expect(daysBetween("2026-03-15", new Date("2026-03-15T23:59:00"))).toBe(0);
  });

  it("counts whole days", () => {
    expect(daysBetween("2026-03-01", new Date("2026-03-15T12:00:00"))).toBe(14);
  });

  it("never goes negative for a future anniversary", () => {
    expect(daysBetween("2030-01-01", new Date("2026-03-15T12:00:00"))).toBe(0);
  });

  it("crosses a leap day correctly", () => {
    expect(daysBetween("2024-02-28", new Date("2024-03-01T12:00:00"))).toBe(2);
  });
});

describe("relativeTime", () => {
  function at(iso: string, now: string) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    try {
      return relativeTime(iso);
    } finally {
      vi.useRealTimers();
    }
  }

  it("reads 'just now' under a minute", () => {
    expect(at("2026-03-15T12:00:00Z", "2026-03-15T12:00:30Z")).toBe("just now");
  });

  it("reads minutes under an hour", () => {
    expect(at("2026-03-15T12:00:00Z", "2026-03-15T12:45:00Z")).toBe("45m ago");
  });

  it("reads hours under a day", () => {
    expect(at("2026-03-15T00:00:00Z", "2026-03-15T05:00:00Z")).toBe("5h ago");
  });

  it("reads days under a week", () => {
    expect(at("2026-03-10T12:00:00Z", "2026-03-15T12:00:00Z")).toBe("5d ago");
  });

  it("falls back to a date beyond a week", () => {
    expect(at("2026-01-10T12:00:00Z", "2026-03-15T12:00:00Z")).not.toMatch(/ago/);
  });
});

describe("placeLabel", () => {
  it("is empty when nothing is known", () => {
    expect(placeLabel({})).toBe("");
  });

  it("joins the parts it has, skipping the blanks", () => {
    expect(placeLabel({ place_name: null, city: "Lisbon", country: "Portugal" })).toBe(
      "Lisbon · Portugal",
    );
  });

  it("keeps place, city and country in order", () => {
    expect(placeLabel({ place_name: "Miradouro", city: "Lisbon", country: "Portugal" })).toBe(
      "Miradouro · Lisbon · Portugal",
    );
  });
});
