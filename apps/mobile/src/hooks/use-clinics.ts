import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { supabase } from '@/src/lib/supabase';
import { waitTimeCategoryToMinutes } from '@/src/lib/wait-time-report';

export type WaitTimeReport = {
  id: string;
  clinic_id: string;
  wait_time: string;
  reported_at: string;
  /** After this instant the report is inactive for patients (admin may still list it). */
  expiry_time?: string | null;
  is_flagged: boolean | null;
  device_fingerprint?: string | null;
};

export type Clinic = {
  id: string;
  name: string;
  doctor_name: string | null;
  specialty: string | null;
  address: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
  phone: string | null;
  /** Provenance of the row (added by admin, imported from Google, or user-claimed). */
  source?: string | null;
  verified?: boolean | null;
  place_types?: string[] | null;
  google_place_id?: string | null;
};

export type ClinicWithMeta = Clinic & {
  latestWaitMinutes: number | null;
  latestReportAt: string | null;
  recentReports: {
    id: string;
    reportedAt: string;
    waitMinutes: number | null;
  }[];
  /** Real distance from the user in miles, from the nearby RPC. Undefined without a known location. */
  distance?: number;
};

type UseClinicsResult = {
  clinics: ClinicWithMeta[];
  loading: boolean;
  /** True while further 1,000-office batches are still arriving for the full radius. */
  isLoadingMore: boolean;
  /** Exact number of active offices inside the nearby radius (single server count, not downloaded). */
  totalCount: number | null;
  refresh: () => Promise<void>;
};

/** Row shape returned by the `nearby_clinics_batch` RPC. */
type NearbyClinicRow = Clinic & { distance_miles: number };
type NearbyBatchCursor = { distance: number; id: string };
type NearbyBatch = { clinics: NearbyClinicRow[]; next_cursor: NearbyBatchCursor | null };

const BATCH_SIZE = 1000;
/** Safety cap, same as the web app: 30 batches = 30,000 offices. */
const MAX_BATCHES = 30;
const HISTORY_WINDOW_MINUTES = 180;

/**
 * Pulls every office in the radius, nearest first, one 1,000-row batch at a time.
 * `onBatch` receives the accumulated list after each batch so the map and list fill in.
 * `isCurrent` lets the caller abandon a stale load (location or settings changed).
 */
async function loadNearbyBatches(
  lat: number,
  lng: number,
  radiusMiles: number,
  isCurrent: () => boolean,
  onBatch: (all: NearbyClinicRow[]) => void
): Promise<NearbyClinicRow[]> {
  const byId = new Map<string, NearbyClinicRow>();
  let cursor: NearbyBatchCursor | null = null;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const { data, error } = await supabase.rpc('nearby_clinics_batch', {
      p_lat: lat,
      p_lng: lng,
      p_radius_miles: radiusMiles,
      p_page_size: BATCH_SIZE,
      p_after_distance: cursor?.distance,
      p_after_id: cursor?.id,
    });
    if (error) throw error;
    if (!isCurrent()) return [...byId.values()];
    const batch = data as unknown as NearbyBatch;
    if (!batch || !Array.isArray(batch.clinics)) throw new Error('Invalid nearby-search response');
    for (const clinic of batch.clinics) byId.set(clinic.id, clinic);
    onBatch([...byId.values()]);
    const next = batch.next_cursor;
    if (!next) break;
    if (cursor && next.distance === cursor.distance && next.id === cursor.id) {
      throw new Error('Nearby-search cursor did not advance');
    }
    cursor = next;
  }
  return [...byId.values()];
}

async function fetchReports(reportExpiryMinutes: number): Promise<WaitTimeReport[]> {
  // Same window as the web app: at least the 3-hour history, or the configured expiry if longer.
  const windowMinutes = Math.max(reportExpiryMinutes, HISTORY_WINDOW_MINUTES);
  const cutoffIso = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('wait_time_reports')
    .select('*')
    .gte('reported_at', cutoffIso)
    .or('is_flagged.is.null,is_flagged.eq.false')
    .order('reported_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as WaitTimeReport[];
}

/**
 * Loads every active office inside the nearby radius (batched, nearest first) plus
 * their recent wait reports. Without a location, falls back to a bounded fetch of
 * active clinics (no radius filtering possible).
 */
export const useClinics = (
  reportExpiryMinutes: number,
  userLat?: number,
  userLon?: number,
  radiusMiles: number = 100
): UseClinicsResult => {
  const hasLocation = userLat !== undefined && userLon !== undefined;

  const [clinics, setClinics] = useState<(Clinic & { distance_miles?: number })[]>([]);
  const [reports, setReports] = useState<WaitTimeReport[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  // Guards against a slow in-flight load overwriting a newer one's result
  // (e.g. location arrives mid-fetch and re-triggers this effect).
  const loadTokenRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    const token = ++loadTokenRef.current;
    const isCurrent = () => loadTokenRef.current === token;
    setLoading(true);
    setIsLoadingMore(false);

    try {
      if (!hasLocation) {
        const { data, error } = await supabase.from('clinics').select('*').eq('is_active', true).limit(500);
        if (error) throw error;
        const fetchedReports = await fetchReports(reportExpiryMinutes);
        if (!isCurrent()) return;
        setClinics((data ?? []) as Clinic[]);
        setReports(fetchedReports);
        setTotalCount(null);
        setLoading(false);
        return;
      }

      // Reports and the exact count are cheap, so they run alongside the batches.
      const reportsPromise = fetchReports(reportExpiryMinutes);
      const countPromise = supabase
        .rpc('nearby_clinic_count', { p_lat: userLat, p_lng: userLon, p_radius_miles: radiusMiles })
        .then(({ data, error }) => {
          if (error) throw error;
          return Number(data ?? 0);
        });

      let firstBatchShown = false;
      await loadNearbyBatches(userLat!, userLon!, radiusMiles, isCurrent, (partial) => {
        if (!isCurrent()) return;
        setClinics(partial);
        if (!firstBatchShown) {
          firstBatchShown = true;
          setLoading(false);
          setIsLoadingMore(true);
        }
      }).then((all) => {
        if (isCurrent()) setClinics(all);
      });
      const [fetchedReports, count] = await Promise.all([reportsPromise, countPromise]);
      if (!isCurrent()) return;
      setReports(fetchedReports);
      setTotalCount(count);
      setLoading(false);
      setIsLoadingMore(false);
    } catch (error) {
      if (!isCurrent()) return;
      setLoading(false);
      setIsLoadingMore(false);
      throw error;
    }
  }, [hasLocation, radiusMiles, reportExpiryMinutes, userLat, userLon]);

  useEffect(() => {
    void load().catch(() => {
      // Keep whatever loaded; the next refresh (location, settings, or pull) retries.
    });
  }, [load]);

  const isLatestReportActive = useCallback(
    (report: WaitTimeReport): boolean => {
      // Prefer DB-provided expiry_time if present (server-side truth).
      const expiryMs = report.expiry_time ? new Date(report.expiry_time).getTime() : NaN;
      if (Number.isFinite(expiryMs)) return expiryMs > nowMs;

      // Fallback to client-side TTL if expiry_time is missing.
      const ttlMinutes = Number.isFinite(reportExpiryMinutes) && reportExpiryMinutes > 0 ? reportExpiryMinutes : 1;
      const ttlMs = ttlMinutes * 60 * 1000;
      const reportedAtMs = new Date(report.reported_at).getTime();
      if (!Number.isFinite(reportedAtMs)) return false;
      return reportedAtMs + ttlMs > nowMs;
    },
    [nowMs, reportExpiryMinutes]
  );

  const latestReportByClinic = useMemo<Map<string, WaitTimeReport>>(() => {
    const latestByClinic = new Map<string, WaitTimeReport>();
    for (const report of reports) {
      // reports are already sorted by reported_at DESC from Supabase
      if (!latestByClinic.has(report.clinic_id)) {
        latestByClinic.set(report.clinic_id, report);
      }
    }
    return latestByClinic;
  }, [reports]);

  const recentReportsByClinic = useMemo(() => {
    const windowMs = HISTORY_WINDOW_MINUTES * 60 * 1000;
    const map = new Map<string, { id: string; reportedAt: string; waitMinutes: number | null }[]>();
    for (const report of reports) {
      const reportedAtMs = new Date(report.reported_at).getTime();
      if (!Number.isFinite(reportedAtMs)) continue;
      if (reportedAtMs + windowMs <= nowMs) continue;
      const list = map.get(report.clinic_id) ?? [];
      list.push({
        id: report.id,
        reportedAt: report.reported_at,
        waitMinutes: waitTimeCategoryToMinutes(report.wait_time),
      });
      map.set(report.clinic_id, list);
    }
    return map;
  }, [nowMs, reports]);

  const clinicsWithMeta = useMemo<ClinicWithMeta[]>(() => {
    return clinics.map((clinic) => {
      const latest = latestReportByClinic.get(clinic.id);
      const visibleLatest = latest && isLatestReportActive(latest) ? latest : undefined;
      return {
        ...clinic,
        latestWaitMinutes: waitTimeCategoryToMinutes(visibleLatest?.wait_time),
        latestReportAt: visibleLatest?.reported_at ?? null,
        recentReports: recentReportsByClinic.get(clinic.id) ?? [],
        distance: clinic.distance_miles,
      };
    });
  }, [clinics, isLatestReportActive, latestReportByClinic, recentReportsByClinic]);

  return {
    clinics: clinicsWithMeta,
    loading,
    isLoadingMore,
    totalCount,
    refresh: load,
  };
};
