/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** ISO country code for client-side geocode fallbacks (default us) */
  readonly VITE_GEOCODE_COUNTRY?: string;
}
