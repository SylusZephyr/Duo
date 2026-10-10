import { describe, expect, it } from "vitest";

import { clusterCell, clusterPoints, formatKm, haversineKm, pathLengthKm } from "@/lib/geo";

const LONDON = { lat: 51.5074, lng: -0.1278 };
const PARIS = { lat: 48.8566, lng: 2.3522 };
const NEW_YORK = { lat: 40.7128, lng: -74.006 };

describe("haversineKm", () => {
  it("is zero for a point and itself", () => {
    expect(haversineKm(LONDON, LONDON)).toBe(0);
  });

  it("matches the known London–Paris great-circle distance", () => {
    expect(haversineKm(LONDON, PARIS)).toBeCloseTo(343.6, 1);
  });

  it("matches the known London–New York great-circle distance", () => {
    expect(haversineKm(LONDON, NEW_YORK)).toBeCloseTo(5570, -2);
  });

  it("is symmetric", () => {
    expect(haversineKm(LONDON, PARIS)).toBeCloseTo(haversineKm(PARIS, LONDON), 9);
  });

  it("handles antipodal points without NaN from floating point drift", () => {
    const d = haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 180 });
    expect(Number.isNaN(d)).toBe(false);
    expect(d).toBeCloseTo(20015, -2);
  });
});

describe("pathLengthKm", () => {
  it("is zero for fewer than two points", () => {
    expect(pathLengthKm([])).toBe(0);
    expect(pathLengthKm([LONDON])).toBe(0);
  });

  it("sums the legs of a path", () => {
    const total = pathLengthKm([LONDON, PARIS, LONDON]);
    expect(total).toBeCloseTo(haversineKm(LONDON, PARIS) * 2, 6);
  });
});

describe("formatKm", () => {
  it("reads 0 km below one kilometre", () => {
    expect(formatKm(0)).toBe("0 km");
    expect(formatKm(0.4)).toBe("0 km");
  });

  it("rounds to whole kilometres under a thousand", () => {
    expect(formatKm(343.2)).toBe("343 km");
  });

  it("switches to thousands above a thousand", () => {
    expect(formatKm(5570)).toBe("5.6k km");
  });
});

describe("clusterPoints", () => {
  it("returns nothing for no points", () => {
    expect(clusterPoints([], 4)).toEqual([]);
  });

  it("merges neighbours at a low zoom and splits them at a high zoom", () => {
    // Both sit inside one 56-degree cell at zoom 2, and in separate cells once zoomed in.
    const points = [
      { lat: 10, lng: 10 },
      { lat: 12, lng: 12 },
    ];
    expect(clusterPoints(points, 2)).toHaveLength(1);
    expect(clusterPoints(points, 14)).toHaveLength(2);
  });

  it("places a cluster at the mean of its members", () => {
    const a = { lat: 10, lng: 10 };
    const b = { lat: 12, lng: 12 };
    const [cluster] = clusterPoints([a, b], 2);
    expect(cluster).toBeDefined();
    expect(cluster!.items).toHaveLength(2);
    expect(cluster!.lat).toBeCloseTo(11, 6);
    expect(cluster!.lng).toBeCloseTo(11, 6);
  });

  it("keeps every point exactly once", () => {
    const points = [LONDON, PARIS, NEW_YORK];
    const kept = clusterPoints(points, 5).flatMap((c) => c.items);
    expect(kept).toHaveLength(points.length);
  });

  it("never collapses the whole world into one cell at street zoom", () => {
    expect(clusterCell(20)).toBeGreaterThanOrEqual(0.0004);
    expect(clusterCell(1)).toBeGreaterThan(clusterCell(10));
  });
});
