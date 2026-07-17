import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

// Lazy singleton — reads env vars at first call (request time), not at module
// load, so `next build` doesn't fail when env vars aren't present at build time.
export function getAdminClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) {
    throw new Error(
      'Admin panel requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables. ' +
      'Copy .env from the Expo project and add the service role key.'
    );
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}
