import { supabase } from "@/integrations/supabase/client";
import type { Clinic } from "@/hooks/use-clinics";

export type NearbyRow = Clinic & { distance_miles: number };
export interface NearbyCursor { cell: number; id: string | null }
export interface NearbyPage { clinics: NearbyRow[]; next_cursor: NearbyCursor | null }

export interface NearbyBatchCursor { distance: number; id: string }
export interface NearbyBatch { clinics: NearbyRow[]; next_cursor: NearbyBatchCursor | null }

export async function fetchNearbyBatch(lat: number, lng: number, radius: number,
  cursor: NearbyBatchCursor | null, signal?: AbortSignal): Promise<NearbyBatch> {
  const request = supabase.rpc("nearby_clinics_batch", {
    p_lat: lat, p_lng: lng, p_radius_miles: radius, p_page_size: 1000,
    p_after_distance: cursor?.distance, p_after_id: cursor?.id,
  });
  const { data, error } = await (signal ? request.abortSignal(signal) : request);
  if (error) throw error;
  const batch = data as unknown as NearbyBatch;
  if (!batch || !Array.isArray(batch.clinics)) throw new Error("Invalid nearby-search response");
  if (batch.next_cursor && cursor && batch.next_cursor.distance === cursor.distance && batch.next_cursor.id === cursor.id) {
    throw new Error("Nearby-search cursor did not advance");
  }
  return batch;
}

export function nearbyCountLabel(count: number, hasMore: boolean): string {
  return `${count.toLocaleString("en-US")}${hasMore ? "+" : ""}`;
}

export async function fetchNearbyPage(
  lat: number, lng: number, radius: number, cursor: NearbyCursor | null, signal?: AbortSignal
): Promise<NearbyPage> {
  for (const pageSize of [1000, 250]) {
    const request = supabase.rpc("nearby_clinics_page", {
      p_lat: lat, p_lng: lng, p_radius_miles: radius,
      p_page_size: pageSize,
      p_cell: cursor?.cell ?? 0,
      p_after_id: cursor?.id ?? undefined,
    });
    const { data, error } = await (signal ? request.abortSignal(signal) : request);
    if (error) {
      if (error.code === "57014" && pageSize > 250) continue;
      throw error;
    }
    const page = data as unknown as NearbyPage;
    if (!page || !Array.isArray(page.clinics)) throw new Error("Invalid nearby-search response");
    if (page.next_cursor && cursor && page.next_cursor.cell === cursor.cell && page.next_cursor.id === cursor.id) {
      throw new Error("Nearby-search cursor did not advance");
    }
    return page;
  }
  throw new Error("Nearby-search page could not be loaded");
}

/** Geographic pages are merged into exact nearest-first order without a total cap. */
export function mergeNearbyPages(pages: { clinics: NearbyRow[]; next_cursor?: unknown }[]): NearbyRow[] {
  const byId = new Map<string, NearbyRow>();
  for (const page of pages) for (const clinic of page.clinics) byId.set(clinic.id, clinic);
  return [...byId.values()].sort((a, b) => a.distance_miles - b.distance_miles || a.id.localeCompare(b.id));
}

export async function loadAllNearbyPages(lat: number, lng: number, radius: number): Promise<NearbyRow[]> {
  const pages: NearbyPage[] = [];
  let cursor: NearbyCursor | null = null;
  do {
    const page = await fetchNearbyPage(lat, lng, radius, cursor);
    pages.push(page);
    cursor = page.next_cursor;
  } while (cursor);
  return mergeNearbyPages(pages);
}
