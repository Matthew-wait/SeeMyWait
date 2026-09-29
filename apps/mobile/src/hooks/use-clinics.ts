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
  /** Real distance from the user in miles, from the `nearby_clinics` RPC. Undefined without a known location. */
  distance?: number;
};

type UseClinicsResult = {
  clinics: ClinicWithMeta[];
  loading: boolean;
  /** True once a quick nearby pass has results but the full-radius pass is still loading. */
  isLoadingMore: boolean;
  refresh: () => Promise<void>;
};

/** Row shape returned by the `nearby_clinics` RPC (see supabase/migrations/20260929000000). */
type NearbyClinicRow = Clinic & { distance_miles: number };

const QUICK_RADIUS_MILES = 5;

async function fetchClinicsAndReports(
  userLat: number | undefined,
  userLon: number | undefined,
  radiusMiles: number
): Promise<{ clinics: (Clinic & { distance_miles?: number })[]; reports: WaitTimeReport[] }> {
  const hasLocation = userLat !== undefined && userLon !== undefined;

  const clinicsPromise = hasLocation
    ? supabase
        .rpc('nearby_clinics', {
          p_lat: userLat,
          p_lng: userLon,
          p_radius_miles: radiusMiles,
          p_limit: 500,
        })
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as NearbyClinicRow[];
        })
    : supabase
        .from('clinics')
        .select('*')
        .eq('is_active', true)
        .limit(500)
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as Clinic[];
        });

  const windowStartIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const reportsPromise = supabase
    .from('wait_time_reports')
    .select('*')
    .gte('reported_at', windowStartIso)
    .or('is_flagged.is.null,is_flagged.eq.false')
    .order('reported_at', { ascending: false })
    .limit(500)
    .then(({ data, error }) => {
      if (error) throw error;
      return (data ?? []) as WaitTimeReport[];
    });

  const [clinics, reports] = await Promise.all([clinicsPromise, reportsPromise]);
  return { clinics, reports };
}

/**
 * Loads clinics near the user plus their non-expired wait reports. When a
 * location is known, uses the server-side `nearby_clinics` RPC (PostGIS GiST
 * index — real distance, sorted in SQL) via a progressive two-pass load: a
 * quick 5-mile pass so the map/list has something almost immediately, then
 * the full configured radius. Without a location, falls back to a plain
 * bounded fetch of active clinics (no radius filtering possible).
 */
export const useClinics = (
  reportExpiryMinutes: number,
  userLat?: number,
  userLon?: number,
  radiusMiles: number = 100
): UseClinicsResult => {
  const hasLocation = userLat !== undefined && userLon !== undefined;
  const quickRadiusMiles = Math.min(QUICK_RADIUS_MILES, radiusMiles);

  const [clinics, setClinics] = useState<(Clinic & { distance_miles?: number })[]>([]);
  const [reports, setReports] = useState<WaitTimeReport[]>([]);
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
    setLoading(true);
    setIsLoadingMore(false);

    if (!hasLocation) {
      const { clinics: fetched, reports: fetchedReports } = await fetchClinicsAndReports(undefined, undefined, radiusMiles);
      if (loadTokenRef.current !== token) return;
      setClinics(fetched);
      setReports(fetchedReports);
      setLoading(false);
      return;
    }

    // Quick pass: small radius, shows results almost immediately.
    const quick = await fetchClinicsAndReports(userLat, userLon, quickRadiusMiles);
    if (loadTokenRef.current !== token) return;
    setClinics(quick.clinics);
    setReports(quick.reports);
    setLoading(false);
    setIsLoadingMore(true);

    // Full pass: the configured radius, replaces the quick set once it lands.
    const full = await fetchClinicsAndReports(userLat, userLon, radiusMiles);
    if (loadTokenRef.current !== token) return;
    setClinics(full.clinics);
    setReports(full.reports);
    setIsLoadingMore(false);
  }, [hasLocation, quickRadiusMiles, radiusMiles, userLat, userLon]);

  useEffect(() => {
    void load();
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
    const windowMs = 3 * 60 * 60 * 1000;
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
    refresh: load,
  };
};
