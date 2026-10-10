import { describe, expect, it } from "vitest";

import { BADGES } from "@/lib/achievements";
import {
  PREF_FIELDS,
  badgeTitle,
  notificationBody,
  notificationTitle,
  type Notification,
} from "@/lib/notifications";

function notification(over: Partial<Notification> = {}): Notification {
  return {
    id: "n1",
    kind: "moment",
    title: "Alex added a moment",
    body: "Rooftop, 2am",
    link: "/feed",
    read_at: null,
    created_at: "2026-03-15T12:00:00Z",
    ...over,
  };
}

describe("notificationTitle", () => {
  it("passes an ordinary notification through untouched", () => {
    expect(notificationTitle(notification())).toBe("Alex added a moment");
  });

  it("resolves a badge key into the badge's name", () => {
    const row = notification({ kind: "achievement", title: "Badge unlocked", body: "week_streak" });
    expect(notificationTitle(row)).toBe("Badge unlocked: Seven days");
  });

  it("falls back to the stored title for a key it does not know", () => {
    const row = notification({ kind: "achievement", title: "Badge unlocked", body: "from_future" });
    expect(notificationTitle(row)).toBe("Badge unlocked");
  });

  it("falls back when a badge notification has no key at all", () => {
    const row = notification({ kind: "achievement", title: "Badge unlocked", body: null });
    expect(notificationTitle(row)).toBe("Badge unlocked");
  });
});

describe("notificationBody", () => {
  it("keeps the preview of an ordinary notification", () => {
    expect(notificationBody(notification())).toBe("Rooftop, 2am");
  });

  it("drops a badge's body, because the key is already in the title", () => {
    const row = notification({ kind: "achievement", body: "week_streak" });
    expect(notificationBody(row)).toBeNull();
  });

  it("keeps a sealed letter's empty body empty, so nothing leaks", () => {
    expect(notificationBody(notification({ kind: "journal", body: null }))).toBeNull();
  });
});

describe("badgeTitle", () => {
  it("names every badge the app defines", () => {
    for (const badge of BADGES) {
      expect(badgeTitle(badge.key)).toBe(badge.title);
    }
  });

  it("returns the key unchanged when it is not a badge we know", () => {
    expect(badgeTitle("not_a_badge")).toBe("not_a_badge");
  });
});

describe("PREF_FIELDS", () => {
  it("covers every switch the database gates notifications on", () => {
    expect(PREF_FIELDS.map((field) => field.key).sort()).toEqual([
      "anniversaries",
      "comments",
      "partner_posted",
      "reactions",
      "sealed_unlocked",
      "streaks",
    ]);
  });

  it("gives each switch a label and a hint, so no row renders bare", () => {
    for (const field of PREF_FIELDS) {
      expect(field.label.length).toBeGreaterThan(0);
      expect(field.hint.length).toBeGreaterThan(0);
    }
  });
});
