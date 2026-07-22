import { supabase } from "@/integrations/supabase/client";
import { loadGoogleMaps } from "@/lib/google-maps";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";

/**
 * Browser-side Google Places/Geocoding helpers built on the Maps JS API.
 *
 * These exist because the shared `google-places` edge function's `autocomplete`
 * action ignores location bias (it can't be changed — shared backend), which
 * makes typed-address suggestions wander to unrelated areas. Running Places
 * client-side lets us bias to the user's position and read exact coordinates.
 */

export interface PlacePrediction {
  description: string;
  place_id: string;
}

export interface PlaceDetails {
  name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  types: string[];
}

/**
 * Whether the shared `medical-search` edge function exposes an `autocomplete`
 * action. Probed once per session: null = unknown, true/false = known. When the
 * mobile team deploys that action, we automatically switch to it — no rebuild.
 */
let serverAutocompleteAvailable: boolean | null = null;

/** Server-side autocomplete via the rate-limited edge function (preferred). */
async function serverAutocomplete(
  input: string,
  bias: { lat: number; lng: number } | null
): Promise<PlacePrediction[] | null> {
  try {
    const { data, error } = await supabase.functions.invoke("medical-search", {
      body: {
        action: "autocomplete",
        query: input,
        deviceId: getDeviceFingerprint(),
        location: bias ? { latitude: bias.lat, longitude: bias.lng } : null,
      },
    });

    // `unknown_action` (not deployed) or a transport error → signal "unavailable"
    // so the caller falls back to the client-side path.
    if (error || !data || data.ok === false || !Array.isArray(data.predictions)) {
      return null;
    }
    return data.predictions
      .map((p: { place_id?: string; description?: string }) => ({
        description: String(p?.description ?? ""),
        place_id: String(p?.place_id ?? ""),
      }))
      .filter((p: PlacePrediction) => p.description && p.place_id);
  } catch {
    return null;
  }
}

/** Client-side autocomplete via Maps JS (fallback; needs the browser key). */
async function clientAutocomplete(
  input: string,
  bias: { lat: number; lng: number; radiusMeters?: number } | null
): Promise<PlacePrediction[]> {
  try {
    const google = await loadGoogleMaps();
    const service = new google.maps.places.AutocompleteService();
    const request: google.maps.places.AutocompletionRequest = { input };
    if (bias) {
      // A circular bias keeps predictions near the user without hard-excluding
      // valid matches slightly outside it.
      request.locationBias = {
        center: { lat: bias.lat, lng: bias.lng },
        radius: bias.radiusMeters ?? 30000,
      };
    }
    const res = await service.getPlacePredictions(request);
    return (res.predictions ?? []).map((p) => ({
      description: p.description,
      place_id: p.place_id,
    }));
  } catch {
    return [];
  }
}

/**
 * Autocomplete biased to the user's location so nearby matches rank first.
 *
 * Prefers the rate-limited, server-side edge action (key stays server-side);
 * falls back to client-side Maps JS when that action isn't deployed. The
 * server capability is probed once and cached for the session.
 */
export async function autocompletePlaces(
  input: string,
  bias: { lat: number; lng: number; radiusMeters?: number } | null
): Promise<PlacePrediction[]> {
  const trimmed = input.trim();
  if (trimmed.length < 3) return [];

  if (serverAutocompleteAvailable !== false) {
    const server = await serverAutocomplete(trimmed, bias);
    if (server !== null) {
      serverAutocompleteAvailable = true;
      return server;
    }
    serverAutocompleteAvailable = false; // not deployed — stop trying this session
  }

  return clientAutocomplete(trimmed, bias);
}

/**
 * Exact address + place id for a coordinate, via the client Geocoder. Used by
 * the "add here"/GPS flows where the coordinate is authoritative and we only
 * need a human-readable address to show.
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<{ address: string; placeId: string | null } | null> {
  const google = await loadGoogleMaps();
  const geocoder = new google.maps.Geocoder();
  try {
    const { results } = await geocoder.geocode({ location: { lat, lng } });
    const first = results?.[0];
    if (!first) return null;
    return { address: first.formatted_address, placeId: first.place_id ?? null };
  } catch {
    return null;
  }
}

/**
 * Place details via the existing edge `details` action (keeps the server key
 * server-side). Returns exact geometry for a selected place id.
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  try {
    const { data, error } = await supabase.functions.invoke("google-places", {
      body: { action: "details", placeId },
    });
    if (error || !data?.result) return null;
    const r = data.result;
    const lat = r?.geometry?.location?.lat;
    const lng = r?.geometry?.location?.lng;
    return {
      name: typeof r?.name === "string" ? r.name : null,
      address: typeof r?.formatted_address === "string" ? r.formatted_address : null,
      latitude: typeof lat === "number" ? lat : null,
      longitude: typeof lng === "number" ? lng : null,
      phone: typeof r?.formatted_phone_number === "string" ? r.formatted_phone_number : null,
      types: Array.isArray(r?.types) ? r.types : [],
    };
  } catch {
    return null;
  }
}
