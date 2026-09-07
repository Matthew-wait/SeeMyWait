/**
 * Web binding for the shared `@seemywait/core` directory client — injects this
 * app's Supabase client and device fingerprint so call sites keep the old
 * two-arg / one-arg signatures.
 */
import { supabase } from "@/integrations/supabase/client";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import {
  searchMedicalPlaces as coreSearch,
  addMedicalPlace as coreAdd,
} from "@seemywait/core";

export {
  MIN_QUERY_LENGTH,
  SEARCH_DEBOUNCE_MS,
  addErrorMessage,
  isNpi,
  directionsUrl,
  viewOnMapUrl,
} from "@seemywait/core";
export type {
  DbSearchResult,
  NpiSearchResult,
  MedicalSearchResult,
  MedicalSearchResponse,
  AddedClinic,
  MedicalAddResponse,
} from "@seemywait/core";

export function searchMedicalPlaces(
  query: string,
  location: { latitude: number; longitude: number } | null,
) {
  return coreSearch(supabase, getDeviceFingerprint(), query, location);
}

export function addMedicalPlace(npi: string) {
  return coreAdd(supabase, getDeviceFingerprint(), npi);
}
