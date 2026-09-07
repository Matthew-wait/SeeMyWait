/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** ISO country code for client-side geocode fallbacks (default us) */
  readonly VITE_GEOCODE_COUNTRY?: string;
  /** Leaflet raster tile URL template (default: OpenStreetMap standard tiles). */
  readonly VITE_MAP_TILE_URL?: string;
  /** Attribution text shown on the map. */
  readonly VITE_MAP_TILE_ATTRIBUTION?: string;
  /** Optional tile-provider API key, appended as ?api_key=<key>. */
  readonly VITE_MAP_TILE_KEY?: string;
}
