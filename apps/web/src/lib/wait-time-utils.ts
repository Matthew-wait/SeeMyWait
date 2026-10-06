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

/** Tinted row background — used anywhere a clinic row needs the same
 *  at-a-glance highlight as the main nearby-offices list (e.g. the
 *  same-building picker popup). */
export const WAIT_TIME_BG_COLORS: Record<WaitTimeCategory, string> = {
  on_time: "bg-green-500/10 border-green-500/25",
  "30_min": "bg-yellow-500/10 border-yellow-500/25",
  "1_hour": "bg-orange-500/10 border-orange-500/25",
  "1.5_hours_plus": "bg-red-500/10 border-red-500/25",
};

/** Solid hex — for canvas/SVG map pin artwork, which can't use Tailwind
 *  classes. Keep in sync with WAIT_TIME_COLORS above. */
export const WAIT_TIME_HEX_COLORS: Record<WaitTimeCategory, string> = {
  on_time: "#22c55e",
  "30_min": "#eab308",
  "1_hour": "#f97316",
  "1.5_hours_plus": "#ef4444",
};

export interface WaitTimeSummary {
  category: WaitTimeCategory;
  label: string;
  /** ISO timestamp of the latest report, or null when this is the default state. */
  lastReported: string | null;
}

/** An "On Time" report reverting to On Time has no visible effect either way
 *  (the badge shows On Time whether it's active or expired), so unlike the
 *  other three categories it isn't admin-configurable — just a fixed value
 *  for how long it counts as "fresh" in admin-side report history. */
export const ON_TIME_REPORT_EXPIRY_MINUTES = 60;

/** The three admin-configurable per-category expiry settings — structurally
 *  compatible with the full `AppSettings` shape from `useAppSettings`, so
 *  callers can pass that object straight through. */
export interface ReportExpiryByCategory {
  report_expiry_30min_minutes: number;
  report_expiry_60min_minutes: number;
  report_expiry_90plus_minutes: number;
}

/** How long a report of this category stays "active" before reverting to
 *  On Time — each category has its own window (see ReportExpiryByCategory),
 *  not one flat value shared across all of them. */
export function reportExpiryMinutesFor(
  category: WaitTimeCategory,
  expiry: ReportExpiryByCategory
): number {
  switch (category) {
    case "on_time":
      return ON_TIME_REPORT_EXPIRY_MINUTES;
    case "30_min":
      return expiry.report_expiry_30min_minutes;
    case "1_hour":
      return expiry.report_expiry_60min_minutes;
    case "1.5_hours_plus":
      return expiry.report_expiry_90plus_minutes;
  }
}

/**
 * Latest wait state for an office.
 *
 * An office with no active report shows the green **"On Time"** default (matches
 * the mobile app's `waitTierVisual(null)` — the map pin, list card, legend, and
 * popup all read from this). `lastReported: null` marks the default so callers
 * can hide the "reported X ago" line; the badge stays green either way.
 *
 * Only the single most recent report ever counts — once a newer report
 * supersedes an older one, the older one is done for good. It does NOT
 * resurface just because the newer one's (possibly shorter) category window
 * has since elapsed, or because an admin flagged it — e.g. a 30-min report
 * that ages out (or gets flagged) after a 90-min report preceded it must
 * revert straight to On Time, not reveal the older 90-min report still
 * technically sitting inside its own longer window. `reports` must include
 * flagged rows (not pre-filtered) so this can see and correctly stop at them
 * — a caller that pre-filters `is_flagged=false` would make a flagged report
 * invisible here, which is exactly the "falls back to an older report"
 * resurrection this function exists to prevent.
 */
export function getAverageWaitTime(
  reports: { wait_time: WaitTimeCategory; reported_at: string; is_flagged?: boolean | null }[],
  expiry: ReportExpiryByCategory
): WaitTimeSummary {
  if (reports.length === 0) {
    return { category: "on_time", label: WAIT_TIME_LABELS.on_time, lastReported: null };
  }

  // Compare on epoch ms, not ISO strings: PostgREST returns "…+00:00" offsets
  // while Date#toISOString() returns "…Z", so a lexicographic `>` mis-orders
  // reports around the cutoff second.
  const latest = [...reports].sort(
    (a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime()
  )[0];

  if (latest.is_flagged) {
    return { category: "on_time", label: WAIT_TIME_LABELS.on_time, lastReported: null };
  }

  const ageMinutes = (Date.now() - new Date(latest.reported_at).getTime()) / 60000;
  if (ageMinutes > reportExpiryMinutesFor(latest.wait_time, expiry)) {
    return { category: "on_time", label: WAIT_TIME_LABELS.on_time, lastReported: null };
  }

  return {
    category: latest.wait_time,
    label: WAIT_TIME_LABELS[latest.wait_time],
    lastReported: latest.reported_at,
  };
}
