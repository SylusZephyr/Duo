import { describe, expect, it } from "vitest";

import { MOMENTS_PAGE_SIZE, flattenMoments } from "@/lib/queries";
import type { Moment } from "@/lib/queries";

function moment(id: string): Moment {
  return {
    id,
    author_id: "u1",
    caption: "",
    mood: null,
    taken_at: "2026-03-15",
    created_at: "2026-03-15T12:00:00Z",
    visibility: "private",
    place_name: null,
    city: null,
    country: null,
    lat: null,
    lng: null,
    media: [],
    reactions: [],
    tags: [],
    comment_count: 0,
  };
}

describe("flattenMoments", () => {
  it("is empty before the first page arrives", () => {
    expect(flattenMoments(undefined)).toEqual([]);
  });

  it("is empty for a space with no moments", () => {
    expect(flattenMoments({ pages: [[]] })).toEqual([]);
  });

  it("joins pages in the order they were fetched", () => {
    const flat = flattenMoments({
      pages: [[moment("a"), moment("b")], [moment("c")]],
    });
    expect(flat.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps a short final page, which is how the end of the feed looks", () => {
    const full = Array.from({ length: MOMENTS_PAGE_SIZE }, (_, i) => moment(`p${i}`));
    const flat = flattenMoments({ pages: [full, [moment("last")]] });
    expect(flat).toHaveLength(MOMENTS_PAGE_SIZE + 1);
    expect(flat.at(-1)!.id).toBe("last");
  });
});

describe("MOMENTS_PAGE_SIZE", () => {
  it("is big enough to fill a phone screen and small enough to be worth paging", () => {
    expect(MOMENTS_PAGE_SIZE).toBeGreaterThanOrEqual(6);
    expect(MOMENTS_PAGE_SIZE).toBeLessThanOrEqual(50);
  });
});
