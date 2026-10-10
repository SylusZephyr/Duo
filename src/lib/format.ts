export function daysBetween(from: string | Date, to: Date = new Date()) {
  const start = typeof from === "string" ? new Date(from + "T00:00:00") : from;
  const ms = to.getTime() - start.getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

export function formatDay(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value.length <= 10 ? value + "T00:00:00" : value);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

export function formatShortDay(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value.length <= 10 ? value + "T00:00:00" : value);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatShortDay(value);
}

export function placeLabel(post: {
  place_name?: string | null;
  city?: string | null;
  country?: string | null;
}) {
  return [post.place_name, post.city, post.country].filter(Boolean).join(" · ");
}
