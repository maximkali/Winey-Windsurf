import { createClient } from '@supabase/supabase-js';

function getEnv(key: string) {
  return process.env[key] || '';
}

export function getSupabaseAdmin() {
  const url = getEnv('SUPABASE_URL') || getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRole = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceRole) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
