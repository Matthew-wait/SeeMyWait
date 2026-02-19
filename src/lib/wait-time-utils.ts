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
  reports: { wait_time: WaitTimeCategory; reported_at: string }[]
): { category: WaitTimeCategory; label: string; lastReported: string } | null {
  // Only consider reports from the last 3 hours
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const recent = reports.filter((r) => r.reported_at > threeHoursAgo);

  if (recent.length === 0) return null;

  const weights: Record<WaitTimeCategory, number> = {
    on_time: 0,
    "30_min": 30,
    "1_hour": 60,
    "1.5_hours_plus": 90,
  };

  const avg =
    recent.reduce((sum, r) => sum + weights[r.wait_time], 0) / recent.length;

  let category: WaitTimeCategory;
  if (avg <= 10) category = "on_time";
  else if (avg <= 40) category = "30_min";
  else if (avg <= 70) category = "1_hour";
  else category = "1.5_hours_plus";

  const sorted = [...recent].sort(
    (a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime()
  );

  return {
    category,
    label: WAIT_TIME_LABELS[category],
    lastReported: sorted[0].reported_at,
  };
}
