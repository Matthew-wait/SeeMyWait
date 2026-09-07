/**
 * Leaflet raster tile configuration — replaces the Google Maps JS widget.
 *
 * Values come from env (see `.env.example`). The default is keyless OpenStreetMap
 * standard tiles, which are fine for development and low volume but discouraged
 * for heavy production use. For production, set `VITE_MAP_TILE_URL` to a
 * commercial-friendly provider (e.g. Stadia Maps) and put the domain-allowlisted
 * key in `VITE_MAP_TILE_KEY`.
 */

const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEFAULT_ATTRIBUTION = "&copy; OpenStreetMap contributors";

export const TILE_URL: string =
  (import.meta.env.VITE_MAP_TILE_URL as string | undefined)?.trim() || DEFAULT_TILE_URL;

export const TILE_ATTRIBUTION: string =
  (import.meta.env.VITE_MAP_TILE_ATTRIBUTION as string | undefined)?.trim() ||
  DEFAULT_ATTRIBUTION;

const TILE_KEY = (import.meta.env.VITE_MAP_TILE_KEY as string | undefined)?.trim();

/**
 * Final URL template for `L.tileLayer()`. Appends `?api_key=<key>` when a
 * provider key is configured (Stadia / Thunderforest style). Providers that put
 * the key in the path should bake it into `VITE_MAP_TILE_URL` instead.
 */
export function tileUrlTemplate(): string {
  if (!TILE_KEY) return TILE_URL;
  const sep = TILE_URL.includes("?") ? "&" : "?";
  return `${TILE_URL}${sep}api_key=${encodeURIComponent(TILE_KEY)}`;
}

/** OSM raster tiles top out at zoom 19. */
export const TILE_MAX_ZOOM = 19;
