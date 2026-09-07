import * as Location from 'expo-location';

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type LocationResult = {
  coords: LatLng;
  accuracy: number | null;
};

export type ReverseGeocodeAddress = {
  city?: string | null;
  district?: string | null;
  name?: string | null;
  postalCode?: string | null;
  region?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  subregion?: string | null;
  country?: string | null;
};

const buildGeoOptions = (accuracy: Location.Accuracy): Location.LocationOptions => ({
  accuracy,
  mayShowUserSettingsDialog: true,
});

const hasPermission = async (): Promise<boolean> => {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.granted;
};

/**
 * Fresh GPS fix. Defaults to highest accuracy (used by geofenced wait reports).
 * iOS first fixes are slow, so the timeout is generous.
 */
export const getCurrentPosition = async (
  accuracy: Location.Accuracy = Location.Accuracy.Highest,
  timeoutMs = 20_000
): Promise<LocationResult> => {
  const granted = await hasPermission();
  if (!granted) {
    throw new Error('Location permission denied');
  }

  const location = await Promise.race([
    Location.getCurrentPositionAsync(buildGeoOptions(accuracy)),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Location timeout after ${Math.round(timeoutMs / 1000)}s`)), timeoutMs)
    ),
  ]);

  return {
    coords: {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    },
    accuracy: location.coords.accuracy ?? null,
  };
};

/** Immediate cached fix (no waiting for GPS). Null if none/permission denied. */
export const getLastKnownPosition = async (): Promise<LocationResult | null> => {
  const granted = await hasPermission();
  if (!granted) return null;
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
    if (!last) return null;
    return {
      coords: { latitude: last.coords.latitude, longitude: last.coords.longitude },
      accuracy: last.coords.accuracy ?? null,
    };
  } catch {
    return null;
  }
};

/**
 * Resilient position for centering the map (NOT for geofenced reports).
 * Tiered so "Find Me" lands on the precise point when possible but still
 * works on slow iOS cold-start fixes:
 *   1. Highest accuracy (precise, like Google Maps) — generous timeout.
 *   2. Balanced accuracy (quick, ~100 m) if the precise fix is too slow.
 *   3. Last known cached position as a final fallback.
 */
export const getDisplayPosition = async (): Promise<LocationResult | null> => {
  try {
    return await getCurrentPosition(Location.Accuracy.Highest, 12_000);
  } catch {
    // precise fix too slow — fall through to a faster, looser attempt
  }
  try {
    return await getCurrentPosition(Location.Accuracy.Balanced, 8_000);
  } catch {
    return getLastKnownPosition();
  }
};

export const getPreciseCurrentPosition = async (
  targetAccuracyMeters = 30,
  maxWaitMs = 20000
): Promise<LocationResult> => {
  const granted = await hasPermission();
  if (!granted) {
    throw new Error('Location permission denied');
  }

  const startedAt = Date.now();
  let best: LocationResult | null = null;

  while (Date.now() - startedAt < maxWaitMs) {
    const sample = await getCurrentPosition();
    const sampleAccuracy = sample.accuracy ?? Number.POSITIVE_INFINITY;
    const bestAccuracy = best?.accuracy ?? Number.POSITIVE_INFINITY;
    if (!best || sampleAccuracy < bestAccuracy) {
      best = sample;
    }
    if (sampleAccuracy <= targetAccuracyMeters) {
      return sample;
    }
  }

  if (best) return best;
  return getCurrentPosition();
};

const buildAddressLine = (parts: ReverseGeocodeAddress): string => {
  const line1 = [parts.streetNumber, parts.street].filter(Boolean).join(' ').trim();
  const line2 = [parts.city ?? parts.district ?? parts.subregion, parts.region, parts.postalCode]
    .filter(Boolean)
    .join(', ')
    .trim();
  const line3 = parts.country?.trim() ?? '';
  return [line1, line2, line3].filter(Boolean).join(', ');
};

export const reverseGeocodeAddress = async (coords: LatLng): Promise<string | null> => {
  const granted = await hasPermission();
  if (!granted) return null;
  try {
    const rows = await Location.reverseGeocodeAsync({
      latitude: coords.latitude,
      longitude: coords.longitude,
    });
    if (!rows?.length) return null;
    const first = rows[0] as ReverseGeocodeAddress;
    const formatted = buildAddressLine(first);
    return formatted || null;
  } catch {
    return null;
  }
};
