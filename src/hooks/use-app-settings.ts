import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AppSettings {
  nearby_radius_miles: number;
  report_cooldown_minutes: number;
}

const DEFAULTS: AppSettings = {
  nearby_radius_miles: 100,
  report_cooldown_minutes: 60,
};

export function useAppSettings() {
  return useQuery({
    queryKey: ["app-settings"],
    queryFn: async (): Promise<AppSettings> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value");
      if (error) throw error;

      const settings = { ...DEFAULTS };
      (data || []).forEach((row: { key: string; value: string }) => {
        if (row.key === "nearby_radius_miles") {
          settings.nearby_radius_miles = parseInt(row.value, 10) || DEFAULTS.nearby_radius_miles;
        }
        if (row.key === "report_cooldown_minutes") {
          settings.report_cooldown_minutes = parseInt(row.value, 10) || DEFAULTS.report_cooldown_minutes;
        }
      });
      return settings;
    },
    // Keep settings fresh so admin changes apply quickly for users
    staleTime: 0,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });
}
