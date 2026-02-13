import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { mustGetEnv } from '@/lib/env';

let client: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  if (client) return client;
  client = createClient(mustGetEnv('SUPABASE_URL'), mustGetEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
  return client;
}

