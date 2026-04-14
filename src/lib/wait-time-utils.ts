export type WaitTimeCategory = "on_time" | "30_min" | "1_hour" | "1.5_hours_plus";

export const WAIT_TIME_LABELS: Record<WaitTimeCategory, string> = {
  on_time: "On Time",
  "30_min": "~30 Min",
  "1_hour": "~1 Hour",
  "1.5_hours_plus": "1.5+ Hours",
};

export const WAIT_TIME_COLORS: Record<WaitTimeCategory, string> = {
  on_time: "bg-green-500",
  "30_min": "bg-yellow-500",
  "1_hour": "bg-orange-500",
  "1.5_hours_plus": "bg-destructive",
};

export const WAIT_TIME_TEXT_COLORS: Record<WaitTimeCategory, string> = {
  on_time: "text-green-600",
  "30_min": "text-yellow-600",
  "1_hour": "text-orange-600",
  "1.5_hours_plus": "text-destructive",
};

export function getAverageWaitTime(
  reports: { wait_time: WaitTimeCategory; reported_at: string }[],
  maxAgeMinutes: number = 180
): { category: WaitTimeCategory; label: string; lastReported: string } | null {
  // Only consider reports newer than the configured expiry window
  const cutoffIso = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();
  const recent = reports.filter((r) => r.reported_at > cutoffIso);

  if (recent.length === 0) return null;

  const sorted = [...recent].sort(
    (a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime()
  );
  const latest = sorted[0];

  return {
    category: latest.wait_time,
    label: WAIT_TIME_LABELS[latest.wait_time],
    lastReported: latest.reported_at,
  };
}
