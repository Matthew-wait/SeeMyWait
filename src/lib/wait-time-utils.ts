export type WaitTimeCategory = "on_time" | "30_min" | "1_hour" | "1.5_hours_plus";

export const WAIT_TIME_LABELS: Record<WaitTimeCategory, string> = {
  on_time: "On Time",
  "30_min": "~30 Min",
  "1_hour": "~1 Hour",
  "1.5_hours_plus": "1.5+ Hours",
};

/** Short minutes-style label for history rows, e.g. "30 min", "60 min", "90+ min". */
export const WAIT_TIME_MINUTES_LABEL: Record<WaitTimeCategory, string> = {
  on_time: "On time",
  "30_min": "30 min",
  "1_hour": "60 min",
  "1.5_hours_plus": "90+ min",
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

export interface WaitTimeSummary {
  category: WaitTimeCategory;
  label: string;
  /** ISO timestamp of the latest report, or null when this is the default state. */
  lastReported: string | null;
}

/**
 * Latest wait state for an office.
 *
 * An office with no active report shows the green **"On Time"** default (matches
 * the mobile app's `waitTierVisual(null)` — the map pin, list card, legend, and
 * popup all read from this). `lastReported: null` marks the default so callers
 * can hide the "reported X ago" line; the badge stays green either way.
 */
export function getAverageWaitTime(
  reports: { wait_time: WaitTimeCategory; reported_at: string }[],
  maxAgeMinutes: number = 180
): WaitTimeSummary {
  // Compare on epoch ms, not ISO strings: PostgREST returns "…+00:00" offsets
  // while Date#toISOString() returns "…Z", so a lexicographic `>` mis-orders
  // reports around the cutoff second.
  const cutoffMs = Date.now() - maxAgeMinutes * 60 * 1000;
  const recent = reports.filter((r) => new Date(r.reported_at).getTime() >= cutoffMs);

  if (recent.length === 0) {
    return { category: "on_time", label: WAIT_TIME_LABELS.on_time, lastReported: null };
  }

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
