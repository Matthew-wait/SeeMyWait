import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AppSettings {
  nearby_radius_miles: number;
  report_cooldown_minutes: number;
  report_geofence_meters: number;
}

const DEFAULTS: AppSettings = {
  nearby_radius_miles: 5,
  report_cooldown_minutes: 60,
  report_geofence_meters: 1000,
};

export function useAppSettings() {
  return useQuery({
    queryKey: ["app-settings"],
    queryFn: async (): Promise<AppSettings> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value");
      if (error) throw error;

      // parseInt truncates "0.621371" to 0, and `0 || fallback` then silently
      // discards it since 0 is falsy — any radius under 1 mile got replaced
      // by the 100-mile default. parseFloat preserves decimals; an explicit
      // finite/positive check (not `||`) is what should decide the fallback.
      const parseSetting = (raw: string | undefined, fallback: number): number => {
        const parsed = parseFloat(raw ?? "");
        return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
      };

      const settings = { ...DEFAULTS };
      (data || []).forEach((row: { key: string; value: string }) => {
        if (row.key === "nearby_radius_miles") {
          settings.nearby_radius_miles = parseSetting(row.value, DEFAULTS.nearby_radius_miles);
        }
        if (row.key === "report_geofence_meters") {
          settings.report_geofence_meters = parseSetting(row.value, DEFAULTS.report_geofence_meters);
        }
        if (row.key === "report_cooldown_minutes") {
          settings.report_cooldown_minutes = parseSetting(row.value, DEFAULTS.report_cooldown_minutes);
        }
      });
      return settings;
    },
    // Settings change rarely; refetching every 30s caused needless tree
    // re-renders that contributed to the map feeling glitchy. Five minutes
    // is plenty for admin-side tweaks to propagate, and structural sharing
    // dedupes identical values so this is mostly free.
    // Short window so admin changes (radius, report radius, cooldown) reach
    // users within ~30 seconds.
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}
