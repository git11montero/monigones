import { createClient, type SupabaseClient } from '@supabase/supabase-js';
export const isOnlineBackend = import.meta.env.VITE_BACKEND === 'supabase';
export const onlineScope = String(import.meta.env.VITE_SUPABASE_URL || 'unconfigured');
let client: SupabaseClient | undefined;
export function getSupabase() {
  if (!isOnlineBackend) return undefined;
  const url = import.meta.env.VITE_SUPABASE_URL,
    key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key || key.startsWith('sb_secret_'))
    throw Error('Falta una configuración pública válida de Supabase.');
  client ??= createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}
