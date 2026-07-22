import { supabase } from "@/integrations/supabase/client";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import { hasValidCoords } from "@/lib/geolocation";

/**
 * Client for the shared `medical-search` edge function.
 *
 * The Google *server* key lives only inside that function — the browser never
 * calls Google Places directly and never sees it. Everything here goes through
 * Supabase with the anon key.
 *
 * The function always answers HTTP 200 with a typed envelope, so we branch on
 * the body (`ok`), never on the HTTP status.
 */

/** Minimum trimmed query length before we call the function at all. */
export const MIN_QUERY_LENGTH = 2;

/** Debounce applied to the search input. */
export const SEARCH_DEBOUNCE_MS = 300;

export interface DbSearchResult {
  source: "db";
  /** Clinic row id — this place is already saved. */
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface GoogleSearchResult {
  source: "google";
  /** Google place id — a *candidate*, not saved until explicitly verified. */
  place_id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export type MedicalSearchResult = DbSearchResult | GoogleSearchResult;

export interface MedicalSearchResponse {
  ok: boolean;
  results: MedicalSearchResult[];
  /** Rate limit hit — Google was skipped, DB results are still present. */
  limited: boolean;
  /** Google was attempted but unavailable — DB results are still present. */
  degraded: boolean;
}

export interface AddedClinic {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  google_place_id: string | null;
  specialty: string | null;
  source: string;
  verified: boolean;
  is_active: boolean;
}

/**
 * Flat rather than a discriminated union on purpose: this project compiles with
 * `strictNullChecks: false`, where narrowing on a boolean discriminant doesn't
 * work. Callers must check `ok` *and* the presence of `clinic`.
 */
export interface MedicalAddResponse {
  ok: boolean;
  /** True when the place was already saved — idempotent, no duplicate created. */
  existed?: boolean;
  clinic?: AddedClinic;
  error?: string;
  limited?: boolean;
}

const ADD_ERROR_MESSAGES: Record<string, string> = {
  not_medical: "That place doesn't look like a medical office, so it can't be added.",
  permanently_closed: "That place is permanently closed and can't be added.",
  no_coordinates: "We couldn't get a location for that place.",
  lookup_failed: "We couldn't look up that place. Please try again.",
  insert_failed: "We couldn't save that place. Please try again.",
  rate_limited: "You've added a lot of places recently. Please try again shortly.",
};

export function addErrorMessage(error: string | undefined): string {
  return (error && ADD_ERROR_MESSAGES[error]) || "Something went wrong. Please try again.";
}

const FAILED_SEARCH: MedicalSearchResponse = {
  ok: false,
  results: [],
  limited: false,
  degraded: true,
};

/**
 * True for something that plausibly is a *Google* place id.
 *
 * This exists because the address-geocoding fallback chain ends at Nominatim,
 * whose JSON also has a `place_id` field — but it is an internal OSM integer
 * (e.g. 305759221). Writing that into `clinics.google_place_id` poisons the
 * partial-unique index the edge function dedups on, and makes
 * `viewOnGoogleMapsUrl` produce dead links. Google ids are opaque
 * base64url-ish strings and are never all-digits, which is what we key on.
 */
export function isGooglePlaceId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 10 &&
    !/^\d+$/.test(value) &&
    !/\s/.test(value)
  );
}

/** A search row is usable only if we can both identify it and place it. */
function isMappable(result: MedicalSearchResult): boolean {
  if (!result) return false;
  const hasIdentity = result.source === "db" ? Boolean(result.id) : Boolean(result.place_id);
  return hasIdentity && hasValidCoords(result.latitude, result.longitude);
}

/**
 * DB-first place search. Never saves anything — saving happens only in
 * `addMedicalPlace` after the user explicitly verifies a candidate.
 */
export async function searchMedicalPlaces(
  query: string,
  location: { latitude: number; longitude: number } | null
): Promise<MedicalSearchResponse> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) {
    return { ok: true, results: [], limited: false, degraded: false };
  }

  try {
    const { data, error } = await supabase.functions.invoke("medical-search", {
      body: {
        action: "search",
        query: trimmed,
        deviceId: getDeviceFingerprint(),
        location,
      },
    });

    // The function itself never throws, so `error` means a transport-level
    // failure (offline, function cold-start timeout, 5xx).
    if (error || !data) return FAILED_SEARCH;

    const results = Array.isArray(data.results) ? data.results : [];

    return {
      ok: data.ok !== false,
      results: results.filter(isMappable),
      limited: data.limited === true,
      degraded: data.degraded === true,
    };
  } catch {
    // invoke() can reject outright (DNS failure, aborted fetch). Never let that
    // escape into the caller's render/effect.
    return FAILED_SEARCH;
  }
}

/**
 * Saves a Google candidate into `clinics`. Idempotent — re-adding the same
 * place returns the existing row (`existed: true`) instead of duplicating it.
 * This is the *only* path that writes clinics; never insert from the client.
 */
export async function addMedicalPlace(placeId: string): Promise<MedicalAddResponse> {
  try {
    const { data, error } = await supabase.functions.invoke("medical-search", {
      body: {
        action: "add",
        placeId,
        deviceId: getDeviceFingerprint(),
      },
    });

    if (error || !data) return { ok: false, error: "lookup_failed" };

    const response = data as MedicalAddResponse;

    // A success envelope without a usable row would crash the map the moment we
    // opened the new clinic's card — treat it as a failure instead.
    const saved = response.clinic;
    if (response.ok && (!saved?.id || !hasValidCoords(saved.latitude, saved.longitude))) {
      return { ok: false, error: "no_coordinates" };
    }

    return response;
  } catch {
    // Never let a rejected invoke() leave the caller stuck in a pending state.
    return { ok: false, error: "lookup_failed" };
  }
}

/** External maps hand-off — we never rebuild turn-by-turn navigation in-app. */
export function directionsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
}

export function viewOnGoogleMapsUrl(name: string, placeId?: string | null): string {
  const base = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
  return placeId ? `${base}&query_place_id=${encodeURIComponent(placeId)}` : base;
}
