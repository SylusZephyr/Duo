export type GeoPoint = { lat: number; lng: number };

const EARTH_KM = 6371;

export function haversineKm(a: GeoPoint, b: GeoPoint) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Total distance along an ordered path, in km. */
export function pathLengthKm(path: GeoPoint[]) {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) total += haversineKm(path[i - 1]!, path[i]!);
  return total;
}

export function formatKm(km: number) {
  if (km < 1) return "0 km";
  if (km < 1000) return `${Math.round(km)} km`;
  return `${Math.round(km / 100) / 10}k km`;
}

/** Grid size in degrees for a given Google Maps zoom level. */
export function clusterCell(zoom: number) {
  return Math.max(0.0004, 360 / 2 ** Math.max(1, zoom) / 1.6);
}

export type Clusterable = { lat: number; lng: number };

export function clusterPoints<T extends Clusterable>(points: T[], zoom: number) {
  const cell = clusterCell(zoom);
  const buckets = new Map<string, T[]>();
  for (const point of points) {
    const key = `${Math.floor(point.lat / cell)}:${Math.floor(point.lng / cell)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(point);
    else buckets.set(key, [point]);
  }
  return Array.from(buckets.entries()).map(([key, items]) => ({
    key,
    items,
    lat: items.reduce((sum, p) => sum + p.lat, 0) / items.length,
    lng: items.reduce((sum, p) => sum + p.lng, 0) / items.length,
  }));
}
