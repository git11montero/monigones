import { mediaStatus, publicFootballPath } from './football-media';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { Store, type User } from './store';
import { invariant } from '../shared/math';
import { REAL_CLUBS } from '../shared/sports';
import type { Command } from '../shared/types';
import { verifySupabaseToken } from './supabase';
try {
  process.loadEnvFile('.env');
} catch {
  /* Configuración opcional. */
}
const port = Number(process.env.PORT || 3001),
  host = process.env.HOST || '127.0.0.1';
const demo =
  process.env.CROWN_DEMO === 'true' ||
  (process.env.CROWN_DEMO !== 'false' && process.env.NODE_ENV !== 'production');
const adminTools =
  process.env.CROWN_ADMIN_TOOLS === 'true' ||
  (process.env.CROWN_ADMIN_TOOLS !== 'false' && process.env.NODE_ENV !== 'production');
const store = new Store(process.env.CROWN_DB || 'data/crown.sqlite', demo);
const clients = new Set<{ userId: string; res: ServerResponse; token: string }>();
const rates = new Map<string, { n: number; until: number }>();
const cookie = (req: IncomingMessage) =>
  req.headers.cookie
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('crown_session='))
    ?.slice(14) || '';
function json(res: ServerResponse, code: number, body: unknown) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(body));
}
async function body(req: IncomingMessage) {
  let size = 0,
    text = '';
  for await (const chunk of req) {
    size += chunk.length;
    invariant(size <= 512000, 'Petición demasiado grande.');
    text += chunk;
  }
  try {
    return JSON.parse(text || '{}') as Record<string, unknown>;
  } catch {
    throw Error('JSON inválido.');
  }
}
const string = (v: unknown, max = 128) => {
  invariant(typeof v === 'string' && v.length <= max, 'Campo de texto inválido.');
  return v;
};
function setSession(res: ServerResponse, userId: string) {
  const token = store.session(userId);
  res.setHeader(
    'Set-Cookie',
    `crown_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${process.env.COOKIE_SECURE === 'true' ? '; Secure' : ''}`,
  );
}
function broadcast() {
  for (const c of clients) c.res.write(`event: change\ndata: ${Date.now()}\n\n`);
}
function clubInput(b: Record<string, unknown>) {
  const clubName = string(b.clubName, 40).trim(),
    favorite = string(b.favorite),
    color = string(b.color);
  invariant(clubName.length >= 3, 'El nombre del club debe tener al menos tres caracteres.');
  invariant(
    REAL_CLUBS.some((c) => c.id === favorite),
    'Equipo favorito inválido.',
  );
  invariant(/^#[0-9a-f]{6}$/i.test(color), 'Color inválido.');
  return { clubName, favorite, color };
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  try {
    if (req.method === 'POST') {
      const origin = req.headers.origin;
      if (origin) {
        const allowed = [
          `http://${req.headers.host}`,
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          `http://localhost:${process.env.WEB_PORT || 5173}`,
          `http://127.0.0.1:${process.env.WEB_PORT || 5173}`,
          process.env.PUBLIC_ORIGIN,
        ].filter(Boolean);
        invariant(allowed.includes(origin), 'Origen de petición no autorizado.');
      }
      const ip = req.socket.remoteAddress || 'local';
      const rate = rates.get(ip);
      if (!rate || rate.until < Date.now()) rates.set(ip, { n: 1, until: Date.now() + 60000 });
      else {
        rate.n++;
        invariant(rate.n <= 180, 'Demasiadas peticiones. Espera un minuto.');
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/football-assets') {
      json(res, 200, mediaStatus());
      return;
    }
    if (req.method === 'GET' && url.pathname.startsWith('/assets/futbol/')) {
      const file = publicFootballPath(url.pathname);
      if (!file || !existsSync(file)) {
        json(res, 404, { error: 'Imagen no encontrada.' });
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(readFileSync(file));
      return;
    }
    if (url.pathname === '/api/health') {
      json(res, 200, { ok: true, mode: 'local-server', demo, adminTools });
      return;
    }
    if (url.pathname === '/api/session' && req.method === 'GET') {
      const user = store.user(cookie(req));
      json(res, 200, {
        user: user || null,
        membership: user ? !!store.membership(user.id) : false,
        demo,
        adminTools,
        authMode: process.env.AUTH_MODE || 'local',
      });
      return;
    }
    if (url.pathname === '/api/demo' && req.method === 'POST') {
      invariant(demo, 'Las cuentas de demostración están desactivadas.');
      const b = await body(req);
      const id = string(b.userId);
      // A historical sixth account remains usable after an explicit restoration.
      // New demos have no sixth membership, so the reserved club cannot log in.
      invariant(/^demo[1-6]$/.test(id) && store.membership(id), 'Cuenta no disponible.');
      setSession(res, id);
      json(res, 200, { ok: true });
      return;
    }
    if (url.pathname === '/api/register' && req.method === 'POST') {
      invariant(process.env.AUTH_MODE !== 'supabase', 'Utiliza el acceso de Supabase.');
      const b = await body(req);
      const u = store.createUser(string(b.email, 254), string(b.password), string(b.name, 60));
      setSession(res, u.id);
      json(res, 201, { user: u });
      return;
    }
    if (url.pathname === '/api/login' && req.method === 'POST') {
      const b = await body(req);
      let u: User;
      if (process.env.AUTH_MODE === 'supabase') {
        u = await verifySupabaseToken(string(b.accessToken, 10000), store);
      } else u = store.login(string(b.email, 254), string(b.password));
      setSession(res, u.id);
      json(res, 200, { user: u });
      return;
    }
    if (url.pathname === '/api/logout' && req.method === 'POST') {
      store.logout(cookie(req));
      res.setHeader('Set-Cookie', 'crown_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
      json(res, 200, { ok: true });
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      const token = cookie(req),
        user = store.user(token);
      if (!user) {
        json(res, 401, { error: 'Inicia sesión para continuar.' });
        return;
      }
      if (url.pathname === '/api/leagues' && req.method === 'POST') {
        const b = await body(req);
        const { clubName, favorite, color } = clubInput(b);
        const result = b.invite
          ? store.joinLeague(user, string(b.invite), clubName, favorite, color)
          : store.createLeague(user, string(b.name, 60), clubName, favorite, color);
        json(res, 201, result);
        broadcast();
        return;
      }
      if (url.pathname === '/api/state' && req.method === 'GET') {
        json(res, 200, store.getState(user.id));
        return;
      }
      if (url.pathname === '/api/command' && req.method === 'POST') {
        const key = req.headers['idempotency-key'];
        invariant(
          typeof key === 'string' && /^[a-zA-Z0-9-]{8,100}$/.test(key),
          'Falta una clave de idempotencia válida.',
        );
        const b = await body(req);
        invariant(typeof b.type === 'string', 'Acción inválida.');
        json(
          res,
          200,
          store.dispatch(
            user.id,
            b as Command,
            key,
            adminTools,
            typeof req.headers['x-monigones-generation'] === 'string'
              ? req.headers['x-monigones-generation']
              : undefined,
          ),
        );
        broadcast();
        return;
      }
      if (url.pathname === '/api/events' && req.method === 'GET') {
        invariant(store.membership(user.id), 'No perteneces a una liga.');
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        });
        res.write('event: ready\ndata: connected\n\n');
        const client = { userId: user.id, res, token };
        clients.add(client);
        req.on('close', () => clients.delete(client));
        return;
      }
      json(res, 404, { error: 'Ruta no encontrada.' });
      return;
    }
    if (req.method === 'GET' && existsSync('dist/index.html')) {
      const file = resolve(
        'dist',
        '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname),
      );
      invariant(file.startsWith(resolve('dist') + '/'), 'Ruta inválida.');
      if (!existsSync(file) && extname(file)) {
        json(res, 404, { error: 'Recurso no encontrado.' });
        return;
      }
      const chosen = existsSync(file) && extname(file) ? file : resolve('dist/index.html');
      const types: Record<string, string> = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.webmanifest': 'application/manifest+json',
      };
      res.writeHead(200, {
        'Content-Type': types[extname(chosen)] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(readFileSync(chosen));
      return;
    }
    json(res, 404, { error: 'Servidor CROWN XI. Usa npm run dev para abrir la interfaz.' });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error de operación.';
    json(res, 400, { error: message });
  }
});
const interval = setInterval(() => {
  store.tick();
  for (const c of clients) {
    if (!store.user(c.token)) {
      c.res.end();
      clients.delete(c);
    } else c.res.write(': heartbeat\n\n');
  }
  broadcast();
}, 5000);
server.listen(port, host, () =>
  console.log(
    `CROWN XI · API http://${host}:${port} · demo=${demo} · reloj de pruebas=${adminTools}`,
  ),
);
function shutdown() {
  clearInterval(interval);
  for (const c of clients) c.res.end();
  server.close(() => {
    store.close();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
