import { supabase } from "@/integrations/supabase/client";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";

/**
 * Address helpers backed by the `medical-search` edge function (NPPES swap).
 *
 * The browser never calls a geocoder or Google directly. Autocomplete is
 * Photon-backed and returns coordinates inline, so there is no follow-up
 * "details" round-trip; `getPlaceDetails` resolves the synthetic id locally.
 *
 * File name kept for now to limit churn — nothing Google is left here.
 */

export interface PlacePrediction {
  description: string;
  /** Synthetic id "geo:<lat>,<lng>" — resolvable locally, no details call. */
  place_id: string;
  latitude: number | null;
  longitude: number | null;
}

export interface PlaceDetails {
  name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  types: string[];
}

/** Parse a "geo:<lat>,<lng>" synthetic place id. */
function parseGeoId(placeId: string): { lat: number; lng: number } | null {
  const m = /^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(placeId.trim());
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/**
 * Address autocomplete, biased to the user's location. Predictions carry
 * coordinates inline.
 */
export async function autocompletePlaces(
  input: string,
  bias: { lat: number; lng: number } | null
): Promise<PlacePrediction[]> {
  const trimmed = input.trim();
  if (trimmed.length < 3) return [];
  try {
    const { data, error } = await supabase.functions.invoke("medical-search", {
      body: {
        action: "autocomplete",
        query: trimmed,
        deviceId: getDeviceFingerprint(),
        location: bias ? { latitude: bias.lat, longitude: bias.lng } : null,
      },
    });
    if (error || !data || !Array.isArray(data.predictions)) return [];
    return data.predictions
      .map((p: Record<string, unknown>) => ({
        description: String(p?.description ?? ""),
        place_id: String(p?.place_id ?? ""),
        latitude: typeof p?.latitude === "number" ? (p.latitude as number) : null,
        longitude: typeof p?.longitude === "number" ? (p.longitude as number) : null,
      }))
      .filter((p: PlacePrediction) => p.description && p.place_id);
  } catch {
    return [];
  }
}

/**
 * Exact address for a coordinate, via the edge `reverse` action (Nominatim).
 * Used by the "add here" / GPS flows where the coordinate is authoritative and
 * we only need a human-readable address to show.
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<{ address: string; placeId: string | null } | null> {
  try {
    const { data, error } = await supabase.functions.invoke("medical-search", {
      body: { action: "reverse", lat, lng },
    });
    if (error || !data?.address) return null;
    return { address: String(data.address), placeId: null };
  } catch {
    return null;
  }
}

/**
 * Resolve an autocomplete pick to coordinates. Photon ids carry the point in
 * the `geo:` prefix, so this is a local parse; a `geocode` call is the fallback
 * for any id that arrives without coordinates.
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const geo = parseGeoId(placeId);
  if (geo) {
    return {
      name: null,
      address: null,
      latitude: geo.lat,
      longitude: geo.lng,
      phone: null,
      types: [],
    };
  }
  try {
    const { data, error } = await supabase.functions.invoke("medical-search", {
      body: { action: "geocode", query: placeId },
    });
    const first = Array.isArray(data?.results) ? data.results[0] : null;
    const lat = first?.geometry?.location?.lat;
    const lng = first?.geometry?.location?.lng;
    if (error || typeof lat !== "number" || typeof lng !== "number") return null;
    return {
      name: null,
      address: typeof first?.formatted_address === "string" ? first.formatted_address : null,
      latitude: lat,
      longitude: lng,
      phone: null,
      types: [],
    };
  } catch {
    return null;
  }
}
