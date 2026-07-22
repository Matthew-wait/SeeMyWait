import { Loader } from "@googlemaps/js-api-loader";

/**
 * Browser-side Google Maps JavaScript API key. This is SEPARATE from the server
 * key used by the edge functions — it must be an HTTP-referrer-restricted key
 * for your web domain(s). Set it in `.env.local` as VITE_GOOGLE_MAPS_JS_API_KEY.
 * The server key is never used in the browser.
 */
export const MAPS_JS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_JS_API_KEY as
  | string
  | undefined;

export const hasMapsJsKey = Boolean(MAPS_JS_API_KEY);

/**
 * Hide every non-medical POI so shops/restaurants/landmarks don't clutter the
 * map, while keeping medical POIs visible AND clickable (needed for tap-to-add).
 * Applied verbatim from the mobile spec.
 */
export const MEDICAL_ONLY_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.medical", stylers: [{ visibility: "on" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];

let loaderPromise: Promise<typeof google> | null = null;

/**
 * Loads the Maps JS API once (subsequent calls share the promise). Rejects when
 * no browser key is configured so callers can render a graceful fallback instead
 * of a blank map.
 */
export function loadGoogleMaps(): Promise<typeof google> {
  if (!MAPS_JS_API_KEY) {
    return Promise.reject(new Error("VITE_GOOGLE_MAPS_JS_API_KEY is not set"));
  }
  if (!loaderPromise) {
    const loader = new Loader({
      apiKey: MAPS_JS_API_KEY,
      version: "weekly",
      libraries: ["places", "geocoding"],
    });
    loaderPromise = loader.load();
  }
  return loaderPromise;
}
