import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAverageWaitTime, WaitTimeCategory } from "@/lib/wait-time-utils";
import { getDistanceMiles } from "@/lib/geolocation";

export interface Clinic {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  google_place_id: string | null;
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
  distance?: number;
  routeDistance?: number;
  routeDistanceSource?: "google" | "fallback" | "unavailable";
}

const HISTORY_WINDOW_MINUTES = 180; // last 3 hours

export function useClinics(
  searchQuery?: string,
  userLat?: number,
  userLon?: number,
  reportExpiryMinutes: number = 180
) {
  return useQuery({
    queryKey: ["clinics", searchQuery, userLat, userLon, reportExpiryMinutes],
    // Re-evaluate periodically so a pin reverts to the default once its
    // report ages out of the expiry window, even if the user hasn't acted.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<ClinicWithWaitTime[]> => {
      let query = supabase.from("clinics").select("*");

      if (searchQuery) {
        query = query.ilike("name", `%${searchQuery}%`);
      }

      const { data: clinics, error } = await query.order("name");

      if (error) throw error;
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
          distance:
            userLat !== undefined && userLon !== undefined
              ? getDistanceMiles(userLat, userLon, c.latitude, c.longitude)
              : undefined,
        };
      });

      // Sort by distance if location available
      if (userLat !== undefined && userLon !== undefined) {
        result.sort((a, b) => (a.distance || 999) - (b.distance || 999));
      }

      return result;
    },
  });
}
