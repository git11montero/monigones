import { createClient } from '@supabase/supabase-js';
import { invariant } from '../shared/math';
import type { Store, User } from './store';
// Verificación remota del JWT, nunca decodificación sin comprobar firma.
export async function verifySupabaseToken(token: string, store: Store): Promise<User> {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_ANON_KEY;
  invariant(url && key, 'Configura SUPABASE_URL y SUPABASE_ANON_KEY en el servidor.');
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  invariant(!error && data.user?.email, 'Sesión Supabase inválida.');
  const user = {
    id: data.user.id,
    email: data.user.email,
    name: String(data.user.user_metadata?.name || data.user.email.split('@')[0]),
  };
  store.db
    .prepare(
      'INSERT INTO users(id,email,name,password) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name',
    )
    .run(user.id, user.email, user.name, 'supabase');
  return user;
}
