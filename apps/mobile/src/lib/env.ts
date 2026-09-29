const getEnv = (value?: string): string => (typeof value === 'string' ? value.trim() : '');

export const ENV = {
  supabaseUrl: getEnv(process.env.EXPO_PUBLIC_SUPABASE_URL) || getEnv(process.env.VITE_SUPABASE_URL),
  supabaseAnonKey:
    getEnv(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
    getEnv(process.env.VITE_SUPABASE_PUBLISHABLE_KEY),
  supabaseProjectId:
    getEnv(process.env.EXPO_PUBLIC_SUPABASE_PROJECT_ID) || getEnv(process.env.VITE_SUPABASE_PROJECT_ID),
  // Map tiles are free OpenStreetMap raster tiles (react-native-maps UrlTile,
  // mapType="none") on both platforms — no Google tile billing. Android's
  // react-native-maps widget still needs a Maps SDK for Android key to host
  // the native view at all (that SDK itself is free/unlimited, unrelated to
  // the OSM tiles actually shown). No Places/Geocoding key anywhere in this
  // app — nothing in the codebase calls those paid APIs.
  googleMapsApiKey:
    getEnv(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) || getEnv(process.env.GOOGLE_MAPS_API_KEY),
};

export const assertEnv = (): void => {
  const missing: string[] = [];
  if (!ENV.supabaseUrl) missing.push('EXPO_PUBLIC_SUPABASE_URL or VITE_SUPABASE_URL');
  if (!ENV.supabaseAnonKey) {
    missing.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_PUBLISHABLE_KEY');
  }
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
};
