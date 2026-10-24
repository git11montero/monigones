import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';
import { invariant } from '../../shared/math.js';
import { PostgresStore, type OnlineUser } from './store.js';
import { SupabaseRpc } from './transport.js';
import type { Command } from '../../shared/types.js';
import { OnlineHttpError, onlineFailure, readJsonObject } from './http.js';
export type OnlineConfig = { url: string; secret: string; cronSecret: string; origin: string };
export function onlineConfig(): OnlineConfig {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    cronSecret = process.env.MONIGONES_CRON_SECRET || '',
    origin = process.env.PUBLIC_ORIGIN || 'https://monigones.vercel.app';
  if (!url || !secret || cronSecret.length < 32)
    throw new OnlineHttpError(
      503,
      'BACKEND_NOT_CONFIGURED',
      'Configura el backend online: URL, clave privada y secreto cron.',
    );
  return { url, secret, cronSecret, origin };
}
export async function supabaseIdentity(token: string, config: OnlineConfig): Promise<OnlineUser> {
  const client = createClient(config.url, config.secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error && error.status !== 400 && error.status !== 401 && error.status !== 403)
    throw new OnlineHttpError(
      503,
      'AUTH_UNAVAILABLE',
      'El servicio de autenticación no está disponible.',
    );
  if (error || !data.user?.email)
    throw new OnlineHttpError(401, 'AUTH_INVALID_TOKEN', 'Sesión Supabase inválida.');
  const proposed = String(data.user.user_metadata?.name || data.user.email.split('@')[0])
    .trim()
    .slice(0, 60);
  return {
    id: data.user.id,
    email: data.user.email,
    name: proposed.length >= 2 ? proposed : 'Presidente',
  };
}
function equalSecret(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function onlineHandler(
  store: PostgresStore,
  config: OnlineConfig,
  identity = (token: string) => supabaseIdentity(token, config),
) {
  return async (request: Request): Promise<Response> => {
    const headers = {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Type': 'application/json; charset=utf-8',
    };
    const json = (value: unknown, status = 200, extra: Record<string, string> = {}) =>
      new Response(JSON.stringify(value), { status, headers: { ...headers, ...extra } });
    const path = new URL(request.url).pathname;
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    try {
      if (!['GET', 'POST'].includes(request.method))
        return json({ error: 'Método no permitido.' }, 405);
      if (request.method === 'POST') {
        const origin = request.headers.get('origin');
        if (
          origin &&
          origin !== config.origin &&
          !(
            process.env.NODE_ENV !== 'production' &&
            /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
          )
        )
          return json({ error: 'Origen no autorizado.' }, 403);
      }
      if (path === '/api/health') {
        await store.rpc.call('online_health');
        return json({ ok: true, mode: 'supabase-postgresql', demo: false, adminTools: false });
      }
      const token = request.headers.get('authorization')?.replace(/^Bearer /i, '') || '';
      if (path === '/api/cron' && request.method === 'POST') {
        if (!equalSecret(token, config.cronSecret)) return json({ error: 'No autorizado.' }, 401);
        const result = await store.tick();
        return json(result, result.results.some((r) => !r.ok) ? 503 : 200);
      }
      if (path === '/api/session' && !token)
        return json({
          user: null,
          membership: false,
          demo: false,
          adminTools: false,
          authMode: 'supabase',
        });
      if (!token) return json({ error: 'Inicia sesión para continuar.' }, 401);
      let user: OnlineUser;
      try {
        user = await identity(token);
      } catch (error) {
        if (error instanceof OnlineHttpError) throw error;
        if (!(error instanceof Error) || error.constructor !== Error) throw error;
        return json({ error: 'Sesión Supabase inválida.' }, 401);
      }
      const body =
        request.method === 'POST' &&
        ['/api/login', '/api/logout', '/api/command', '/api/leagues'].includes(path)
          ? await readJsonObject(request, path === '/api/command' || path === '/api/leagues')
          : undefined;
      await store.profile(user);
      await store.rate(
        user.id,
        path === '/api/leagues' ? 'join' : request.method === 'GET' ? 'read' : 'command',
      );
      if (path === '/api/session' && request.method === 'GET') {
        const state = await store.load(user.id);
        return json({
          user,
          membership: !!state.membership,
          demo: false,
          adminTools: false,
          authMode: 'supabase',
        });
      }
      if (path === '/api/logout' && request.method === 'POST') return json({ ok: true });
      if (path === '/api/login' && request.method === 'POST') return json({ user });
      if (path === '/api/state' && request.method === 'GET') {
        const head = await store.rpc.call<{ revision: number; now: number; due: boolean } | null>(
          'online_head',
          { p_user: user.id },
        );
        if (head && !head.due && request.headers.get('if-none-match') === `"${head.revision}"`)
          return new Response(null, {
            status: 304,
            headers: { 'Cache-Control': 'no-store', 'X-Monigones-Time': String(head.now) },
          });
        const state = await store.getState(user.id);
        return json(state, 200, { ETag: `"${state.state.version}"` });
      }
      if (request.method === 'POST' && ['/api/command', '/api/leagues'].includes(path)) {
        invariant(body, 'Esta ruta requiere un cuerpo JSON.');
        if (path === '/api/leagues')
          return json(
            await (body.invite ? store.joinLeague(user, body) : store.createLeague(user, body)),
            201,
          );
        invariant(typeof body.type === 'string', 'Acción inválida.');
        return json(
          await store.dispatch(
            user.id,
            body as Command,
            request.headers.get('idempotency-key') || '',
          ),
        );
      }
      return json({ error: 'Ruta no encontrada.' }, 404);
    } catch (error) {
      const failure = onlineFailure(error);
      return json(failure.body, failure.status);
    }
  };
}
export function productionHandler() {
  const config = onlineConfig();
  return onlineHandler(new PostgresStore(new SupabaseRpc(config.url, config.secret)), config);
}
