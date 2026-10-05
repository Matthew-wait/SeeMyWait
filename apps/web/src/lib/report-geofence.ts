/** Max straight-line distance from user to office to allow submitting a wait report. */
export const REPORT_WAIT_GEOFENCE_METERS = 1000;

/**
 * GPS accuracy must be at or below this (meters) to report. Matches the
 * geofence: desktop and Wi-Fi-based locations are often hundreds of meters
 * accurate, so a tighter cap blocks legitimate reports.
 */
export const REPORT_MAX_GPS_ACCURACY_METERS = REPORT_WAIT_GEOFENCE_METERS;
