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

export interface ClinicWithWaitTime extends Clinic {
  waitTime: ReturnType<typeof getAverageWaitTime>;
  distance?: number;
}

export function useClinics(searchQuery?: string, userLat?: number, userLon?: number) {
  return useQuery({
    queryKey: ["clinics", searchQuery, userLat, userLon],
    queryFn: async (): Promise<ClinicWithWaitTime[]> => {
      let query = supabase.from("clinics").select("*");

      if (searchQuery) {
        query = query.ilike("name", `%${searchQuery}%`);
      }

      const { data: clinics, error } = await query.order("name");

      if (error) throw error;
      if (!clinics) return [];

      // Fetch recent wait time reports for all clinics
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      const { data: reports } = await supabase
        .from("wait_time_reports")
        .select("clinic_id, wait_time, reported_at")
        .gte("reported_at", threeHoursAgo)
        .eq("is_flagged", false);

      const reportsByClinic = (reports || []).reduce<
        Record<string, { wait_time: WaitTimeCategory; reported_at: string }[]>
      >((acc, r) => {
        if (!acc[r.clinic_id]) acc[r.clinic_id] = [];
        acc[r.clinic_id].push({
          wait_time: r.wait_time as WaitTimeCategory,
          reported_at: r.reported_at,
        });
        return acc;
      }, {});

      // Filter out clinics with invalid coordinates
      const validClinics = clinics.filter(
        (c) => c.latitude >= -90 && c.latitude <= 90 && c.longitude >= -180 && c.longitude <= 180
      );

      let result: ClinicWithWaitTime[] = validClinics.map((c) => ({
        ...c,
        waitTime: getAverageWaitTime(reportsByClinic[c.id] || []),
        distance:
          userLat !== undefined && userLon !== undefined
            ? getDistanceMiles(userLat, userLon, c.latitude, c.longitude)
            : undefined,
      }));

      // Sort by distance if location available
      if (userLat !== undefined && userLon !== undefined) {
        result.sort((a, b) => (a.distance || 999) - (b.distance || 999));
      }

      return result;
    },
  });
}
