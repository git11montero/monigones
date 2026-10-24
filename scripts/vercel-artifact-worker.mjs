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
  online_receipt: null,
  online_commit: 'committed',
};
let profileMode = 'void';
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
    // PostgREST returns no representation for RETURNS void functions.
    if (name === 'online_profile') {
      if (profileMode === 'void') {
        res.statusCode = 204;
        res.removeHeader('Content-Type');
        res.end();
      } else if (profileMode === 'invalid') res.end('{');
      else if (profileMode === 'empty-error') {
        res.statusCode = 503;
        res.end();
      }
    } else {
      if (name === 'online_commit') {
        const args = JSON.parse(body);
        rpc.online_load.state = args.p_state;
        rpc.online_load.revision = args.p_state.version;
      }
      res.end(JSON.stringify(rpc[name]));
    }
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
  const { createGame } = await import(pathToFileURL(join(root, 'shared/seed.js')).href);
  const state = createGame(Date.now(), true, user.id);
  state.clubs.forEach((club, i) => {
    club.userId = i === 0 ? user.id : `reserved-demo:${state.id}:demo${i + 1}`;
    club.presidentName = `Presidente ${i + 1}`;
  });
  rpc.online_load = {
    membership: true,
    state,
    revision: state.version,
    now: state.now,
    clubId: state.clubs[0].id,
  };
  rpc.online_head = { revision: state.version, now: state.now, due: false };
  let helperReads = 0;
  api.on('request', async (req, res) => {
    const mode = req.headers['x-fixture-body-mode'];
    // Emulate Vercel's lazy body getter after the platform has buffered the stream.
    if (mode) {
      let raw = '';
      if (req.method !== 'GET') for await (const chunk of req) raw += chunk;
      if (mode === 'parsed-no-length') delete req.headers['content-length'];
      if (mode !== 'consumed')
        Object.defineProperty(req, 'body', {
          get() {
            helperReads++;
            if (req.method === 'GET') throw new Error('A GET body getter must never be accessed');
            if (mode === 'platform-error')
              throw Object.assign(new Error('Invalid JSON'), { statusCode: 400 });
            return mode === 'buffer'
              ? Buffer.from(raw)
              : mode === 'null'
                ? null
                : mode === 'text'
                  ? raw
                  : JSON.parse(raw);
          },
        });
    }
    await handler(req, res);
  });
  const url = await listen(api);
  let assertions = 0;
  async function request(path, status, options = {}) {
    const response = await nativeFetch(url + path, options);
    const body = await response.json();
    assert.equal(
      response.status,
      status,
      `${options.method || 'GET'} ${path}: ${body.error || ''}`,
    );
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
  const authenticated = await request('/api/session', 200, {
    headers: { ...headers, 'x-fixture-body-mode': 'parsed' },
  });
  assert.equal(authenticated.user.id, user.id);
  assert.equal(authenticated.membership, true);
  assert.equal(helperReads, 0);
  for (const body of [undefined, '', '{}', '{"accessToken":"ignored-body-value"}'])
    assert.equal(
      (await request('/api/login', 200, { method: 'POST', headers, body })).user.id,
      user.id,
    );
  for (const mode of ['parsed', 'text', 'buffer']) {
    const before = helperReads;
    await request('/api/login', 200, {
      method: 'POST',
      headers: { ...headers, 'x-fixture-body-mode': mode },
      body: '{}',
    });
    assert.equal(helperReads, before + 1, 'The parsed body helper must be read only once');
  }
  const nullBody = await request('/api/login', 400, {
    method: 'POST',
    headers: { ...headers, 'x-fixture-body-mode': 'null' },
    body: 'null',
  });
  assert.equal(nullBody.code, 'JSON_OBJECT_REQUIRED');
  for (const mode of [undefined, 'parsed', 'platform-error']) {
    const malformed = await request('/api/login', 400, {
      method: 'POST',
      headers: { ...headers, ...(mode ? { 'x-fixture-body-mode': mode } : {}) },
      body: '{',
    });
    assert.equal(malformed.code, 'INVALID_JSON');
  }
  const consumed = await request('/api/command', 400, {
    method: 'POST',
    headers: { ...headers, 'x-fixture-body-mode': 'consumed' },
    body: '{}',
  });
  assert.equal(consumed.code, 'BODY_ALREADY_CONSUMED');
  for (const mode of [undefined, 'parsed-no-length']) {
    const large = await request('/api/command', 413, {
      method: 'POST',
      headers: { ...headers, ...(mode ? { 'x-fixture-body-mode': mode } : {}) },
      body: JSON.stringify({ text: 'x'.repeat(512001) }),
    });
    assert.equal(large.code, 'BODY_TOO_LARGE');
  }
  for (const path of ['/api/command', '/api/leagues']) {
    assert.equal(
      (await request(path, 400, { method: 'POST', headers })).code,
      'JSON_BODY_REQUIRED',
    );
    assert.equal(
      (await request(path, 400, { method: 'POST', headers, body: '{' })).code,
      'INVALID_JSON',
    );
  }
  const game = await request('/api/state', 200, { headers });
  assert.equal(game.state.players.length, 500);
  assert.equal(game.state.clubs[0].presidentName, 'Presidente 1');
  assert.equal(game.state.privateRng, undefined);
  await request('/api/command', 200, {
    method: 'POST',
    headers: { ...headers, 'idempotency-key': 'artifact-chat-raw' },
    body: '{"type":"chat","text":"Mensaje fixture raw"}',
  });
  rpc.online_load.now += 1100;
  await request('/api/command', 200, {
    method: 'POST',
    headers: {
      ...headers,
      'x-fixture-body-mode': 'parsed',
      'idempotency-key': 'artifact-chat-parsed',
    },
    body: '{"type":"chat","text":"Mensaje fixture parsed"}',
  });
  assert.equal(rpc.online_load.state.chat.at(-1).text, 'Mensaje fixture parsed');
  profileMode = 'invalid';
  assert.equal((await request('/api/session', 502, { headers })).code, 'RPC_INVALID_JSON');
  profileMode = 'empty-error';
  assert.equal(
    (await request('/api/login', 502, { method: 'POST', headers })).code,
    'RPC_REJECTED',
  );
  profileMode = 'void';
  await request('/api/session', 401, { headers: { authorization: 'Bearer invalid-token' } });
  await request('/api/command', 401, { method: 'POST', body: '{}' });
  await request('/api/command', 400, {
    method: 'POST',
    headers: { ...headers, 'idempotency-key': 'artifact-command-0001' },
    body: JSON.stringify({ type: 'unknown-command-fixture' }),
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
      profile204: true,
      parsedAndConsumedBodies: true,
      membershipAndGame: true,
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
