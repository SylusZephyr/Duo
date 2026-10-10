/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";

import { loadGoogleMaps, MAP_STYLE } from "@/lib/google-maps";
import { clusterPoints } from "@/lib/geo";

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  photoUrl?: string | null;
  kind?: "visited" | "wish";
};

export type MapCluster = {
  key: string;
  lat: number;
  lng: number;
  items: MapPoint[];
};

export type MapFocus = { lat: number; lng: number; zoom: number; nonce: number } | null;

/** Lazily built OverlayView subclass — it can only exist once the Maps SDK is present. */
function makePinClass(maps: any) {
  return class DuoPin extends maps.OverlayView {
    cluster: MapCluster;
    selected: boolean;
    onClick: () => void;
    node: HTMLDivElement | null = null;

    constructor(cluster: MapCluster, selected: boolean, onClick: () => void) {
      super();
      this.cluster = cluster;
      this.selected = selected;
      this.onClick = onClick;
    }

    onAdd() {
      const count = this.cluster.items.length;
      const wish = this.cluster.items.every((item) => item.kind === "wish");
      const photo = this.cluster.items.find((item) => item.photoUrl)?.photoUrl;

      const node = document.createElement("div");
      node.style.position = "absolute";
      node.style.transform = "translate(-50%, -100%)";
      node.style.cursor = "pointer";
      node.className = "duo-pin";
      node.setAttribute("role", "button");
      node.setAttribute("aria-label", `${this.cluster.items[0]?.label ?? "Place"}, ${count} moment${count === 1 ? "" : "s"}`);

      const ring = wish ? "border-gold/80 border-dashed" : "border-ember";
      const scale = this.selected ? "scale-115" : "";
      node.innerHTML = `
        <div class="flex flex-col items-center ${scale} transition-transform duration-300">
          <div class="relative size-12 overflow-hidden rounded-full border-2 ${ring} bg-card shadow-[0_8px_24px_-8px_rgba(0,0,0,0.8)]">
            ${
              photo
                ? `<img src="${photo}" alt="" class="h-full w-full object-cover" />`
                : `<div class="flex h-full w-full items-center justify-center text-[13px] text-gold">${wish ? "✦" : "•"}</div>`
            }
            ${
              count > 1
                ? `<span class="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-ember text-[10px] font-semibold text-ember-foreground">${count > 99 ? "99" : count}</span>`
                : ""
            }
          </div>
          <span class="mt-0.5 size-2 rotate-45 border-b-2 border-r-2 ${ring} bg-card"></span>
        </div>`;

      node.addEventListener("click", (event) => {
        event.stopPropagation();
        this.onClick();
      });
      this.node = node;
      (this as any)["getPanes"]().floatPane.appendChild(node);
    }

    draw() {
      if (!this.node) return;
      const projection = (this as any)["getProjection"]();
      if (!projection) return;
      const position = projection.fromLatLngToDivPixel(
        new maps.LatLng(this.cluster.lat, this.cluster.lng),
      );
      if (!position) return;
      this.node.style.left = `${position.x}px`;
      this.node.style.top = `${position.y}px`;
    }

    onRemove() {
      this.node?.remove();
      this.node = null;
    }
  };
}

export function WorldMap({
  points,
  route,
  selectedKey,
  onSelect,
  onClusters,
  mapType = "roadmap",
  focus,
  className,
}: {
  points: MapPoint[];
  route?: { lat: number; lng: number }[];
  selectedKey?: string | null;
  onSelect?: (cluster: MapCluster) => void;
  onClusters?: (clusters: MapCluster[]) => void;
  mapType?: "roadmap" | "hybrid";
  focus?: MapFocus;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const pinClassRef = useRef<any>(null);
  const pinsRef = useRef<any[]>([]);
  const routeRef = useRef<any>(null);
  const fittedRef = useRef(false);
  const [zoom, setZoom] = useState(2);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        const map = new maps.Map(containerRef.current, {
          center: { lat: 20, lng: 10 },
          zoom: 2,
          minZoom: 2,
          maxZoom: 20,
          disableDefaultUI: true,
          gestureHandling: "greedy",
          clickableIcons: false,
          styles: MAP_STYLE,
        });
        mapRef.current = map;
        pinClassRef.current = makePinClass(maps);
        map.addListener("zoom_changed", () => setZoom(map.getZoom() ?? 2));
        setReady(true);
      })
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mapRef.current) mapRef.current.setMapTypeId(mapType);
  }, [mapType, ready]);

  const clusters = useMemo<MapCluster[]>(
    () =>
      clusterPoints(points, zoom).map((group) => ({
        key: group.key,
        lat: group.lat,
        lng: group.lng,
        items: group.items,
      })),
    [points, zoom],
  );

  useEffect(() => {
    onClusters?.(clusters);
  }, [clusters, onClusters]);

  /* Pins */
  useEffect(() => {
    const map = mapRef.current;
    const Pin = pinClassRef.current;
    if (!map || !Pin) return;

    pinsRef.current.forEach((pin) => pin.setMap(null));
    pinsRef.current = clusters.map((cluster) => {
      const pin = new Pin(cluster, cluster.key === selectedKey, () => onSelect?.(cluster));
      pin.setMap(map);
      return pin;
    });
  }, [clusters, selectedKey, onSelect, ready]);

  /* Journey line */
  useEffect(() => {
    const maps = (window as any).google?.maps;
    const map = mapRef.current;
    if (!maps || !map) return;
    routeRef.current?.setMap(null);
    routeRef.current = null;
    if (!route || route.length < 2) return;
    routeRef.current = new maps.Polyline({
      map,
      path: route,
      geodesic: true,
      strokeOpacity: 0,
      icons: [
        {
          icon: {
            path: "M 0,-1 0,1",
            strokeColor: "#e7c07a",
            strokeOpacity: 0.85,
            scale: 2.4,
          },
          offset: "0",
          repeat: "11px",
        },
      ],
    });
  }, [route, ready]);

  /* First fit */
  useEffect(() => {
    const maps = (window as any).google?.maps;
    const map = mapRef.current;
    if (!maps || !map || fittedRef.current || points.length === 0) return;
    fittedRef.current = true;
    if (points.length === 1) {
      map.setCenter({ lat: points[0]!.lat, lng: points[0]!.lng });
      map.setZoom(9);
      return;
    }
    const bounds = new maps.LatLngBounds();
    points.forEach((point) => bounds.extend({ lat: point.lat, lng: point.lng }));
    map.fitBounds(bounds, 72);
  }, [points, ready]);

  /* Smooth fly-to */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    map.panTo({ lat: focus.lat, lng: focus.lng });
    const current = map.getZoom() ?? 2;
    const step = focus.zoom > current ? 1 : -1;
    let level = current;
    const timer = setInterval(() => {
      level += step;
      map.setZoom(level);
      if ((step > 0 && level >= focus.zoom) || (step < 0 && level <= focus.zoom)) {
        clearInterval(timer);
        map.panTo({ lat: focus.lat, lng: focus.lng });
      }
    }, 120);
    return () => clearInterval(timer);
  }, [focus]);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-ash p-8 text-center">
        <p className="font-display text-xl">The map is resting</p>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          It couldn&apos;t load here — your places are still safe below. {error}
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className={className} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-background/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/80 to-transparent" />
    </div>
  );
}
