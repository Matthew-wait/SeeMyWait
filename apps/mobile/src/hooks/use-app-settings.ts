import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/src/lib/supabase';

export type AppSettings = {
  /** From Supabase `nearby_radius_miles`: map/list “nearby clinics” scope (driving + filters). */
  nearbyRadiusMiles: number;
  /** Anti-spam: min minutes between reports per device, globally (server should mirror). Unrelated to how long a report stays active — see reportExpiry* below. */
  reportCooldownMinutes: number;
  /** From Supabase `report_geofence_meters`: how close a user must be to report (GPS accuracy uses the same). */
  reportGeofenceMeters: number;
  /** Minutes before a "~30 min" report reverts to On Time. */
  reportExpiry30MinMinutes: number;
  /** Minutes before a "~1 hour" report reverts to On Time. */
  reportExpiry60MinMinutes: number;
  /** Minutes before a "1.5+ hours" report reverts to On Time. */
  reportExpiry90PlusMinutes: number;
};

const DEFAULT_SETTINGS: AppSettings = {
  nearbyRadiusMiles: 100,
  reportCooldownMinutes: 60,
  reportGeofenceMeters: 1000,
  reportExpiry30MinMinutes: 30,
  reportExpiry60MinMinutes: 60,
  reportExpiry90PlusMinutes: 90,
};

const parseNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

export const useAppSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('app_settings').select('*').limit(100);
    if (error || !data || data.length === 0) {
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      return;
    }

    const row = data[0] as Record<string, unknown>;
    if ('nearby_radius_miles' in row || 'report_cooldown_minutes' in row) {
      setSettings({
        nearbyRadiusMiles: parseNumber(row.nearby_radius_miles, DEFAULT_SETTINGS.nearbyRadiusMiles),
        reportCooldownMinutes: parseNumber(
          row.report_cooldown_minutes,
          DEFAULT_SETTINGS.reportCooldownMinutes
        ),
        reportGeofenceMeters: parseNumber(row.report_geofence_meters, DEFAULT_SETTINGS.reportGeofenceMeters),
        reportExpiry30MinMinutes: parseNumber(row.report_expiry_30min_minutes, DEFAULT_SETTINGS.reportExpiry30MinMinutes),
        reportExpiry60MinMinutes: parseNumber(row.report_expiry_60min_minutes, DEFAULT_SETTINGS.reportExpiry60MinMinutes),
        reportExpiry90PlusMinutes: parseNumber(row.report_expiry_90plus_minutes, DEFAULT_SETTINGS.reportExpiry90PlusMinutes),
      });
      setLoading(false);
      return;
    }

    const kv = data as { key?: string; value?: unknown }[];
    const find = (key: string) => kv.find((item) => item.key === key)?.value;
    setSettings({
      nearbyRadiusMiles: parseNumber(find('nearby_radius_miles'), DEFAULT_SETTINGS.nearbyRadiusMiles),
      reportCooldownMinutes: parseNumber(find('report_cooldown_minutes'), DEFAULT_SETTINGS.reportCooldownMinutes),
      reportGeofenceMeters: parseNumber(find('report_geofence_meters'), DEFAULT_SETTINGS.reportGeofenceMeters),
      reportExpiry30MinMinutes: parseNumber(find('report_expiry_30min_minutes'), DEFAULT_SETTINGS.reportExpiry30MinMinutes),
      reportExpiry60MinMinutes: parseNumber(find('report_expiry_60min_minutes'), DEFAULT_SETTINGS.reportExpiry60MinMinutes),
      reportExpiry90PlusMinutes: parseNumber(find('report_expiry_90plus_minutes'), DEFAULT_SETTINGS.reportExpiry90PlusMinutes),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSettings();
    // Same cadence as the web app, so admin changes reach phones without a restart.
    const id = setInterval(() => void loadSettings(), 30_000);
    return () => clearInterval(id);
  }, [loadSettings]);

  return { settings, loading, refresh: loadSettings };
};
