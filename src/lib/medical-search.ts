import { supabase } from "@/integrations/supabase/client";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import { hasValidCoords } from "@/lib/geolocation";

/**
 * Client for the `medical-search` edge function (NPPES-backed directory).
 *
 * The browser never calls NPPES / a geocoder directly — everything goes through
 * Supabase with the anon key. The function always answers HTTP 200 with a typed
 * envelope, so we branch on the body (`ok`), never on the HTTP status.
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

export interface NpiSearchResult {
  source: "npi";
  /** NPPES National Provider Identifier — a *candidate*, not saved until verified. */
  npi: string;
  name: string;
  address: string;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  latitude: number;
  longitude: number;
  specialty?: string | null;
  phone?: string | null;
}

export type MedicalSearchResult = DbSearchResult | NpiSearchResult;

export interface MedicalSearchResponse {
  ok: boolean;
  results: MedicalSearchResult[];
  /** Rate limit hit — the registry was skipped, DB results are still present. */
  limited: boolean;
  /** The registry was attempted but unavailable — DB results are still present. */
  degraded: boolean;
}

export interface AddedClinic {
  id: string;
  name: string;
  address: string;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  npi: string | null;
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
  permanently_closed: "That provider is deactivated in the registry and can't be added.",
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
 * True for something shaped like an NPPES NPI: exactly 10 digits.
 *
 * Replaces the old `isGooglePlaceId` guard. NPIs are the stable identity for
 * directory rows now (`clinics.npi`, partial-unique). A value that isn't a
 * 10-digit string must never be written there.
 */
export function isNpi(value: unknown): value is string {
  return typeof value === "string" && /^\d{10}$/.test(value);
}

/** A search row is usable only if we can both identify it and place it. */
function isMappable(result: MedicalSearchResult): boolean {
  if (!result) return false;
  const hasIdentity = result.source === "db" ? Boolean(result.id) : Boolean(result.npi);
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
 * Saves an NPPES provider (by NPI) into `clinics`. Idempotent — re-adding the
 * same NPI returns the existing row (`existed: true`) instead of duplicating it.
 * This is the *only* path that writes clinics; never insert from the client.
 */
export async function addMedicalPlace(npi: string): Promise<MedicalAddResponse> {
  try {
    const { data, error } = await supabase.functions.invoke("medical-search", {
      body: {
        action: "add",
        npi,
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
    return { ok: false, error: "lookup_failed" };
  }
}

/** External maps hand-off — we never rebuild turn-by-turn navigation in-app. */
export function directionsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
}

/** "View on map" deep link (OpenStreetMap; keyless, opens the user's map app). */
export function viewOnMapUrl(_name: string, latitude: number, longitude: number): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
}
