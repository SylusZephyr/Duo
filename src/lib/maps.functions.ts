import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Google Maps, called directly.
 *
 * These used to go through a hosted connector gateway that proxied the same
 * two Google endpoints and authenticated with a platform key. Talking to
 * Google ourselves removes that dependency; the only thing needed now is a
 * Maps API key of your own in GOOGLE_MAPS_API_KEY, with the Places API (New)
 * and Geocoding API enabled on the project.
 */
const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const GEOCODE_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";

export type PlaceHit = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  city: string | null;
  country: string | null;
};

function mapsKey() {
  const key = process.env["GOOGLE_MAPS_API_KEY"];
  if (!key) throw new Error("Maps is not configured yet");
  return key;
}

async function readError(response: Response) {
  const body = await response.text();
  console.error(`Google Maps request failed [${response.status}]: ${body}`);
  if (response.status === 403) {
    throw new Error("Maps request was denied. Check the Google Maps API key and its restrictions.");
  }
  throw new Error(`Maps request failed (${response.status})`);
}

/** A server key must not be sent from a browser, so both calls stay server-side. */
export const searchPlaces = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ query: z.string().trim().min(2).max(120) }).parse(input))
  .handler(async ({ data }): Promise<PlaceHit[]> => {
    const response = await fetch(PLACES_ENDPOINT, {
      method: "POST",
      headers: {
        "X-Goog-Api-Key": mapsKey(),
        "Content-Type": "application/json",
        // Places (New) bills by the fields requested, so ask for only these.
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents",
      },
      body: JSON.stringify({ textQuery: data.query, maxResultCount: 8 }),
    });
    if (!response.ok) await readError(response);

    const json = (await response.json()) as {
      places?: Array<{
        id: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude: number; longitude: number };
        addressComponents?: Array<{ longText?: string; types?: string[] }>;
      }>;
    };

    return (json.places ?? []).map((place) => {
      const components = place.addressComponents ?? [];
      const pick = (type: string) =>
        components.find((c) => (c.types ?? []).includes(type))?.longText ?? null;
      return {
        id: place.id,
        name: place.displayName?.text ?? place.formattedAddress ?? "Unknown place",
        address: place.formattedAddress ?? "",
        lat: place.location?.latitude ?? 0,
        lng: place.location?.longitude ?? 0,
        city: pick("locality") ?? pick("postal_town") ?? pick("administrative_area_level_2"),
        country: pick("country"),
      };
    });
  });

export const reverseGeocode = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ lat: z.number(), lng: z.number() }).parse(input))
  .handler(async ({ data }): Promise<PlaceHit | null> => {
    const url = new URL(GEOCODE_ENDPOINT);
    url.searchParams.set("latlng", `${data.lat},${data.lng}`);
    url.searchParams.set("key", mapsKey());

    const response = await fetch(url);
    if (!response.ok) await readError(response);

    const json = (await response.json()) as {
      results?: Array<{
        place_id: string;
        formatted_address: string;
        address_components?: Array<{ long_name: string; types: string[] }>;
      }>;
    };
    const result = json.results?.[0];
    if (!result) return null;
    const components = result.address_components ?? [];
    const pick = (type: string) =>
      components.find((c) => c.types.includes(type))?.long_name ?? null;
    return {
      id: result.place_id,
      name: pick("neighborhood") ?? pick("locality") ?? result.formatted_address,
      address: result.formatted_address,
      lat: data.lat,
      lng: data.lng,
      city: pick("locality") ?? pick("postal_town") ?? pick("administrative_area_level_2"),
      country: pick("country"),
    };
  });
