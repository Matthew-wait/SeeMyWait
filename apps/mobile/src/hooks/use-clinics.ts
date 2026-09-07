import { useCallback, useEffect, useMemo, useState } from 'react';

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
};

type UseClinicsResult = {
  clinics: ClinicWithMeta[];
  loading: boolean;
  refresh: () => Promise<void>;
};

/** Loads only non-expired wait reports (`expiry_time` > now). */
export const useClinics = (reportExpiryMinutes: number): UseClinicsResult => {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [reports, setReports] = useState<WaitTimeReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [nowMs, setNowMs] = useState<number>(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const windowStartIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [clinicRes, reportRes] = await Promise.all([
      supabase.from('clinics').select('*').eq('is_active', true),
      supabase
        .from('wait_time_reports')
        .select('*')
        .gte('reported_at', windowStartIso)
        .or('is_flagged.is.null,is_flagged.eq.false')
        .order('reported_at', { ascending: false })
        .limit(500),
    ]);

    setClinics((clinicRes.data ?? []) as Clinic[]);
    setReports((reportRes.data ?? []) as WaitTimeReport[]);
    setLoading(false);
  }, []);

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
      };
    });
  }, [clinics, isLatestReportActive, latestReportByClinic, recentReportsByClinic]);

  return {
    clinics: clinicsWithMeta,
    loading,
    refresh: load,
  };
};
