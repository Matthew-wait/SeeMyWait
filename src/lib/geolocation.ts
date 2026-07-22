export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    });
  });
}

/**
 * True when a coordinate pair can safely be handed to Leaflet.
 *
 * Leaflet throws "Invalid LatLng object" on a non-finite lat/lng, and there is
 * no error boundary above the map — an unchecked pair blanks the whole page.
 */
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

/**
 * Uncached fix, for gating a wait report. `maximumAge: 0` forces the browser to
 * take a new reading — a minute-old cached position could place the user inside
 * the geofence after they've already walked away.
 */
export function getFreshPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    });
  });
}

// Haversine distance in meters
export function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
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

// Distance in miles
export function getDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return getDistanceMeters(lat1, lon1, lat2, lon2) / 1609.34;
}

export function isWithinRadius(
  userLat: number,
  userLon: number,
  clinicLat: number,
  clinicLon: number,
  radiusMeters: number = 100
): boolean {
  return getDistanceMeters(userLat, userLon, clinicLat, clinicLon) <= radiusMeters;
}
