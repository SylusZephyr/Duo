/* eslint-disable @typescript-eslint/no-explicit-any */
let loader: Promise<any> | null = null;

export function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("Maps needs a browser"));
  const w = window as any;
  if (w.google?.maps) return Promise.resolve(w.google.maps);
  if (loader) return loader;

  const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
  const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"];

  loader = new Promise((resolve, reject) => {
    if (!key) {
      reject(new Error("Maps key is missing"));
      return;
    }
    w.__duoInitMaps = () => resolve(w.google.maps);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__duoInitMaps${
      channel ? `&channel=${channel}` : ""
    }`;
    script.async = true;
    script.onerror = () => reject(new Error("Maps failed to load"));
    document.head.appendChild(script);
  });

  return loader;
}

export const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1d1a17" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9a9086" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#141210" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#2a2521" }] },
  {
    featureType: "administrative.country",
    elementType: "labels.text.fill",
    stylers: [{ color: "#b8a894" }],
  },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2b2622" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f0d0c" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#221e1a" }] },
];
