const getEnv = (value?: string): string => (typeof value === 'string' ? value.trim() : '');

export const ENV = {
  supabaseUrl: getEnv(process.env.EXPO_PUBLIC_SUPABASE_URL) || getEnv(process.env.VITE_SUPABASE_URL),
  supabaseAnonKey:
    getEnv(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
    getEnv(process.env.VITE_SUPABASE_PUBLISHABLE_KEY),
  supabaseProjectId:
    getEnv(process.env.EXPO_PUBLIC_SUPABASE_PROJECT_ID) || getEnv(process.env.VITE_SUPABASE_PROJECT_ID),
  googleMapsApiKey: getEnv(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) || getEnv(process.env.GOOGLE_MAPS_API_KEY),
  googleGeocodeApiKey:
    getEnv(process.env.EXPO_PUBLIC_GOOGLE_GEOCODE_API_KEY) || getEnv(process.env.GOOGLE_GEOCODE_API_KEY),
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
