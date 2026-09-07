import type { LatLng } from '@/src/lib/geolocation';

export const toRadians = (value: number): number => (value * Math.PI) / 180;

export const haversineDistanceMeters = (a: LatLng, b: LatLng): number => {
  const earthRadius = 6_371_000;
  const latDelta = toRadians(b.latitude - a.latitude);
  const lngDelta = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const part =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDelta / 2) * Math.sin(lngDelta / 2);
  const angularDistance = 2 * Math.atan2(Math.sqrt(part), Math.sqrt(1 - part));
  return earthRadius * angularDistance;
};

export const metersToMiles = (meters: number): number => meters * 0.000621371;
