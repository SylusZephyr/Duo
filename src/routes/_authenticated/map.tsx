import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Crosshair, Layers, Route as RouteIcon, Sparkles, Star, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { PlacePicker } from "@/components/place-picker";
import { SignedImage } from "@/components/signed-image";
import { WorldMap, type MapCluster, type MapFocus, type MapPoint } from "@/components/world-map";
import { supabase } from "@/integrations/supabase/client";
import { formatKm, pathLengthKm } from "@/lib/geo";
import { formatShortDay } from "@/lib/format";
import type { PlaceHit } from "@/lib/maps.functions";
import { useMe, useMoments, useSignedUrls, useWishlist } from "@/lib/queries";
import { useRequireSpace } from "@/lib/use-require-space";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/map")({
  head: () => ({
    meta: [
      { title: "Your places — Duo" },
      {
        name: "description",
        content: "Every place the two of you have been, pinned from your photos, plus the ones you still dream of.",
      },
      { property: "og:title", content: "Your places — Duo" },
      { property: "og:description", content: "A world map built from your moments." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { data } = useRequireSpace();
  const spaceId = data?.space.id;
  const { data: moments } = useMoments(spaceId);
  const { data: wishlist } = useWishlist(spaceId);

  const [year, setYear] = useState<string>("all");
  const [journey, setJourney] = useState(true);
  const [satellite, setSatellite] = useState(false);
  const [showDreams, setShowDreams] = useState(true);
  const [selected, setSelected] = useState<MapCluster | null>(null);
  const [focus, setFocus] = useState<MapFocus>(null);
  const [dream, setDream] = useState<PlaceHit | null>(null);
  const [savingDream, setSavingDream] = useState(false);

  const located = useMemo(
    () => (moments ?? []).filter((moment) => moment.lat !== null && moment.lng !== null),
    [moments],
  );

  const years = useMemo(
    () =>
      Array.from(new Set(located.map((moment) => moment.taken_at.slice(0, 4)))).sort().reverse(),
    [located],
  );

  const inYear = useMemo(
    () => (year === "all" ? located : located.filter((m) => m.taken_at.startsWith(year))),
    [located, year],
  );

  const thumbPaths = useMemo(
    () => inYear.map((moment) => moment.media[0]?.storage_path).filter(Boolean) as string[],
    [inYear],
  );
  const { data: signed } = useSignedUrls(thumbPaths);

  const points = useMemo<MapPoint[]>(() => {
    const visited: MapPoint[] = inYear.map((moment) => ({
      id: moment.id,
      lat: moment.lat!,
      lng: moment.lng!,
      label: moment.place_name ?? moment.city ?? "Somewhere",
      photoUrl: (moment.media[0] ? signed?.[moment.media[0].storage_path] : null) ?? null,
      kind: "visited",
    }));
    if (!showDreams) return visited;
    const dreams: MapPoint[] = (wishlist ?? [])
      .filter((place) => place.lat !== null && place.lng !== null && !place.visited)
      .map((place) => ({
        id: `wish-${place.id}`,
        lat: place.lat!,
        lng: place.lng!,
        label: place.name,
        kind: "wish" as const,
      }));
    return [...visited, ...dreams];
  }, [inYear, signed, wishlist, showDreams]);

  const journeyPath = useMemo(() => {
    if (!journey) return undefined;
    return inYear
      .slice()
      .sort((a, b) => a.taken_at.localeCompare(b.taken_at))
      .map((moment) => ({ lat: moment.lat!, lng: moment.lng! }));
  }, [inYear, journey]);

  const km = useMemo(
    () =>
      pathLengthKm(
        inYear
          .slice()
          .sort((a, b) => a.taken_at.localeCompare(b.taken_at))
          .map((m) => ({ lat: m.lat!, lng: m.lng! })),
      ),
    [inYear],
  );

  const cities = new Set(inYear.map((m) => m.city).filter(Boolean));
  const countries = new Set(inYear.map((m) => m.country).filter(Boolean));

  const handleSelect = useCallback((cluster: MapCluster) => {
    setSelected(cluster);
    setFocus({ lat: cluster.lat, lng: cluster.lng, zoom: 12, nonce: Date.now() });
  }, []);

  const selectedMoments = useMemo(() => {
    if (!selected) return [];
    const ids = new Set(selected.items.map((item) => item.id));
    return located.filter((moment) => ids.has(moment.id));
  }, [selected, located]);

  async function saveDream() {
    if (!dream || !me || !spaceId) return;
    setSavingDream(true);
    try {
      const { error } = await supabase.from("wishlist_places").insert({
        space_id: spaceId,
        created_by: me.id,
        name: dream.name,
        city: dream.city,
        country: dream.country,
        lat: dream.lat,
        lng: dream.lng,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["wishlist_places", spaceId] });
      setDream(null);
      toast.success("Added to someday");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save that place");
    } finally {
      setSavingDream(false);
    }
  }

  async function markVisited(id: string) {
    if (!spaceId) return;
    const { error } = await supabase.from("wishlist_places").update({ visited: true }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["wishlist_places", spaceId] });
    toast.success("Crossed off. You went.");
  }

  return (
    <AppShell title="Places" subtitle={`${cities.size} cities · ${countries.size} countries`}>
      {/* Journey filmstrip */}
      {years.length > 0 ? (
        <div className="hide-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5">
          {["all", ...years].map((value) => (
            <button
              key={value}
              onClick={() => {
                setYear(value);
                setSelected(null);
              }}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-xs uppercase tracking-[0.14em] transition-colors",
                year === value
                  ? "border-ember bg-ember/10 text-ember"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "all" ? "Whole story" : value}
            </button>
          ))}
        </div>
      ) : null}

      {/* Map canvas */}
      <div className="relative -mx-5 overflow-hidden border-y border-border/60 bg-ash">
        <div className="h-[62vh] w-full">
          <WorldMap
            points={points}
            {...(journeyPath ? { route: journeyPath } : {})}
            selectedKey={selected?.key ?? null}
            onSelect={handleSelect}
            mapType={satellite ? "hybrid" : "roadmap"}
            focus={focus}
            className="h-full w-full"
          />
        </div>

        {/* Floating controls */}
        <div className="absolute right-4 top-4 flex flex-col gap-2">
          <MapToggle
            active={journey}
            onClick={() => setJourney((v) => !v)}
            label="Journey line"
            icon={<RouteIcon className="size-4" />}
          />
          <MapToggle
            active={satellite}
            onClick={() => setSatellite((v) => !v)}
            label="Satellite detail"
            icon={<Layers className="size-4" />}
          />
          <MapToggle
            active={showDreams}
            onClick={() => setShowDreams((v) => !v)}
            label="Someday places"
            icon={<Star className="size-4" />}
          />
          <MapToggle
            active={false}
            onClick={() => {
              setSelected(null);
              const first = points[0];
              if (first) setFocus({ lat: first.lat, lng: first.lng, zoom: 3, nonce: Date.now() });
            }}
            label="Zoom out"
            icon={<Crosshair className="size-4" />}
          />
        </div>

        {/* Distance ribbon */}
        {inYear.length > 1 ? (
          <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-border/70 bg-background/80 px-4 py-2 backdrop-blur-md">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Travelled together
            </p>
            <p className="font-display text-xl leading-none">{formatKm(km)}</p>
          </div>
        ) : null}
      </div>

      {/* Selected place sheet */}
      {selected ? (
        <section className="mt-5 rounded-3xl border border-ember/30 bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl leading-tight">{selected.items[0]?.label}</h2>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {selected.items.length} moment{selected.items.length === 1 ? "" : "s"} here
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setFocus({ lat: selected.lat, lng: selected.lng, zoom: 17, nonce: Date.now() })
                }
                className="rounded-full border border-border px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Street level
              </button>
              <button onClick={() => setSelected(null)} aria-label="Close place">
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {selectedMoments.length > 0 ? (
            <div className="hide-scrollbar mt-4 flex gap-3 overflow-x-auto pb-1">
              {selectedMoments.map((moment) => (
                <Link
                  key={moment.id}
                  to="/moment/$momentId"
                  params={{ momentId: moment.id }}
                  className="w-36 shrink-0"
                >
                  <SignedImage
                    path={moment.media[0]?.storage_path}
                    blurDataUrl={moment.media[0]?.blur_data_url ?? null}
                    alt={moment.caption || (selected.items[0]?.label ?? "Moment")}
                    className="aspect-[4/5] w-full rounded-2xl"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatShortDay(moment.taken_at)}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              A place you still want to go. Keep it on the map.
            </p>
          )}
        </section>
      ) : null}

      {points.length === 0 ? (
        <p className="mt-5 rounded-3xl border border-border bg-card px-6 py-10 text-center text-sm leading-relaxed text-muted-foreground">
          Tag a place when you add a moment and it lands here as a photo pin. Add a dream below and
          the map will hold it until you go.
        </p>
      ) : null}

      {/* Someday list */}
      <section className="mt-7 space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl">Someday</h2>
          <span className="flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-gold">
            <Sparkles className="size-3.5" /> {(wishlist ?? []).filter((p) => !p.visited).length} to go
          </span>
        </div>
        <PlacePicker value={dream} onChange={setDream} />
        {dream ? (
          <button
            onClick={saveDream}
            disabled={savingDream}
            className="h-12 w-full rounded-2xl bg-ember text-sm font-medium text-ember-foreground transition-opacity disabled:opacity-60"
          >
            Add to someday
          </button>
        ) : null}
        {(wishlist ?? []).length > 0 ? (
          <ul className="overflow-hidden rounded-3xl border border-border bg-card">
            {(wishlist ?? []).map((place) => (
              <li
                key={place.id}
                className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3.5 last:border-0"
              >
                <button
                  onClick={() =>
                    place.lat !== null &&
                    place.lng !== null &&
                    setFocus({ lat: place.lat, lng: place.lng, zoom: 10, nonce: Date.now() })
                  }
                  className="min-w-0 flex-1 text-left"
                >
                  <p className={cn("truncate text-sm", place.visited && "line-through opacity-60")}>
                    {place.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[place.city, place.country].filter(Boolean).join(" · ")}
                  </p>
                </button>
                {place.visited ? (
                  <span className="text-[10px] uppercase tracking-[0.14em] text-gold">Been</span>
                ) : (
                  <button
                    onClick={() => markVisited(place.id)}
                    className="rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    We went
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* Every place */}
      {cities.size > 0 ? (
        <section className="mt-7 space-y-2">
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Cities you two have been
          </h2>
          <div className="flex flex-wrap gap-2">
            {Array.from(cities).map((city) => {
              const first = inYear.find((m) => m.city === city);
              return (
                <button
                  key={city as string}
                  onClick={() =>
                    first &&
                    setFocus({ lat: first.lat!, lng: first.lng!, zoom: 11, nonce: Date.now() })
                  }
                  className="rounded-full border border-border bg-card px-3.5 py-1.5 text-xs transition-colors hover:border-ember/50"
                >
                  {city}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}

function MapToggle({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "flex size-10 items-center justify-center rounded-full border backdrop-blur-md transition-colors",
        active
          ? "border-ember bg-ember/20 text-ember"
          : "border-border/70 bg-background/75 text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
    </button>
  );
}
