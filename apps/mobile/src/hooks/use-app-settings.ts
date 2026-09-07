import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/src/lib/supabase';

export type AppSettings = {
  /** From Supabase `nearby_radius_miles`: map/list “nearby clinics” scope (driving + filters). */
  nearbyRadiusMiles: number;
  /** Anti-spam: min minutes between reports per device + clinic (server should mirror). */
  reportCooldownMinutes: number;
};

const DEFAULT_SETTINGS: AppSettings = {
  nearbyRadiusMiles: 100,
  reportCooldownMinutes: 60,
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
      });
      setLoading(false);
      return;
    }

    const kv = data as { key?: string; value?: unknown }[];
    const nearby = kv.find((item) => item.key === 'nearby_radius_miles')?.value;
    const cooldown = kv.find((item) => item.key === 'report_cooldown_minutes')?.value;
    setSettings({
      nearbyRadiusMiles: parseNumber(nearby, DEFAULT_SETTINGS.nearbyRadiusMiles),
      reportCooldownMinutes: parseNumber(cooldown, DEFAULT_SETTINGS.reportCooldownMinutes),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  return { settings, loading, refresh: loadSettings };
};
