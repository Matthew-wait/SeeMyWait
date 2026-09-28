import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAverageWaitTime, WaitTimeCategory } from "@/lib/wait-time-utils";
import { getDistanceMiles } from "@/lib/geolocation";

export interface Clinic {
  id: string;
  name: string;
  address: string;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  google_place_id: string | null;
  npi?: string | null;
  specialty: string | null;
}

export interface ClinicReport {
  wait_time: WaitTimeCategory;
  reported_at: string;
}

export interface ClinicWithWaitTime extends Clinic {
  waitTime: ReturnType<typeof getAverageWaitTime>;
  /** Reports submitted within the last HISTORY_WINDOW_MINUTES, sorted newest-first. */
  recentReports: ClinicReport[];
  /** Straight-line miles from the user (haversine), when a location is known. */
  distance?: number;
}

const HISTORY_WINDOW_MINUTES = 180; // last 3 hours

/** Row shape returned by the `nearby_clinics` RPC (adds real distance_miles). */
type NearbyClinicRow = Clinic & { distance_miles: number };

async function fetchClinicsWithWaitTimes(
  searchQuery: string | undefined,
  userLat: number | undefined,
  userLon: number | undefined,
  reportExpiryMinutes: number,
  radiusMiles: number
): Promise<ClinicWithWaitTime[]> {
  const hasLocation = userLat !== undefined && userLon !== undefined;

  // With a known location, use the server-side geo filter: real distance,
  // computed and sorted in SQL (PostGIS GiST index — see migration
  // 20260928000000), capped to a sane row count.
  let clinics: (Clinic & { distance_miles?: number })[];
  if (hasLocation && !searchQuery) {
    const { data, error } = await supabase.rpc("nearby_clinics", {
      p_lat: userLat,
      p_lng: userLon,
      p_radius_miles: radiusMiles,
      p_limit: 500,
    });
    if (error) throw error;
    clinics = (data ?? []) as NearbyClinicRow[];
  } else {
    // No location yet (e.g. permission denied), or a text search: bound
    // the fetch explicitly instead of leaning on the implicit API cap.
    let query = supabase.from("clinics").select("*").eq("is_active", true).limit(500);
    if (searchQuery) query = query.ilike("name", `%${searchQuery}%`);
    const { data, error } = await query.order("name");
    if (error) throw error;
    clinics = data ?? [];
  }

  if (!clinics) return [];

  // Fetch a window large enough to cover both the wait-time aggregation
  // and the 3-hour history list shown in the office cards.
  const fetchWindowMinutes = Math.max(reportExpiryMinutes, HISTORY_WINDOW_MINUTES);
  const cutoffIso = new Date(Date.now() - fetchWindowMinutes * 60 * 1000).toISOString();
  const { data: reports } = await supabase
    .from("wait_time_reports")
    .select("clinic_id, wait_time, reported_at")
    .gte("reported_at", cutoffIso)
    .eq("is_flagged", false);

  const reportsByClinic = (reports || []).reduce<Record<string, ClinicReport[]>>(
    (acc, r) => {
      if (!acc[r.clinic_id]) acc[r.clinic_id] = [];
      acc[r.clinic_id].push({
        wait_time: r.wait_time as WaitTimeCategory,
        reported_at: r.reported_at,
      });
      return acc;
    },
    {}
  );

  const historyCutoffMs = Date.now() - HISTORY_WINDOW_MINUTES * 60 * 1000;

  // Filter out clinics with invalid coordinates
  const validClinics = clinics.filter(
    (c) => c.latitude >= -90 && c.latitude <= 90 && c.longitude >= -180 && c.longitude <= 180
  );

  const result: ClinicWithWaitTime[] = validClinics.map((c) => {
    const allReports = reportsByClinic[c.id] || [];
    const recentReports = allReports
      .filter((r) => new Date(r.reported_at).getTime() >= historyCutoffMs)
      .sort(
        (a, b) =>
          new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime()
      );

    return {
      ...c,
      waitTime: getAverageWaitTime(allReports, reportExpiryMinutes),
      recentReports,
      // Prefer the RPC's real SQL-computed distance; fall back to a JS
      // haversine calc for the non-geo (search/no-location) fetch path.
      distance:
        c.distance_miles ??
        (hasLocation ? getDistanceMiles(userLat!, userLon!, c.latitude, c.longitude) : undefined),
    };
  });

  // Sort by distance if location available (the RPC path is already
  // sorted server-side; this is a no-op there and covers the fallback).
  if (hasLocation) {
    result.sort((a, b) => (a.distance || 999) - (b.distance || 999));
  }

  return result;
}

export function useClinics(
  searchQuery?: string,
  userLat?: number,
  userLon?: number,
  reportExpiryMinutes: number = 180,
  radiusMiles: number = 100
) {
  return useQuery({
    queryKey: ["clinics", searchQuery, userLat, userLon, reportExpiryMinutes, radiusMiles],
    // Re-evaluate periodically so a pin reverts to the default once its
    // report ages out of the expiry window, even if the user hasn't acted.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: () =>
      fetchClinicsWithWaitTimes(searchQuery, userLat, userLon, reportExpiryMinutes, radiusMiles),
  });
}

const QUICK_RADIUS_MILES = 5;

/**
 * Progressive nearby-clinics load: fires a small-radius (5mi) query first so
 * the map/list has something to show almost immediately, then a second query
 * for the full configured radius. `data` prefers the full result once it
 * lands; `isLoadingMore` is true in the gap between "quick results shown" and
 * "full radius loaded", so the UI can show a "still loading nearby offices…"
 * indicator instead of looking finished when it isn't.
 *
 * Only used for the location-based nearby view — text search and the
 * no-location fallback go through the plain `useClinics` above unchanged.
 */
export function useNearbyClinicsProgressive(
  userLat: number | undefined,
  userLon: number | undefined,
  reportExpiryMinutes: number,
  fullRadiusMiles: number
) {
  const hasLocation = userLat !== undefined && userLon !== undefined;
  const quickRadiusMiles = Math.min(QUICK_RADIUS_MILES, fullRadiusMiles);

  const quick = useQuery({
    queryKey: ["clinics-quick", userLat, userLon, reportExpiryMinutes, quickRadiusMiles],
    enabled: hasLocation,
    queryFn: () =>
      fetchClinicsWithWaitTimes(undefined, userLat, userLon, reportExpiryMinutes, quickRadiusMiles),
    // Quick pass is a stepping stone to the full result, not something to
    // keep re-fetching on its own schedule.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const full = useQuery({
    queryKey: ["clinics-full", userLat, userLon, reportExpiryMinutes, fullRadiusMiles],
    enabled: hasLocation,
    queryFn: () =>
      fetchClinicsWithWaitTimes(undefined, userLat, userLon, reportExpiryMinutes, fullRadiusMiles),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const data = full.data ?? quick.data ?? [];
  // Nothing to show at all yet.
  const isInitialLoading = !full.data && !quick.data && (quick.isLoading || full.isLoading);
  // Quick results are up, but the full-radius set hasn't landed yet — show a
  // "more are on the way" indicator rather than the quick set looking final.
  const isLoadingMore = Boolean(quick.data) && !full.data && full.isLoading;

  return {
    data,
    isInitialLoading,
    isLoadingMore,
    isLoading: isInitialLoading, // kept for drop-in compatibility with existing `isLoading` checks
    refetch: () => {
      quick.refetch();
      full.refetch();
    },
  };
}
