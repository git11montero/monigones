import { writeOnlineResponse } from '../../server/online/response';
import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { PostgresStore, type RpcTransport, type OnlineUser } from '../../server/online/store';
import { onlineHandler } from '../../server/online/handler';
import { SupabaseRpc } from '../../server/online/transport';
import { createServer } from 'node:http';
import { createGame } from '../../shared/seed';
import { euro } from '../../shared/config';
import type { GameState } from '../../shared/types';
const url = process.env.MONIGONES_TEST_DATABASE_URL || '';
if (
  process.env.MONIGONES_ISOLATED_TEST !== 'true' ||
  !/^postgresql:\/\/postgres@127\.0\.0\.1:\d+\/postgres$/.test(url)
)
  throw Error('Ejecuta npm run test:postgres: solo se permiten clústeres nuevos y desechables.');
const db = new Pool({ connectionString: url, max: 16 });
const rpc: RpcTransport = {
  async call<T>(name: string, args: Record<string, unknown> = {}) {
    if (!/^online_[a-z_]+$/.test(name) || Object.keys(args).some((k) => !/^p_[a-z_]+$/.test(k)))
      throw Error('RPC inválida');
    const client = await db.connect();
    try {
      await client.query('begin');
      await client.query('set local role service_role');
      const keys = Object.keys(args),
        query = `select public.${name}(${keys.map((k, i) => `${k}=>$${i + 1}`).join(',')}) as value`;
      const result = await client.query(query, Object.values(args));
      await client.query('commit');
      return result.rows[0].value as T;
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
  },
};
const store = new PostgresStore(rpc);
let users: OnlineUser[], league: string, foreign: string;
const input = { name: 'Liga QA online', clubName: 'Club QA', favorite: 'betis', color: '#446688' };
const command = (who: number, data: Record<string, unknown>, key = randomUUID()) =>
  store.dispatch(users[who].id, data as any, key);
async function mutate(change: (s: GameState) => void, id = league) {
  const snapshot = await rpc.call<any>('online_load_league', { p_league: id });
  change(snapshot.state);
  snapshot.state.version++;
  await db.query(
    "update monigones_private.games set state=$1,revision=$2,next_due_at=now()-interval '1 second' where league_id=$3",
    [snapshot.state, snapshot.state.version, id],
  );
}
async function asRole<T>(
  role: 'anon' | 'authenticated',
  user: string,
  sql: string,
  values: unknown[] = [],
): Promise<T[]> {
  const client = await db.connect();
  try {
    await client.query('begin');
    await client.query(`set local role ${role}`);
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
    const result = await client.query(sql, values);
    await client.query('rollback');
    return result.rows;
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}
beforeAll(async () => {
  await db.query('select 1');
});
beforeEach(async () => {
  await db.query('truncate auth.users cascade');
  users = Array.from({ length: 3 }, (_, i) => ({
    id: randomUUID(),
    email: `qa${i}@example.test`,
    name: `Presidente QA ${i}`,
  }));
  for (const user of users) {
    await db.query('insert into auth.users values($1,$2)', [user.id, user.email]);
    await store.profile(user);
  }
  const created = await store.createLeague(users[0], input);
  league = created.state.id;
  await store.joinLeague(users[1], {
    ...input,
    invite: created.state.invite,
    clubName: 'Segundo Club',
  });
  foreign = (
    await store.createLeague(users[2], { ...input, name: 'Otra liga', clubName: 'Club ajeno' })
  ).state.id;
});
afterAll(async () => {
  await db.end();
});

describe('PostgreSQL real: migraciones, RLS y superficie privilegiada', () => {
  it('ejecuta todo el esquema y seed: 500 jugadores, restricciones y publicación Realtime', async () => {
    expect((await db.query('select count(*)::int as n from public.players')).rows[0].n).toBe(500);
    expect(
      (
        await db.query(
          "select tablename from pg_publication_tables where pubname='supabase_realtime'",
        )
      ).rows.map((r) => r.tablename),
    ).toEqual(['game_revisions']);
    const functions = (
      await db.query(
        "select p.proname,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'online_%'",
      )
    ).rows;
    expect(functions.length).toBeGreaterThanOrEqual(10);
    expect(
      functions.every(
        (f) => f.prosecdef && f.proconfig.includes('search_path=pg_catalog, pg_temp'),
      ),
    ).toBe(true);
  });
  it('dos miembros leen solo su revisión y una tercera cuenta no ve ni la liga ni sus miembros', async () => {
    for (const i of [0, 1])
      expect(
        await asRole('authenticated', users[i].id, 'select league_id from public.game_revisions'),
      ).toEqual([{ league_id: league }]);
    expect(
      await asRole('authenticated', users[2].id, 'select league_id from public.game_revisions'),
    ).toEqual([{ league_id: foreign }]);
    expect(
      await asRole('authenticated', users[2].id, 'select * from public.leagues where id=$1', [
        league,
      ]),
    ).toHaveLength(0);
    expect(
      await asRole(
        'authenticated',
        users[2].id,
        'select * from public.memberships where league_id=$1',
        [league],
      ),
    ).toHaveLength(0);
  });
  it('anon no lee; authenticated no lee agregados, no se autoasigna membresía ni invoca commits', async () => {
    await expect(asRole('anon', '', 'select * from public.game_revisions')).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      asRole('authenticated', users[0].id, 'select state from monigones_private.games'),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asRole('authenticated', users[0].id, 'select public.online_load($1)', [users[0].id]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asRole('authenticated', users[0].id, 'update public.game_revisions set revision=999'),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asRole('authenticated', users[0].id, 'delete from public.memberships'),
    ).rejects.toThrow(/permission denied/);
    const grants = await db.query(
      "select has_function_privilege('authenticated','public.online_commit(uuid,bigint,jsonb,timestamptz,uuid,text,text,boolean)','execute') as commit,has_function_privilege('authenticated','public.place_market_bid(uuid,text,bigint,integer,uuid)','execute') as legacy",
    );
    expect(grants.rows[0]).toEqual({ commit: false, legacy: false });
  });
  it('no devuelve RNG privado, pujas rivales, convocatorias privadas ni avisos de otro club', async () => {
    await mutate((s) => {
      s.draft.active = false;
    });
    const state = await store.getState(users[0].id),
      p = state.state.players.find((p) => state.state.marketPlayers.includes(p.id))!;
    await command(0, { type: 'bid', playerId: p.id, amount: p.value, salaryBps: 200 });
    const other = await store.getState(users[1].id);
    expect(other.state.privateRng).toBeUndefined();
    expect(other.state.bids).toHaveLength(0);
    expect(other.state.clubs.find((c) => c.userId === users[0].id)?.selection.starters).toEqual([]);
    expect((await store.getState(users[2].id)).state.id).toBe(foreign);
  });
});

describe('PostgreSQL real: atomicidad y reintentos concurrentes', () => {
  it('dos inicios de la misma obra cobran una vez y no pierden actualizaciones', async () => {
    const before = await store.getState(users[0].id),
      money = before.state.clubs[0].resources.money;
    const results = await Promise.allSettled([
      command(0, { type: 'build', target: 'hq' }),
      command(0, { type: 'build', target: 'hq' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const after = await store.getState(users[0].id);
    expect(after.state.jobs).toHaveLength(1);
    expect(after.state.clubs[0].resources.money).toBe(money - euro(300000));
  });
  it('doce reintentos con una clave generan un solo cargo y un solo recibo; cambiar payload se rechaza', async () => {
    const state = await store.getState(users[0].id),
      a = state.daily[0],
      key = randomUUID(),
      money = state.state.clubs[0].resources.money;
    await Promise.all(
      Array.from({ length: 12 }, () => command(0, { type: 'dailyStart', id: a.id }, key)),
    );
    const after = await store.getState(users[0].id);
    expect(after.state.clubs[0].resources.money).toBe(money - a.cost);
    expect(
      (await db.query('select count(*)::int as n from monigones_private.receipts')).rows[0].n,
    ).toBe(1);
    await expect(command(0, { type: 'dailyStart', id: state.daily[1].id }, key)).rejects.toThrow(
      /idempotencia/,
    );
  });
  it('cobro concurrente de actividad: una recompensa, un historial y un día contabilizado', async () => {
    const state = await store.getState(users[0].id),
      a = state.daily[0];
    await command(0, { type: 'dailyStart', id: a.id });
    await mutate((s) => {
      s.clubs[0].activity!.endsAt = s.now - 1;
    });
    const ready = await store.getState(users[0].id),
      run = ready.state.clubs[0].activity!;
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => command(0, { type: 'dailyClaim', id: run.id })),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const after = (await store.getState(users[0].id)).state.clubs[0];
    expect(after.activityHistory).toHaveLength(1);
    expect(after.activityDays?.[run.offerDay].completed).toBe(1);
  });
  it('pujas simultáneas no sobrepasan el saldo reservado; pujas inválidas no crean recibos', async () => {
    await mutate((s) => {
      s.draft.active = false;
      s.marketPlayers = s.players
        .slice()
        .sort((a, b) => a.value - b.value)
        .slice(0, 2)
        .map((p) => p.id);
      s.clubs[0].resources.money = euro(2000000);
    });
    const state = await store.getState(users[0].id);
    const results = await Promise.allSettled(
      state.state.marketPlayers.map((id) =>
        command(0, { type: 'bid', playerId: id, amount: euro(1500000), salaryBps: 200 }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const after = await store.getState(users[0].id);
    expect(after.state.bids).toHaveLength(1);
    expect(after.available).toBe(euro(500000));
    await expect(
      command(0, {
        type: 'bid',
        playerId: state.state.marketPlayers[0],
        amount: -1,
        salaryBps: 200,
      }),
    ).rejects.toThrow();
  });
  it('draft autoritativo: solo admin presenta; dos pujas iguales tienen un ganador y la adjudicación no se duplica', async () => {
    await expect(
      command(1, { type: 'nextAuction', admin: true, userId: users[0].id }),
    ).rejects.toThrow(/administrador/);
    const state = await command(0, { type: 'nextAuction' }),
      auction = state.state.auctions.at(-1)!,
      p = state.state.players.find((p) => p.id === auction.playerId)!;
    const results = await Promise.allSettled(
      [0, 1].map((i) => command(i, { type: 'auctionBid', id: auction.id, amount: p.value })),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    await mutate((s) => {
      s.auctions.at(-1)!.endsAt = s.now - 1;
    });
    await Promise.all([store.tick(), store.tick()]);
    const after = await store.getState(users[0].id);
    expect(after.state.contracts.filter((c) => c.playerId === p.id)).toHaveLength(1);
    const money = after.state.clubs.map((c) => c.resources.money);
    await store.tick();
    expect((await store.getState(users[0].id)).state.clubs.map((c) => c.resources.money)).toEqual(
      money,
    );
  });
  it('una transacción fallida no cambia estado, recibos ni señal Realtime', async () => {
    const before = (
      await db.query('select revision from public.game_revisions where league_id=$1', [league])
    ).rows[0].revision;
    await expect(command(0, { type: 'research', target: 'inventado' })).rejects.toThrow();
    expect(
      (await db.query('select revision from public.game_revisions where league_id=$1', [league]))
        .rows[0].revision,
    ).toBe(before);
    expect(
      (await db.query('select count(*)::int as n from monigones_private.receipts')).rows[0].n,
    ).toBe(0);
  });
  it('dos usuarios que intentan unirse a dos ligas a la vez conservan una única membresía', async () => {
    const fourth = { id: randomUUID(), email: 'fourth@example.test', name: 'Cuarto QA' };
    await db.query('insert into auth.users values($1,$2)', [fourth.id, fourth.email]);
    await store.profile(fourth);
    const a = (await store.getState(users[0].id)).state.invite,
      b = (await store.getState(users[2].id)).state.invite;
    const results = await Promise.allSettled(
      [a, b].map((invite) => store.joinLeague(fourth, { ...input, invite })),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      (await db.query('select * from public.memberships where user_id=$1', [fourth.id])).rows,
    ).toHaveLength(1);
  });
});

describe('procesos sin navegador y recuperación', () => {
  it('dos workers no duplican trabajos; una concesión abandonada expira y se recupera', async () => {
    await command(0, { type: 'build', target: 'hq' });
    await mutate((s) => {
      s.jobs[0].endsAt = s.now - 1;
    });
    const first = await rpc.call<any[]>('online_claim_due', { p_limit: 10 });
    expect(first.some((s) => s.state.id === league)).toBe(true);
    expect(
      (await rpc.call<any[]>('online_claim_due', { p_limit: 10 })).some(
        (s) => s.state.id === league,
      ),
    ).toBe(false);
    await db.query(
      "update monigones_private.games set lease_until=now()-interval '1 second' where league_id=$1",
      [league],
    );
    await Promise.all([store.tick(), store.tick()]);
    const after = await store.getState(users[0].id);
    expect(after.state.jobs).toHaveLength(0);
    expect(after.state.clubs[0].buildings.hq).toBe(2);
  });
  it('un fallo de worker se registra y el siguiente intento usa el último checkpoint', async () => {
    await mutate(() => {});
    const claimed = (await rpc.call<any[]>('online_claim_due', { p_limit: 10 })).find(
      (s) => s.state.id === league,
    );
    await rpc.call('online_tick_failed', {
      p_league: league,
      p_lease: claimed.lease,
      p_error: 'Fallo transitorio QA',
    });
    const row = (
      await db.query(
        'select last_error,lease_until from monigones_private.games where league_id=$1',
        [league],
      )
    ).rows[0];
    expect(row.last_error).toBe('Fallo transitorio QA');
    expect(row.lease_until).toBeNull();
    await db.query(
      "update monigones_private.games set next_due_at=now()-interval '1 second' where league_id=$1",
      [league],
    );
    await store.tick();
    expect(
      (
        await db.query('select last_error from monigones_private.games where league_id=$1', [
          league,
        ])
      ).rows[0].last_error,
    ).toBeNull();
  });
  it('jornada y salarios se liquidan una vez aunque coincidan lectura y workers', async () => {
    await mutate((s) => {
      const demo = createGame(s.now);
      const original = demo.clubs[0];
      s.draft.active = false;
      s.contracts = demo.contracts
        .filter((c) => c.clubId === original.id)
        .map((c) => ({ ...c, clubId: s.clubs[0].id }));
      s.clubs[0].selection = structuredClone(original.selection);
      s.rounds = demo.rounds;
      s.currentRound = 1;
      const r = s.rounds[0];
      r.locksAt = s.now - 600000;
      r.startsAt = s.now - 500000;
      for (const m of r.matches) {
        m.startsAt = s.now - 500000;
        m.endsAt = s.now - 1000;
      }
    });
    await Promise.all([store.tick(), store.tick(), store.getState(users[0].id)]);
    const after = await store.getState(users[0].id),
      money = after.state.clubs[0].resources.money;
    expect(
      Object.keys(after.state.rounds[0].reports).filter((id) => id === after.clubId),
    ).toHaveLength(1);
    await store.tick();
    expect((await store.getState(users[0].id)).state.clubs[0].resources.money).toBe(money);
  });
});

describe('API online y transporte HTTP sobre PostgreSQL real', () => {
  it('rechaza sesiones y cron falsos; acepta únicamente el JWT verificado, no un userId del cuerpo', async () => {
    const config = {
      url: 'http://127.0.0.1:1',
      secret: 'server-only-test-key',
      cronSecret: 'q'.repeat(40),
      origin: 'https://monigones.vercel.app',
    };
    const handle = onlineHandler(store, config, async (token) => {
      if (token !== 'valid-qa') throw Error('Token falso');
      return users[1];
    });
    expect((await handle(new Request(config.origin + '/api/state'))).status).toBe(401);
    expect(
      (
        await handle(
          new Request(config.origin + '/api/state', {
            headers: { Authorization: 'Bearer forged' },
          }),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await handle(
          new Request(config.origin + '/api/cron', {
            method: 'POST',
            headers: { Authorization: 'Bearer valid-qa' },
          }),
        )
      ).status,
    ).toBe(401);
    const forged = await handle(
      new Request(config.origin + '/api/command', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-qa', 'Idempotency-Key': randomUUID() },
        body: JSON.stringify({ type: 'nextAuction', admin: true, userId: users[0].id }),
      }),
    );
    expect(forged.status).toBe(400);
    const valid = await handle(
      new Request(config.origin + '/api/state', { headers: { Authorization: 'Bearer valid-qa' } }),
    );
    expect((await valid.json()).clubId).toBe((await store.getState(users[1].id)).clubId);
  });
  it('mantiene la versión en lecturas sin cambios y devuelve 304 para reducir transferencia', async () => {
    const config = {
      url: 'http://127.0.0.1:1',
      secret: 'private',
      cronSecret: 'q'.repeat(40),
      origin: 'https://monigones.vercel.app',
    };
    const handle = onlineHandler(store, config, async () => users[0]);
    const first = await handle(
      new Request(config.origin + '/api/state', { headers: { Authorization: 'Bearer qa' } }),
    );
    const etag = first.headers.get('etag')!;
    const second = await handle(
      new Request(config.origin + '/api/state', {
        headers: { Authorization: 'Bearer qa', 'If-None-Match': etag },
      }),
    );
    expect(second.status).toBe(304);
  });
  it('la implementación HTTP de RPC usa el rol privado y preserva JSON, permisos y errores SQL', async () => {
    // An explicit wire fixture, not a mock database or a claim of a full Supabase stack.
    const bridge = createServer(async (req, res) => {
      try {
        if (req.headers.apikey !== 'sb_secret_qa') {
          res.writeHead(401);
          res.end('{}');
          return;
        }
        let body = '';
        for await (const chunk of req) body += chunk;
        const data = await rpc.call(req.url!.split('/').at(-1)!, JSON.parse(body));
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: String(e) }));
      }
    });
    await new Promise<void>((resolve) => bridge.listen(0, '127.0.0.1', resolve));
    try {
      const address = bridge.address() as { port: number };
      const httpStore = new PostgresStore(
        new SupabaseRpc(`http://127.0.0.1:${address.port}`, 'sb_secret_qa'),
      );
      const a = await httpStore.getState(users[0].id);
      expect(a.state.id).toBe(league);
      await httpStore.dispatch(
        users[0].id,
        { type: 'chat', text: 'Mensaje PostgreSQL HTTP' },
        randomUUID(),
      );
      expect(
        (await store.getState(users[1].id)).state.chat.some(
          (m) => m.text === 'Mensaje PostgreSQL HTTP',
        ),
      ).toBe(true);
    } finally {
      await new Promise<void>((resolve) => bridge.close(() => resolve()));
    }
  });
});

it('frontend online de producción: tres sesiones, Auth SDK, Realtime emulado y PWA offline sobre PostgreSQL', async () => {
  const { chromium, expect: browserExpect } = await import('@playwright/test');
  const { execFileSync } = await import('node:child_process');
  const { mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join, extname, resolve } = await import('node:path');
  const { createHmac, timingSafeEqual } = await import('node:crypto');
  const web = mkdtempSync(join(tmpdir(), 'monigones-online-web-'));
  const fixtureSecret = 'only-local-auth-fixture-not-a-production-key';
  const issued = new Map<string, OnlineUser>();
  const subscriptions = new Set<{ socket: any; topic: string; join: any; league: string }>();
  const userBody = (user: OnlineUser) => ({
    id: user.id,
    email: user.email,
    aud: 'authenticated',
    role: 'authenticated',
    created_at: new Date().toISOString(),
    app_metadata: { provider: 'email' },
    user_metadata: { name: user.name },
    identities: [],
  });
  const sign = (user: OnlineUser) => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
      payload = Buffer.from(
        JSON.stringify({
          sub: user.id,
          email: user.email,
          role: 'authenticated',
          aud: 'authenticated',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString('base64url');
    const value = header + '.' + payload;
    return value + '.' + createHmac('sha256', fixtureSecret).update(value).digest('base64url');
  };
  const verify = (token: string) => {
    try {
      const [h, p, s] = token.split('.'),
        expected = createHmac('sha256', fixtureSecret)
          .update(h + '.' + p)
          .digest();
      const actual = Buffer.from(s, 'base64url');
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return;
      const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
      if (claims.exp < Date.now() / 1000) return;
      return users.find((u) => u.id === claims.sub);
    } catch {
      return;
    }
  };
  let origin = '';
  const bridge = createServer(async (req, res) => {
    try {
      const path = new URL(req.url!, 'http://localhost').pathname;
      const send = (data: unknown, status = 200) => {
        res.writeHead(status, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
        });
        res.end(JSON.stringify(data));
      };
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        });
        res.end();
        return;
      }
      if (path.startsWith('/auth/v1/')) {
        if (path === '/auth/v1/token') {
          let text = '';
          for await (const c of req) text += c;
          const body = JSON.parse(text);
          const user = body.refresh_token
            ? issued.get(body.refresh_token)
            : users.find((u) => u.email === body.email && body.password === 'Monigones-QA-2026');
          if (!user) {
            send({ msg: 'Invalid credentials' }, 400);
            return;
          }
          const refresh = randomUUID();
          issued.set(refresh, user);
          send({
            access_token: sign(user),
            refresh_token: refresh,
            token_type: 'bearer',
            expires_in: 3600,
            user: userBody(user),
          });
          return;
        }
        const user = verify(req.headers.authorization?.replace('Bearer ', '') || '');
        if (!user) {
          send({ msg: 'Invalid token' }, 401);
          return;
        }
        send(path === '/auth/v1/user' ? userBody(user) : {});
        return;
      }
      if (path.startsWith('/rest/v1/rpc/')) {
        if (req.headers.apikey !== 'sb_secret_local_qa') {
          send({ message: 'Forbidden' }, 403);
          return;
        }
        let text = '';
        for await (const c of req) text += c;
        const args = JSON.parse(text),
          name = path.split('/').at(-1)!;
        const result = await rpc.call(name, args);
        send(result);
        if (name === 'online_commit' && result === 'committed')
          for (const sub of subscriptions)
            if (sub.league === args.p_league) {
              sub.socket.send(
                JSON.stringify([
                  sub.join,
                  null,
                  sub.topic,
                  'postgres_changes',
                  {
                    ids: [1],
                    data: {
                      schema: 'public',
                      table: 'game_revisions',
                      type: 'UPDATE',
                      commit_timestamp: new Date().toISOString(),
                      columns: [
                        { name: 'league_id', type: 'uuid' },
                        { name: 'revision', type: 'int8' },
                      ],
                      record: { league_id: args.p_league, revision: args.p_state.version },
                      old_record: {},
                      errors: [],
                    },
                  },
                ]),
              );
            }
        return;
      }
      if (path.startsWith('/api/')) {
        let body = '';
        for await (const c of req) body += c;
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers))
          if (v) headers.set(k, Array.isArray(v) ? v.join(',') : v);
        const reply = await backend(
          new Request(origin + req.url, {
            method: req.method,
            headers,
            body: ['GET', 'HEAD'].includes(req.method!) ? undefined : body,
          }),
        );
        await writeOnlineResponse(reply, res, req.headers['accept-encoding']);
        return;
      }
      const file = resolve(web, '.' + decodeURIComponent(path === '/' ? '/index.html' : path));
      if (!file.startsWith(web + '/')) {
        res.writeHead(404);
        res.end();
        return;
      }
      const found = existsSync(file) ? file : extname(file) ? undefined : join(web, 'index.html');
      if (!found) {
        res.writeHead(404);
        res.end();
        return;
      }
      const mime: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.json': 'application/json',
        '.webmanifest': 'application/manifest+json',
        '.wav': 'audio/wav',
      };
      res.setHeader('Content-Type', mime[extname(found)] || 'application/octet-stream');
      res.end(readFileSync(found));
    } catch (e) {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: String(e), error: String(e) }));
    }
  });
  await new Promise<void>((r) => bridge.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${(bridge.address() as { port: number }).port}`;
  const backend = onlineHandler(new PostgresStore(new SupabaseRpc(origin, 'sb_secret_local_qa')), {
    url: origin,
    secret: 'sb_secret_local_qa',
    cronSecret: 'q'.repeat(40),
    origin,
  });
  execFileSync(
    process.execPath,
    ['node_modules/vite/bin/vite.js', 'build', '--outDir', web, '--emptyOutDir'],
    {
      stdio: 'pipe',
      env: {
        ...process.env,
        VITE_BACKEND: 'supabase',
        VITE_SUPABASE_URL: origin,
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_local_qa',
      },
    },
  );
  const browser = await chromium.launch();
  const contexts = [];
  const errors: string[] = [];
  try {
    const pages = [];
    const requested: string[] = [];
    expect(
      (
        await fetch(origin + '/api/state', {
          headers: { Authorization: 'Bearer forged.payload.signature' },
        })
      ).status,
    ).toBe(401);
    expect((await fetch(origin + '/api/health')).ok).toBe(true);
    for (let i = 0; i < 3; i++) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      contexts.push(context);
      context.on('request', (request) => requested.push(request.url()));
      await context.routeWebSocket('**/realtime/v1/websocket*', (socket) => {
        const active = new Set<any>();
        socket.onMessage(async (message) => {
          const frame = JSON.parse(message.toString());
          const [j, ref, topic, event, payload] = frame;
          if (event === 'phx_join') {
            const user = verify(payload.access_token || '');
            const changes = payload.config.postgres_changes;
            const target = changes[0]?.filter?.replace('league_id=eq.', '');
            const authorized =
              user &&
              (
                await db.query(
                  'select 1 from public.memberships where user_id=$1 and league_id=$2',
                  [user.id, target],
                )
              ).rowCount;
            if (!authorized) {
              socket.send(
                JSON.stringify([
                  j,
                  ref,
                  topic,
                  'phx_reply',
                  { status: 'error', response: { message: 'RLS' } },
                ]),
              );
              return;
            }
            const sub = { socket, topic, join: j, league: target };
            subscriptions.add(sub);
            active.add(sub);
            socket.send(
              JSON.stringify([
                j,
                ref,
                topic,
                'phx_reply',
                {
                  status: 'ok',
                  response: { postgres_changes: changes.map((c: any) => ({ ...c, id: 1 })) },
                },
              ]),
            );
          } else if (event === 'heartbeat' || event === 'phx_leave')
            socket.send(
              JSON.stringify([j, ref, topic, 'phx_reply', { status: 'ok', response: {} }]),
            );
        });
        socket.onClose(() => {
          for (const s of active) subscriptions.delete(s);
        });
      });
      const page = await context.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      pages.push(page);
      await page.goto(origin);
      await page.getByLabel('Correo electrónico').fill(users[i].email);
      await page.getByLabel('Contraseña', { exact: true }).fill('Monigones-QA-2026');
      await page.getByRole('button', { name: /Volver a mi club/ }).click();
      await browserExpect(page.locator('.city-map')).toHaveAttribute('data-ready', 'true');
      await page.goto(origin + '/chat');
      await browserExpect(page.locator('.chat-compose textarea')).toBeVisible();
    }
    await browserExpect.poll(() => subscriptions.size).toBeGreaterThanOrEqual(3);
    const text = 'Sin Mac: mensaje online con PostgreSQL y Realtime';
    await pages[0].getByRole('textbox', { name: 'Mensaje a la liga' }).fill(text);
    await pages[0].getByRole('button', { name: 'Enviar mensaje' }).click();
    await browserExpect(pages[1].getByText(text, { exact: true })).toBeVisible({ timeout: 10000 });
    await browserExpect(pages[2].getByText(text, { exact: true })).toHaveCount(0);
    await pages[1].screenshot({
      path: 'docs/validation/online/online-chat-390x844.png',
      scale: 'css',
    });
    await pages[1].evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await pages[1].reload();
    await pages[1].waitForFunction(() => !!navigator.serviceWorker.controller);
    await contexts[1].setOffline(true);
    await pages[1].reload();
    await browserExpect(pages[1].getByText(/Sin conexión · Consultando/)).toBeVisible();
    await browserExpect(pages[1].getByText(text, { exact: true })).toBeVisible();
    await contexts[1].setOffline(false);
    expect(errors).toEqual([]);
    expect(
      requested.some(
        (url) =>
          url.includes('/api/events') ||
          url.includes('/api/football-assets') ||
          url.includes(':3001'),
      ),
    ).toBe(false);
    await pages[0].goto(origin + '/settings');
    await pages[0].getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
    await browserExpect(pages[0].getByLabel('Correo electrónico')).toBeVisible();
    expect(
      await pages[0].evaluate(() =>
        Object.keys(localStorage).some((key) => key.startsWith('monigones-snapshot:')),
      ),
    ).toBe(false);
    await browserExpect(pages[1].getByRole('textbox', { name: 'Mensaje a la liga' })).toBeVisible();
    writeFileSync(
      'docs/validation/online/browser-postgres.json',
      JSON.stringify(
        {
          database: 'Disposable native PostgreSQL',
          users: 3,
          leagues: 2,
          auth: 'Supabase SDK with local signed-JWT Auth wire fixture',
          realtime:
            'Supabase SDK with protocol-emulated websocket; PostgreSQL RLS/publication tested separately',
          pwaOffline: true,
          javascriptErrors: errors,
          sqlite: false,
        },
        null,
        2,
      ),
    );
  } finally {
    for (const c of contexts) await c.close();
    await browser.close();
    await new Promise<void>((r) => bridge.close(() => r()));
    rmSync(web, { recursive: true, force: true });
  }
}, 90000);

it('respuesta streaming: conserva más de 4,5 MB con y sin compresión y sin truncar JSON', async () => {
  const payload = { history: '0123456789'.repeat(650000), ok: true };
  const server = createServer(async (req, res) => {
    await writeOnlineResponse(Response.json(payload), res, req.headers['accept-encoding']);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address() as { port: number };
    for (const encoding of ['gzip', 'identity']) {
      const response = await fetch(`http://127.0.0.1:${address.port}`, {
        headers: { 'Accept-Encoding': encoding },
      });
      expect(response.headers.get('content-length')).toBeNull();
      expect(response.headers.get('content-encoding')).toBe(encoding === 'gzip' ? 'gzip' : null);
      const data = await response.json();
      expect(data).toEqual(payload);
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

it('esquema histórico: RLS de saldos/pujas, triggers entre ligas y ejecución real de la RPC retirada del cliente', async () => {
  const seasons = [randomUUID(), randomUUID()],
    clubs = [
      (await store.getState(users[0].id)).clubId,
      (await store.getState(users[2].id)).clubId,
    ];
  for (let i = 0; i < 2; i++) {
    await db.query(
      "insert into public.seasons(id,league_id,number,starts_at,ends_at,status) values($1,$2,1,now()-interval '1 day',now()+interval '30 days','active')",
      [seasons[i], i === 0 ? league : foreign],
    );
    await db.query(
      "insert into public.clubs(id,season_id,user_id,name,color,favorite_club_id) values($1,$2,$3,'Club normalizado','#446688','betis')",
      [clubs[i], seasons[i], users[i === 0 ? 0 : 2].id],
    );
    await db.query(
      "insert into public.resources(club_id,kind,balance) values($1,'money',1000000000000)",
      [clubs[i]],
    );
  }
  expect(
    await asRole(
      'authenticated',
      users[0].id,
      "select club_id from public.resources where kind='money'",
    ),
  ).toEqual([{ club_id: clubs[0] }]);
  await expect(
    db.query(
      "insert into public.news(league_id,club_id,category,title,subtitle) values($1,$2,'QA','Cruce','Prohibido')",
      [league, clubs[1]],
    ),
  ).rejects.toThrow(/Inconsistent detail reference/);
  const market = randomUUID();
  await db.query(
    "insert into public.markets(id,season_id,opens_at,closes_at) values($1,$2,now()-interval '1 hour',now()+interval '2 hours')",
    [market, seasons[0]],
  );
  await db.query("insert into public.market_entries values($1,'madrid-13')", [market]);
  await expect(
    db.query(
      "insert into public.market_bids(market_id,player_id,club_id,amount_cents,salary_bps) values($1,'madrid-13',$2,100000000000,200)",
      [market, clubs[1]],
    ),
  ).rejects.toThrow(/Cross-season reference/);
  const value = (
    await db.query(
      "select value_cents from public.player_market_values where player_id='madrid-13' and at<=now() order by at desc limit 1",
    )
  ).rows[0].value_cents;
  const client = await db.connect();
  try {
    await client.query('begin');
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [users[0].id]);
    const key = randomUUID(),
      args = [market, 'madrid-13', value, 200, key];
    const first = await client.query('select public.place_market_bid($1,$2,$3,$4,$5) as id', args);
    const second = await client.query('select public.place_market_bid($1,$2,$3,$4,$5) as id', args);
    expect(first.rows[0]).toEqual(second.rows[0]);
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  expect(
    await asRole('authenticated', users[1].id, 'select id from public.market_bids'),
  ).toHaveLength(0);
  expect(
    await asRole('authenticated', users[0].id, 'select id from public.market_bids'),
  ).toHaveLength(1);
});
