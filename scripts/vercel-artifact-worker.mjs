import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import process from 'node:process';
import { pathToFileURL, URL } from 'node:url';

const root = process.argv[2];
assert(root, 'Ejecuta npm run test:vercel-artifact.');
const user = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'artifact@example.test',
  aud: 'authenticated',
  role: 'authenticated',
  user_metadata: { name: 'Artefacto' },
};
const calls = [];
const rpc = {
  online_health: true,
  online_profile: null,
  online_rate: true,
  online_load: { membership: false, now: Date.now() },
  online_claim_due: [],
};
// Real HTTP fixture for Supabase Auth and PostgREST. Never use a remote service.
const supabase = createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  const name = req.url.split('/').at(-1);
  calls.push({ path: req.url, body: body ? JSON.parse(body) : null });
  assert.equal(req.headers.apikey, 'sb_secret_artifact_fixture');
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/auth/v1/user') {
    if (req.headers.authorization === 'Bearer artifact-user') res.end(JSON.stringify(user));
    else {
      res.statusCode = 401;
      res.end(JSON.stringify({ message: 'Invalid JWT', code: 'bad_jwt' }));
    }
  } else if (req.url.startsWith('/rest/v1/rpc/') && Object.hasOwn(rpc, name)) {
    res.end(JSON.stringify(rpc[name]));
  } else {
    res.statusCode = 500;
    res.end(JSON.stringify({ message: `Unexpected fixture request: ${req.url}` }));
  }
});
const api = createServer();
async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return `http://127.0.0.1:${server.address().port}`;
}
try {
  const supabaseUrl = await listen(supabase);
  Object.assign(process.env, {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SECRET_KEY: 'sb_secret_artifact_fixture',
    MONIGONES_CRON_SECRET: 'artifact-cron-fixture-01234567890123456789',
    PUBLIC_ORIGIN: 'https://monigones.vercel.app',
  });
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    assert.equal(url.origin, supabaseUrl, 'El artefacto intentó acceder a un servicio remoto.');
    return nativeFetch(input, init);
  };
  const metadata = JSON.parse(readFileSync(join(root, '.vc-config.json'), 'utf8'));
  // Native Node import: no tsx, Vite, ts-node, bundler or extension resolution shim.
  const { default: handler } = await import(pathToFileURL(join(root, metadata.handler)).href);
  assert.equal(typeof handler, 'function');
  api.on('request', handler);
  const url = await listen(api);
  let assertions = 0;
  async function request(path, status, options = {}) {
    const response = await nativeFetch(url + path, options);
    assert.equal(response.status, status, `${options.method || 'GET'} ${path}`);
    const body = await response.json();
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assertions++;
    return body;
  }
  const health = await request('/api/health', 200);
  assert.equal(health.mode, 'supabase-postgresql');
  assert.equal(health.ok, true);
  const session = await request('/api/session', 200);
  assert.equal(session.user, null);
  const headers = { authorization: 'Bearer artifact-user', 'content-type': 'application/json' };
  const authenticated = await request('/api/session', 200, { headers });
  assert.equal(authenticated.user.id, user.id);
  assert.equal(authenticated.membership, false);
  await request('/api/session', 401, { headers: { authorization: 'Bearer invalid-token' } });
  await request('/api/command', 401, { method: 'POST', body: '{}' });
  await request('/api/command', 400, {
    method: 'POST',
    headers: { ...headers, 'idempotency-key': 'artifact-command-0001' },
    body: JSON.stringify({ type: 'autoLineup' }),
  });
  await request('/api/cron', 401, { method: 'POST' });
  const cron = await request('/api/cron', 200, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.MONIGONES_CRON_SECRET}` },
  });
  assert.deepEqual(cron.results, []);
  await request('/api/state', 401);
  await request('/api/leagues', 401, { method: 'POST', body: '{}' });
  await request('/api/logout', 200, { method: 'POST', headers });
  await request('/api/health', 405, { method: 'PUT' });
  await request('/api/unknown', 404, { headers });
  for (const name of [
    'online_health',
    'online_profile',
    'online_rate',
    'online_load',
    'online_claim_due',
  ])
    assert(
      calls.some((c) => c.path === `/rest/v1/rpc/${name}`),
      `RPC no ejecutada: ${name}`,
    );
  assert(calls.some((c) => c.path === '/auth/v1/user'));
  console.log(
    JSON.stringify({
      runtime: process.version,
      handler: metadata.handler,
      isolated: true,
      nativeEsm: true,
      httpChecks: assertions,
      supabase: 'local HTTP fixture; no remote requests',
      status: 'passed',
    }),
  );
} finally {
  for (const server of [api, supabase]) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
