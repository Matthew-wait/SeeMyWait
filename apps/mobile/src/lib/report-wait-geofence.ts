/**
 * Fixed straight-line radius for submitting a wait-time report (GPS vs clinic).
 * Independent of `app_settings.nearby_radius_miles`, which only scopes which clinics appear “nearby” on the map/list.
 */
export const REPORT_WAIT_GEOFENCE_METERS = 1000;

/** GPS accuracy ceiling for reports: scales with geofence but capped at 100 m. */
export const maxAccuracyMetersForReport = (geofenceMeters: number): number =>
  Math.min(100, Math.max(20, Math.floor(geofenceMeters / 2)));
