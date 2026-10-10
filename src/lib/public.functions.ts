import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PublicMoment = {
  id: string;
  caption: string;
  taken_at: string;
  place_name: string | null;
  city: string | null;
  country: string | null;
  created_at: string;
  space: { name: string; handle: string | null };
  photos: string[];
};

export const listPublicMoments = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicMoment[]> => {
    const { createPublicClient } = await import("@/lib/supabase-public.server");
    const { publicMediaUrl } = await import("@/lib/public-media.server");
    const { previewPath } = await import("@/lib/image");
    const supabase = createPublicClient();

    const { data, error } = await supabase
      .from("posts")
      .select(
        "id, caption, taken_at, place_name, city, country, created_at, spaces(name, handle), post_media(storage_path, position)",
      )
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(48);

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      caption: row.caption,
      taken_at: row.taken_at,
      place_name: row.place_name,
      city: row.city,
      country: row.country,
      created_at: row.created_at,
      space: { name: row.spaces?.name ?? "Two people", handle: row.spaces?.handle ?? null },
      // Proxy URLs, not signed storage URLs: these are stable, so a CDN can
      // cache them, and they are grid-sized rather than full resolution.
      photos: (row.post_media ?? [])
        .sort((a, b) => a.position - b.position)
        .map((m) => publicMediaUrl(previewPath(m.storage_path))),
    }));
  },
);

export const getPublicSpace = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ handle: z.string().min(1).max(60) }).parse(input))
  .handler(async ({ data }) => {
    const { createPublicClient } = await import("@/lib/supabase-public.server");
    const { publicMediaUrl } = await import("@/lib/public-media.server");
    const { previewPath } = await import("@/lib/image");
    const supabase = createPublicClient();

    const { data: space } = await supabase
      .from("spaces")
      .select("id, name, handle, anniversary_date, cover_path")
      .eq("handle", data.handle)
      .eq("is_public", true)
      .maybeSingle();

    if (!space) return null;

    const { data: posts } = await supabase
      .from("posts")
      .select(
        "id, caption, taken_at, place_name, city, country, created_at, post_media(storage_path, position)",
      )
      .eq("space_id", space.id)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(60);

    const rows = posts ?? [];

    return {
      name: space.name,
      handle: space.handle,
      anniversary_date: space.anniversary_date,
      moments: rows.map((row) => ({
        id: row.id,
        caption: row.caption,
        taken_at: row.taken_at,
        place_name: row.place_name,
        city: row.city,
        country: row.country,
        created_at: row.created_at,
        space: { name: space.name, handle: space.handle },
        photos: (row.post_media ?? [])
          .sort((a, b) => a.position - b.position)
          .map((m) => publicMediaUrl(previewPath(m.storage_path))),
      })) as PublicMoment[],
    };
  });
