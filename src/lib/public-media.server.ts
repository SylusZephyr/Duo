/**
 * Cached proxy for publicly shared photos, and the health endpoint.
 *
 * Both live here rather than in a route file because they are plain
 * request/response handlers with no UI, and src/server.ts dispatches to them
 * before handing anything to the SSR renderer.
 *
 * Why a proxy at all. Public pages used to embed signed storage URLs. Those
 * expire, so every visitor got a fresh one, so no CDN anywhere could cache a
 * single byte: a moment that gets shared a thousand times cost a thousand
 * full downloads out of Supabase. Storage egress is the first free-tier limit
 * an app like this hits — see SCALING.md. Serving the bytes from our own
 * origin with cache headers lets Cloudflare answer almost every request at
 * the edge, and keeps the storage URL out of the page.
 */

import { previewPath } from "@/lib/image";

/** Public URL for a stored object, as embedded in a page. */
export function publicMediaUrl(storagePath: string): string {
  return `/i/${storagePath.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Browsers hold a copy for ten minutes; Cloudflare holds one for an hour.
 *
 * Not `immutable`, even though the paths are unique and the bytes never
 * change, because the *permission* can: un-publishing a moment or a moderator
 * taking it down has to actually stop it being served. An hour is the window
 * where a taken-down photo may still come from an edge cache — short enough
 * to be defensible, long enough that the egress saving is the whole point.
 */
const CACHE_CONTROL = "public, max-age=600, s-maxage=3600, stale-while-revalidate=60";

/**
 * Serve `/i/<storage path>`.
 *
 * The path is checked against the database before a single byte is fetched:
 * only an object belonging to a post that is currently public is served. The
 * check uses the anonymous key, so row-level security — the same rules that
 * decide what a stranger sees on Explore — is what answers the question. Get
 * this wrong and the route is an open read proxy for every private space in
 * the app, so it fails closed on anything it cannot positively confirm.
 */
export async function handlePublicMedia(request: Request): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
  }

  const raw = new URL(request.url).pathname.slice("/i/".length);
  let storagePath: string;
  try {
    storagePath = decodeURIComponent(raw);
  } catch {
    return notFound();
  }

  // No traversal, no absolute paths, nothing outside the layout uploads use.
  if (!storagePath || storagePath.includes("..") || !storagePath.startsWith("spaces/")) {
    return notFound();
  }

  // The original an `.preview` path was derived from — the fallback for a
  // moment uploaded before derivatives existed, and the subject of the
  // visibility check either way.
  const original = originalOf(storagePath);

  if (!(await isPubliclyVisible(storagePath, original))) return notFound();

  const { signPaths } = await import("@/lib/media.server");
  const wanted = original ? [storagePath, original] : [storagePath];
  const signed = await signPaths(wanted, 120);

  let upstream: Response | undefined;
  for (const candidate of wanted) {
    const url = signed[candidate];
    if (!url) continue;
    const attempt = await fetch(url, {
      method: request.method,
      signal: AbortSignal.timeout(10_000),
    });
    if (attempt.ok) {
      upstream = attempt;
      break;
    }
  }
  if (!upstream) return notFound();

  const headers = new Headers();
  headers.set("content-type", upstream.headers.get("content-type") ?? "image/webp");
  const length = upstream.headers.get("content-length");
  if (length) headers.set("content-length", length);
  headers.set("cache-control", CACHE_CONTROL);
  // The response body is identical for everyone, which is what makes it
  // cacheable — say so, so no cache ever keys it on a cookie.
  headers.set("vary", "accept-encoding");
  headers.set("x-content-type-options", "nosniff");

  return new Response(request.method === "HEAD" ? null : upstream.body, { status: 200, headers });
}

/**
 * The image a `.preview` path was derived from, or null if this is not one.
 *
 * Round-tripped through previewPath rather than trusted: a path that merely
 * happens to contain ".preview" must not be rewritten into a different
 * object, since the rewritten name is what gets permission-checked.
 */
function originalOf(storagePath: string): string | null {
  const original = storagePath.replace(/\.preview(\.[^.]+)?$/, (_match, ext) => ext ?? "");
  if (original === storagePath) return null;
  return previewPath(original) === storagePath ? original : null;
}

/**
 * Is this object part of a currently-public post?
 *
 * Accepts the preview derivative as well as the original: the derivative is
 * not a row of its own, so it inherits the visibility of the image it was
 * made from.
 */
async function isPubliclyVisible(storagePath: string, original: string | null): Promise<boolean> {
  const candidates = original ? [storagePath, original] : [storagePath];

  try {
    const { createPublicClient } = await import("@/lib/supabase-public.server");
    const supabase = createPublicClient();

    const { data: media } = await supabase
      .from("post_media")
      .select("id")
      .in("storage_path", candidates)
      .limit(1);
    if (media && media.length > 0) return true;

    // Space cover images are shown on a public space page.
    const { data: space } = await supabase
      .from("spaces")
      .select("id")
      .in("cover_path", candidates)
      .eq("is_public", true)
      .limit(1);
    return Boolean(space && space.length > 0);
  } catch (error) {
    console.error("[media] visibility check failed", error);
    return false;
  }
}

function notFound(): Response {
  // Deliberately identical for "does not exist" and "exists but is private":
  // a different response would let anyone enumerate private spaces.
  return new Response("Not found", {
    status: 404,
    headers: { "cache-control": "public, max-age=60", "content-type": "text/plain" },
  });
}

/**
 * `/healthz` — is this deployment actually able to serve requests?
 *
 * Uptime monitors need something cheaper than a rendered page, and a check
 * that only proves the worker is running would stay green through the failure
 * that actually happens: a Supabase project paused for inactivity, which on
 * the free tier happens after about a week idle. So it touches the database.
 * One tiny indexed read, never cached.
 */
export async function handleHealth(): Promise<Response> {
  const startedAt = Date.now();
  let database: "ok" | "unreachable" = "unreachable";
  let detail: string | undefined;

  try {
    const { createPublicClient } = await import("@/lib/supabase-public.server");
    // An unreachable database fails by hanging, not by erroring, and a check
    // that takes 30 seconds to say "down" reads as a timeout to every uptime
    // monitor. Give up early and report it.
    const { error } = await createPublicClient()
      .from("posts")
      .select("id", { count: "exact", head: true })
      .limit(1)
      .abortSignal(AbortSignal.timeout(3000));
    if (error) detail = error.message;
    else database = "ok";
  } catch (error) {
    detail = error instanceof Error ? error.message : String(error);
  }

  const healthy = database === "ok";
  return new Response(
    JSON.stringify({
      status: healthy ? "ok" : "degraded",
      database,
      ...(detail ? { detail } : {}),
      latency_ms: Date.now() - startedAt,
      checked_at: new Date().toISOString(),
    }),
    {
      status: healthy ? 200 : 503,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    },
  );
}
