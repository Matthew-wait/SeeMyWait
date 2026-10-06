import { useEffect } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getAverageWaitTime,
  ON_TIME_REPORT_EXPIRY_MINUTES,
  ReportExpiryByCategory,
  WaitTimeCategory,
} from "@/lib/wait-time-utils";
import { getDistanceMiles } from "@/lib/geolocation";
import { fetchNearbyBatch, loadAllNearbyPages, mergeNearbyPages, NearbyBatchCursor } from "@/lib/nearby-clinics";

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

/** Longest of the per-category expiry windows — used to size the report
 *  fetch so it's never narrower than whichever category takes longest to expire. */
function maxExpiryMinutes(expiry: ReportExpiryByCategory): number {
  return Math.max(
    ON_TIME_REPORT_EXPIRY_MINUTES,
    expiry.report_expiry_30min_minutes,
    expiry.report_expiry_60min_minutes,
    expiry.report_expiry_90plus_minutes
  );
}

async function fetchClinicsWithWaitTimes(
  searchQuery: string | undefined,
  userLat: number | undefined,
  userLon: number | undefined,
  reportExpiry: ReportExpiryByCategory,
  radiusMiles: number
): Promise<ClinicWithWaitTime[]> {
  const hasLocation = userLat !== undefined && userLon !== undefined;

  // Fetch all geographic pages when a location is available.
  let clinics: (Clinic & { distance_miles?: number })[];
  if (hasLocation && !searchQuery) {
    clinics = await loadAllNearbyPages(userLat, userLon, radiusMiles);
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
  const fetchWindowMinutes = Math.max(maxExpiryMinutes(reportExpiry), HISTORY_WINDOW_MINUTES);
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
      waitTime: getAverageWaitTime(allReports, reportExpiry),
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
    result.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  }

  return result;
}

const DEFAULT_REPORT_EXPIRY: ReportExpiryByCategory = {
  report_expiry_30min_minutes: 30,
  report_expiry_60min_minutes: 60,
  report_expiry_90plus_minutes: 90,
};

export function useClinics(
  searchQuery?: string,
  userLat?: number,
  userLon?: number,
  reportExpiry: ReportExpiryByCategory = DEFAULT_REPORT_EXPIRY,
  radiusMiles: number = 100
) {
  return useQuery({
    queryKey: ["clinics", searchQuery, userLat, userLon, reportExpiry, radiusMiles],
    // Re-evaluate periodically so a pin reverts to the default once its
    // report ages out of the expiry window, even if the user hasn't acted.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: () =>
      fetchClinicsWithWaitTimes(searchQuery, userLat, userLon, reportExpiry, radiusMiles),
  });
}

/** Load the nearest 1,000; subsequent batches require an explicit user request. */
export function useNearbyClinicsProgressive(
  userLat: number | undefined,
  userLon: number | undefined,
  reportExpiry: ReportExpiryByCategory,
  fullRadiusMiles: number,
  settingsReady = true
) {
  const hasLocation = userLat !== undefined && userLon !== undefined;
  const nearby = useInfiniteQuery({
    queryKey: ["clinics-nearby-batches", userLat, userLon, fullRadiusMiles],
    enabled: hasLocation && settingsReady,
    initialPageParam: null as NearbyBatchCursor | null,
    queryFn: ({ pageParam, signal }) => fetchNearbyBatch(userLat!, userLon!, fullRadiusMiles, pageParam, signal),
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    // Refresh reports each minute without downloading the whole directory again.
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 2,
  });
  const { fetchNextPage, hasNextPage, isError, isFetchingNextPage } = nearby;
  // The map needs every office in the radius, so pull the remaining batches in
  // the background (capped as a safety net). The list caps what it displays.
  const loadedPages = nearby.data?.pages.length ?? 0;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError && loadedPages < 30) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isError, loadedPages, fetchNextPage]);

  const reports = useQuery({
    queryKey: ["nearby-wait-reports", reportExpiry],
    enabled: hasLocation && settingsReady,
    queryFn: async ({ signal }) => {
      const cutoff = new Date(Date.now() - Math.max(maxExpiryMinutes(reportExpiry), HISTORY_WINDOW_MINUTES) * 60_000).toISOString();
      const { data, error } = await supabase.from("wait_time_reports")
        .select("clinic_id, wait_time, reported_at").gte("reported_at", cutoff)
        .eq("is_flagged", false).abortSignal(signal);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const count = useQuery({
    queryKey: ["nearby-count", userLat, userLon, fullRadiusMiles],
    enabled: hasLocation && settingsReady,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc("nearby_clinic_count", {
        p_lat: userLat!, p_lng: userLon!, p_radius_miles: fullRadiusMiles,
      }).abortSignal(signal);
      if (error) throw error;
      return Number(data ?? 0);
    },
    staleTime: 5 * 60_000,
  });
  const rows = useMemo(() => mergeNearbyPages(nearby.data?.pages ?? []), [nearby.data]);
  const data = useMemo((): ClinicWithWaitTime[] => {
    const byClinic = new Map<string, ClinicReport[]>();
    for (const report of reports.data ?? []) {
      const entries = byClinic.get(report.clinic_id) ?? [];
      entries.push(report);
      byClinic.set(report.clinic_id, entries);
    }
    const historyCutoff = Math.max(Date.now(), reports.dataUpdatedAt) - HISTORY_WINDOW_MINUTES * 60_000;
    return rows.filter(c => Number.isFinite(c.latitude) && Number.isFinite(c.longitude)
      && Math.abs(c.latitude) <= 90 && Math.abs(c.longitude) <= 180)
      .map(c => {
        const allReports = byClinic.get(c.id) ?? [];
        return { ...c, distance: c.distance_miles,
          waitTime: getAverageWaitTime(allReports, reportExpiry),
          recentReports: allReports.filter(r => Date.parse(r.reported_at) >= historyCutoff)
            .sort((a,b) => Date.parse(b.reported_at) - Date.parse(a.reported_at)) };
      });
  }, [rows, reports.data, reports.dataUpdatedAt, reportExpiry]);
  const isInitialLoading = hasLocation && (!settingsReady || nearby.isPending);
  return {
    data, isInitialLoading, isLoading: isInitialLoading,
    isLoadingMore: hasLocation && settingsReady && nearby.isFetching && !isError,
    hasMore: Boolean(hasNextPage),
    total: count.data,
    loadMore: () => { if (hasNextPage && !nearby.isFetching) void fetchNextPage(); },
    error: nearby.error,
    refetch: async () => {
      await reports.refetch();
      if (hasNextPage && isError) await fetchNextPage();
      else await nearby.refetch();
      return { data };
    },
  };
}
