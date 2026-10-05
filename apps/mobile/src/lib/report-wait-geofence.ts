/**
 * Default straight-line radius for submitting a wait-time report. The live value comes from
 * `app_settings.report_geofence_meters` (see useAppSettings); this is only the fallback.
 * Independent of `nearby_radius_miles`, which only scopes which clinics appear “nearby”.
 */
export const REPORT_WAIT_GEOFENCE_METERS = 1000;

/** GPS accuracy ceiling for reports: equal to the geofence, same rule as the web app. */
export const maxAccuracyMetersForReport = (geofenceMeters: number): number =>
  Math.max(1, Math.round(geofenceMeters));
