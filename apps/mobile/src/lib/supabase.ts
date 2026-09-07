import { createClient } from '@supabase/supabase-js';

import { ENV, assertEnv } from '@/src/lib/env';

assertEnv();

export const supabase = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
