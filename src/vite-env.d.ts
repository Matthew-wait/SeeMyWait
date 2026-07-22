/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** ISO country code for client-side geocode fallbacks (default us) */
  readonly VITE_GEOCODE_COUNTRY?: string;
  /** HTTP-referrer-restricted browser key for the Google Maps JavaScript API. */
  readonly VITE_GOOGLE_MAPS_JS_API_KEY?: string;
}
