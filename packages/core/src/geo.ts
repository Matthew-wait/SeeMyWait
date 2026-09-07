/**
 * Pure geo math shared by web and mobile. No platform APIs — the actual
 * position getter (`navigator.geolocation` / `expo-location`) stays per-app.
 */

/** True when a coordinate pair is finite and in range (safe for any map lib). */
export function hasValidCoords(latitude: unknown, longitude: unknown): boolean {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/** Great-circle distance in metres. */
export function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Great-circle distance in miles. */
export function getDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return getDistanceMeters(lat1, lon1, lat2, lon2) / 1609.34;
}

export function isWithinRadius(
  userLat: number,
  userLon: number,
  clinicLat: number,
  clinicLon: number,
  radiusMeters = 100,
): boolean {
  return getDistanceMeters(userLat, userLon, clinicLat, clinicLon) <= radiusMeters;
}

/* ── wait-report geofence ── */

/** Max straight-line distance from user to office to allow submitting a report. */
export const REPORT_WAIT_GEOFENCE_METERS = 1000;

/** GPS accuracy must be at or below this (metres) to report — half the geofence, clamped 20–100. */
export const REPORT_MAX_GPS_ACCURACY_METERS = Math.min(
  100,
  Math.max(20, Math.floor(REPORT_WAIT_GEOFENCE_METERS / 2)),
);
