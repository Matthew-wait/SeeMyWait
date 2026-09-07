/** ISO 3166-1 alpha-2 — used for Nominatim fallbacks; keep in sync with GOOGLE_GEOCODE_COUNTRY on the edge function when possible. */
export const GEOCODE_COUNTRY = (import.meta.env.VITE_GEOCODE_COUNTRY as string | undefined)?.trim() || "us";
