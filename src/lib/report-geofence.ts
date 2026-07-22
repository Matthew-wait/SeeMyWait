/** Max straight-line distance from user to office to allow submitting a wait report. */
export const REPORT_WAIT_GEOFENCE_METERS = 1000;

/**
 * GPS accuracy must be at or below this (meters) to report.
 * Derived from the geofence: half of it, clamped to 20–100 m.
 */
export const REPORT_MAX_GPS_ACCURACY_METERS = Math.min(
  100,
  Math.max(20, Math.floor(REPORT_WAIT_GEOFENCE_METERS / 2))
);
