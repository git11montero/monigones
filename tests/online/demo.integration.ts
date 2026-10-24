import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DemoService } from '../../server/demo/service';
import {
  configSchema,
  generatedDemo,
  snapshotOf,
  prepareDemo,
  type DemoConfig,
} from '../../server/demo/state';
import { PostgresStore, type RpcTransport, type Snapshot } from '../../server/online/store';
import { onlineHandler } from '../../server/online/handler';
import { SupabaseRpc } from '../../server/online/transport';
import { execute, reconcile, syncAttention } from '../../shared/engine';
import { RULES, DAY } from '../../shared/config';
import { nextMarket } from '../../shared/math';

const url = process.env.MONIGONES_TEST_DATABASE_URL || '';
if (
  process.env.MONIGONES_ISOLATED_TEST !== 'true' ||
  !/^postgresql:\/\/postgres@127\.0\.0\.1:\d+\/postgres$/.test(url)
)
  throw Error('Solo se permiten clústeres nuevos creados por npm run test:postgres.');
const db = new Pool({ connectionString: url, max: 12 });
const rpc: RpcTransport = {
  async call<T>(name: string, args: Record<string, unknown> = {}) {
    if (!/^online_[a-z_]+$/.test(name) || Object.keys(args).some((k) => !/^p_[a-z_]+$/.test(k)))
      throw Error('RPC inválida.');
    const client = await db.connect();
    try {
      await client.query('begin');
      await client.query('set local role service_role');
      const keys = Object.keys(args);
      const result = await client.query(
        `select public.${name}(${keys.map((k, i) => `${k}=>$${i + 1}`).join(',')}) as value`,
        Object.values(args),
      );
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
const auth = async (id: string) => {
  if (!(await db.query('select id from auth.users where id=$1', [id])).rowCount)
    throw Error('DEMO_AUTH_USER_MISSING');
};
const service = new DemoService(rpc, auth),
  store = new PostgresStore(rpc);
let users: string[];
const sourceAt = Date.parse('2026-10-23T10:00:00Z');
function configuration(mode: DemoConfig['mode'] = 'advanced', all = true): DemoConfig {
  return configSchema.parse({
    environment: 'local',
    projectRef: 'local',
    leagueId: randomUUID(),
    adminUserId: users[0],
    mode,
    seed: 'online-demo-integration-v1',
    sourceAt: new Date(sourceAt).toISOString(),
    startAt: 'now',
    users: Object.fromEntries(users.slice(0, all ? 6 : 1).map((id, i) => [`demo${i + 1}`, id])),
  });
}
function source(mode: DemoConfig['mode'] = 'advanced') {
  return snapshotOf(
    generatedDemo(mode, sourceAt, 'online-demo-integration-v1'),
    'generated-local-demo',
  );
}
const load = (id: string) => rpc.call<Snapshot>('online_load_league', { p_league: id });
const counts = async () =>
  (
    await db.query(`select
 (select count(*) from public.leagues)::int leagues,
 (select count(*) from public.memberships)::int members,
 (select count(*) from monigones_private.games)::int games,
 (select count(*) from monigones_private.demo_slots)::int slots,
 (select count(*) from monigones_private.demo_runs)::int runs,
 (select count(*) from public.game_revisions)::int revisions,
 (select count(*) from public.profiles)::int profiles`)
  ).rows[0];
beforeEach(async () => {
  await db.query('truncate auth.users cascade');
  users = Array.from({ length: 8 }, () => randomUUID());
  for (const [i, id] of users.entries())
    await db.query('insert into auth.users values($1,$2)', [id, `demo${i}@example.test`]);
});
afterAll(async () => {
  await db.end();
});

describe('Importador de demostración: PostgreSQL real y API online', () => {
  it('el login con perfil 204 lee la membresía de Presidente 1 y la liga importada por HTTP real', async () => {
    const config = configuration('advanced', false);
    await service.apply(config, source());
    const bridge = createServer(async (req, res) => {
      try {
        if (req.url === '/auth/v1/user') {
          if (req.headers.authorization !== 'Bearer login-fixture') {
            res.writeHead(401);
            res.end('{}');
            return;
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              id: users[0],
              email: 'fixture@example.test',
              aud: 'authenticated',
              role: 'authenticated',
              user_metadata: { name: 'Cuenta real fixture' },
            }),
          );
          return;
        }
        let raw = '';
        for await (const chunk of req) raw += chunk;
        const name = req.url!.split('/').at(-1)!;
        const result = await rpc.call(name, JSON.parse(raw));
        if (name === 'online_profile') {
          res.writeHead(204);
          res.end();
        } else {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
        }
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"message":"fixture rejected"}');
      }
    });
    await new Promise<void>((resolve) => bridge.listen(0, '127.0.0.1', resolve));
    const address = bridge.address() as { port: number };
    const url = `http://127.0.0.1:${address.port}`;
    const handle = onlineHandler(new PostgresStore(new SupabaseRpc(url, 'sb_secret_fixture')), {
      url,
      secret: 'sb_secret_fixture',
      cronSecret: 'x'.repeat(40),
      origin: 'https://monigones.vercel.app',
    });
    const headers = { authorization: 'Bearer login-fixture' };
    try {
      for (const body of [undefined, '', '{}']) {
        const login = await handle(
          new Request('https://monigones.vercel.app/api/login', { method: 'POST', headers, body }),
        );
        expect(login.status).toBe(200);
        expect((await login.json()).user.id).toBe(users[0]);
      }
      const session = await handle(
        new Request('https://monigones.vercel.app/api/session', { headers }),
      );
      expect(session.status).toBe(200);
      expect((await session.json()).membership).toBe(true);
      const game = await handle(new Request('https://monigones.vercel.app/api/state', { headers }));
      expect(game.status).toBe(200);
      const view = await game.json();
      expect(view.state.id).toBe(config.leagueId);
      expect(view.state.players).toHaveLength(500);
      expect(view.state.clubs.find((c: any) => c.userId === users[0]).presidentName).toBe(
        'Presidente 1',
      );
      expect(view.state.privateRng).toBeUndefined();
      const bad = await handle(
        new Request('https://monigones.vercel.app/api/login', {
          method: 'POST',
          headers,
          body: '{',
        }),
      );
      expect(bad.status).toBe(400);
      expect((await bad.json()).code).toBe('INVALID_JSON');
    } finally {
      bridge.closeAllConnections();
      await new Promise<void>((resolve) => bridge.close(() => resolve()));
    }
  });
  it('la RPC rechaza relaciones alteradas y revierte perfiles creados antes del error', async () => {
    const c = configuration();
    const plan = prepareDemo(c, source(), Date.now());
    plan.slots[5].clubId = randomUUID();
    const before = await counts();
    await expect(rpc.call('online_demo_apply', { p_spec: plan })).rejects.toThrow(
      'DEMO_INVALID_CLUB_MAPPING',
    );
    expect(await counts()).toEqual(before);
  });
  it('dos asociaciones simultáneas no pueden apropiarse del mismo club', async () => {
    const c = configuration('advanced', false);
    await service.apply(c, source());
    const first = structuredClone(c),
      second = structuredClone(c);
    first.users.demo2 = users[1];
    second.users.demo2 = users[2];
    const result = await Promise.allSettled([
      service.apply(first, source(), true),
      service.apply(second, source(), true),
    ]);
    expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(result.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(await counts()).toMatchObject({ members: 2, runs: 2 });
    const status = await service.status(c.leagueId);
    expect([users[1], users[2]]).toContain(status.demo!.slots[1].userId);
  });
  it('previsualiza sin escribir ningún perfil, liga, membresía o revisión', async () => {
    const before = await counts();
    const result = await service.preview(configuration(), source());
    expect(result.problems).toEqual([]);
    expect(result.report.players).toBe(500);
    expect(await counts()).toEqual(before);
  });
  it('crea la demo inicial con seis clubes equivalentes, recursos iniciales y draft pendiente', async () => {
    const config = configuration('initial');
    expect(await service.apply(config, source('initial'))).toMatchObject({ status: 'created' });
    const s = (await load(config.leagueId)).state;
    expect(s.contracts).toHaveLength(0);
    expect(s.draft.active).toBe(true);
    expect(s.clubs.map((c) => c.name)).toEqual(
      generatedDemo('initial', sourceAt, config.seed).clubs.map((c) => c.name),
    );
    expect(
      s.clubs.every(
        (c) => c.resources.money === RULES.initialBudget && c.resources.development === 100,
      ),
    ).toBe(true);
    expect((await counts()).members).toBe(6);
  });
  it('crea la demo avanzada con los 500 jugadores y conserva valores, plantillas, mercado y clasificación', async () => {
    const c = configuration(),
      original = source();
    await service.apply(c, original);
    const s = (await load(c.leagueId)).state;
    expect(
      s.players.map(({ id, name, position, value }) => ({ id, name, position, value })),
    ).toEqual(
      original.state.players.map(({ id, name, position, value }) => ({
        id,
        name,
        position,
        value,
      })),
    );
    expect(s.contracts).toHaveLength(72);
    expect(s.draft.finished).toBe(true);
    expect(s.clubs.map((c) => c.resources)).toEqual(original.state.clubs.map((c) => c.resources));
    expect(s.clubs.map((c) => c.totalPoints)).toEqual(
      original.state.clubs.map((c) => c.totalPoints),
    );
    expect(s.marketPlayers).toEqual(original.state.marketPlayers);
    expect(s.chat.map((c) => c.text)).toEqual(original.state.chat.map((c) => c.text));
    expect(s.privateRng).not.toBe(original.state.privateRng);
    expect(s.invite).toMatch(/^[A-F0-9]{12}$/);
    expect(await service.verify(c, (await service.preview(c, original)).plan)).toMatchObject({
      status: 'verified',
    });
  });
  it('reserva cinco presidentes sin crear usuarios Auth y los muestra con sus nombres locales', async () => {
    const c = configuration('advanced', false);
    await service.apply(c, source());
    expect((await counts()).members).toBe(1);
    expect((await db.query('select count(*)::int n from auth.users')).rows[0].n).toBe(8);
    const view = await store.getState(users[0]);
    expect(view.state.clubs.map((c) => c.presidentName)).toEqual(
      Array.from({ length: 6 }, (_, i) => `Presidente ${i + 1}`),
    );
    expect(view.state.clubs.slice(1).every((c) => c.userId.startsWith('reserved-demo:'))).toBe(
      true,
    );
    await expect(store.getState('demo2')).rejects.toThrow();
  });
  it('incorpora usuarios registrados posteriormente sin sustituir recursos o plantillas y admite reintento', async () => {
    const c = configuration('advanced', false);
    await service.apply(c, source());
    const before = (await load(c.leagueId)).state;
    c.users.demo2 = users[1];
    expect(await service.apply(c, source(), true)).toMatchObject({ status: 'bound', assigned: 1 });
    expect(await service.apply(c, source(), true)).toMatchObject({ status: 'already_bound' });
    const after = (await load(c.leagueId)).state;
    expect(after.clubs[1].userId).toBe(users[1]);
    expect(after.contracts).toEqual(before.contracts);
    expect(after.clubs.map((c) => c.resources)).toEqual(before.clubs.map((c) => c.resources));
    expect((await store.getState(users[1])).clubId).toBe(after.clubs[1].id);
    expect((await counts()).runs).toBe(2);
  });
  it('detecta duplicados y dos ejecuciones simultáneas crean una sola liga', async () => {
    const c = configuration(),
      s = source();
    const results = await Promise.all([service.apply(c, s), service.apply(c, s)]);
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'created' }),
        expect.objectContaining({ status: 'already_initialized' }),
      ]),
    );
    expect(await counts()).toMatchObject({
      leagues: 1,
      games: 1,
      members: 6,
      slots: 6,
      runs: 1,
      revisions: 1,
    });
  });
  it('detiene la reposición cuando un jugador ha modificado la demo, incluso tras asociación posterior', async () => {
    const c = configuration('advanced', false);
    await service.apply(c, source());
    await store.dispatch(
      users[0],
      { type: 'chat', text: 'Cambio real después de importar.' },
      randomUUID(),
    );
    await expect(service.apply(c, source())).rejects.toThrow('DEMO_MODIFIED');
    c.users.demo2 = users[1];
    await service.apply(c, source(), true);
    expect((await service.status(c.leagueId)).demo?.modified).toBe(true);
    await expect(service.apply(c, source())).rejects.toThrow('DEMO_MODIFIED');
    expect((await load(c.leagueId)).state.chat.at(-1)?.text).toBe(
      'Cambio real después de importar.',
    );
  });
  it('rechaza UUID Auth inexistentes y miembros de otras ligas sin alterar datos', async () => {
    const c = configuration();
    c.users.demo2 = randomUUID();
    await expect(service.apply(c, source())).rejects.toThrow('AUTH_USER_MISSING');
    expect((await counts()).games).toBe(0);
    await store.profile({ id: users[1], name: 'Usuario existente', email: 'user@example.test' });
    await store.createLeague(
      { id: users[1], name: 'Usuario existente', email: 'user@example.test' },
      {
        name: 'Partida existente',
        clubName: 'Real independiente',
        favorite: 'betis',
        color: '#446688',
      },
    );
    c.users.demo2 = users[1];
    const before = await counts();
    await expect(service.apply(c, source())).rejects.toThrow('DEMO_USER_ALREADY_MEMBER');
    expect(await counts()).toEqual(before);
  });
  it('no sobrescribe una liga real ni modifica perfiles ya existentes', async () => {
    await store.profile({ id: users[6], name: 'Nombre personal', email: 'real@example.test' });
    const real = await store.createLeague(
      { id: users[6], name: 'Nombre personal', email: 'real@example.test' },
      { name: 'Liga personal', clubName: 'Club personal', favorite: 'betis', color: '#446688' },
    );
    const c = configuration();
    c.leagueId = real.state.id;
    await expect(service.apply(c, source())).rejects.toThrow('DEMO_TARGET_OCCUPIED');
    const second = configuration();
    await db.query('insert into public.profiles(id,display_name) values($1,$2)', [
      users[0],
      'Mi nombre real',
    ]);
    await service.apply(second, source());
    expect(
      (await db.query('select display_name from public.profiles where id=$1', [users[0]])).rows[0]
        .display_name,
    ).toBe('Mi nombre real');
  });
  it('revierte todos los cambios si falla el último paso y permite recuperar la misma operación', async () => {
    const c = configuration(),
      original = source();
    const before = await counts();
    await db.query(`create function monigones_private.fail_demo_run() returns trigger language plpgsql as $$begin raise exception 'injected demo failure';end$$;
      create trigger fail_demo_run before insert on monigones_private.demo_runs for each row execute function monigones_private.fail_demo_run()`);
    try {
      await expect(service.apply(c, original)).rejects.toThrow('injected demo failure');
      expect(await counts()).toEqual(before);
    } finally {
      await db.query(
        'drop trigger fail_demo_run on monigones_private.demo_runs;drop function monigones_private.fail_demo_run()',
      );
    }
    await expect(service.apply(c, original)).resolves.toMatchObject({ status: 'created' });
  });
  it('revierte una asociación parcial si otro usuario ya posee el siguiente club', async () => {
    const c = configuration('advanced', false);
    await service.apply(c, source());
    c.users.demo3 = users[2];
    await service.apply(c, source(), true);
    const before = await load(c.leagueId),
      n = await counts();
    await expect(
      rpc.call('online_demo_bind', {
        p_league: c.leagueId,
        p_admin: c.adminUserId,
        p_request_hash: (await service.status(c.leagueId)).demo!.requestHash,
        p_bindings: { demo2: users[1], demo3: users[3] },
      }),
    ).rejects.toThrow('DEMO_SLOT_ALREADY_OWNED');
    expect((await load(c.leagueId)).state).toEqual(before.state);
    expect(await counts()).toEqual(n);
  });
  it('lee desde la API online y acepta operaciones económicas autoritativas después del seed', async () => {
    const c = configuration();
    await service.apply(c, source());
    const api = onlineHandler(
      store,
      {
        url: 'http://127.0.0.1',
        secret: 'fixture',
        cronSecret: 'x'.repeat(40),
        origin: 'https://monigones.vercel.app',
      },
      async () => ({ id: users[0], name: 'Mi cuenta', email: 'fixture@example.test' }),
    );
    const response = await api(
      new Request('https://monigones.vercel.app/api/state', {
        headers: { authorization: 'Bearer fixture' },
      }),
    );
    expect(response.status).toBe(200);
    const view = await response.json();
    expect(view.state.players).toHaveLength(500);
    expect(view.state.privateRng).toBeUndefined();
    // The local advanced demo has 12 players in 12 places. Respect that rule:
    // sell through the authoritative API before making the next market bid.
    const owned = view.state.contracts.find((ct: any) => ct.clubId === view.clubId);
    const sale = await api(
      new Request('https://monigones.vercel.app/api/command', {
        method: 'POST',
        headers: { authorization: 'Bearer fixture', 'idempotency-key': randomUUID() },
        body: JSON.stringify({ type: 'sell', playerId: owned.playerId }),
      }),
    );
    const sold = await sale.json();
    expect(sale.status, JSON.stringify(sold)).toBe(200);
    expect(sold.state.clubs[0].resources.money).toBeGreaterThan(
      view.state.clubs[0].resources.money,
    );
    const p = view.state.players.find((p: any) => p.id === view.state.marketPlayers[0]);
    const bid = await api(
      new Request('https://monigones.vercel.app/api/command', {
        method: 'POST',
        headers: { authorization: 'Bearer fixture', 'idempotency-key': randomUUID() },
        body: JSON.stringify({ type: 'bid', playerId: p.id, amount: p.value, salaryBps: 200 }),
      }),
    );
    const bidResult = await bid.json();
    expect(bid.status, JSON.stringify(bidResult)).toBe(200);
    expect(bidResult.state.bids).toHaveLength(1);
  });
  it('importa progreso real, conserva investigaciones, instalaciones, trabajos y eventos; cron los termina una sola vez', async () => {
    const advanced = generatedDemo('advanced', sourceAt, 'online-demo-integration-v1');
    const c = advanced.clubs[0],
      actor = { userId: c.userId, clubId: c.id, admin: true };
    execute(advanced, actor, { type: 'build', target: 'hq' });
    reconcile(advanced, advanced.jobs[0].endsAt);
    syncAttention(advanced);
    execute(advanced, actor, { type: 'research', target: 'accounting' });
    reconcile(advanced, advanced.jobs[0].endsAt);
    execute(advanced, actor, { type: 'facility', target: 'locker' });
    reconcile(advanced, advanced.jobs[0].endsAt);
    reconcile(advanced, advanced.now + 3 * DAY);
    syncAttention(advanced);
    execute(advanced, actor, { type: 'research', target: 'salary' });
    const config = configuration(),
      original = snapshotOf(advanced, 'generated-local-demo');
    await service.apply(config, original);
    const imported = (await load(config.leagueId)).state;
    expect(imported.clubs[0].buildings).toEqual(c.buildings);
    expect(imported.clubs[0].research).toEqual(c.research);
    expect(imported.clubs[0].facilities).toEqual(c.facilities);
    expect(imported.clubs[0].research.accounting).toBe(1);
    expect(imported.clubs[0].facilities.locker).toBe(1);
    expect(imported.clubs[0].totalPoints).toBe(c.totalPoints);
    const settled = advanced.rounds.find((r) => r.settled)!;
    expect(settled).toBeDefined();
    expect(
      imported.rounds.find((r) => r.number === settled.number)!.reports[imported.clubs[0].id],
    ).toEqual(settled.reports[c.id]);
    expect(imported.jobs).toHaveLength(1);
    expect(imported.events.map((e) => e.title)).toEqual(advanced.events.map((e) => e.title));
    // Move the freshly imported job due, then use the real independent tick worker.
    imported.jobs[0].startedAt = imported.now - 1000;
    imported.jobs[0].endsAt = imported.now - 1;
    await db.query(
      "update monigones_private.games set state=$1,next_due_at=now()-interval '1 second' where league_id=$2",
      [imported, config.leagueId],
    );
    await store.tick();
    const done = (await load(config.leagueId)).state;
    await store.tick();
    expect((await load(config.leagueId)).state).toEqual(done);
    expect(done.clubs[0].research.accounting).toBe(1);
    expect(done.clubs[0].research.salary).toBe(1);
    expect(done.jobs).toHaveLength(0);
  });
  it('rebasa una instantánea antigua sin liquidaciones históricas y deja el próximo mercado a las seis de Madrid', async () => {
    const c = configuration();
    await service.apply(c, source());
    const s = (await load(c.leagueId)).state;
    expect(Math.abs(s.now - Date.now())).toBeLessThan(5000);
    expect(s.nextMarketAt).toBe(nextMarket(s.now));
    expect(s.ledger).toHaveLength(source().state.ledger.length);
    expect(s.seasonEndsAt - s.seasonStartedAt).toBe(266 * DAY);
    expect((await service.status(c.leagueId)).demo?.modified).toBe(false);
  });
  it('RLS y privilegios impiden leer o ejecutar el importador desde anon/authenticated y aíslan ligas', async () => {
    const c = configuration();
    await service.apply(c, source());
    await store.profile({ id: users[6], name: 'Externo', email: 'outside@example.test' });
    const other = await store.createLeague(
      { id: users[6], name: 'Externo', email: 'outside@example.test' },
      { name: 'Liga ajena', clubName: 'Club ajeno', favorite: 'betis', color: '#446688' },
    );
    for (const role of ['anon', 'authenticated']) {
      const conn = await db.connect();
      try {
        for (const query of [
          'select public.online_demo_inspect($1)',
          'select * from monigones_private.demo_seeds',
        ]) {
          await conn.query('begin');
          await conn.query(`set local role ${role}`);
          await expect(conn.query(query, query.includes('$1') ? [c.leagueId] : [])).rejects.toThrow(
            'permission denied',
          );
          await conn.query('rollback');
        }
        for (const name of ['online_demo_apply(jsonb)', 'online_demo_bind(uuid,uuid,text,jsonb)']) {
          expect(
            (
              await conn.query('select has_function_privilege($1,$2,$3) allowed', [
                role,
                `public.${name}`,
                'execute',
              ])
            ).rows[0].allowed,
          ).toBe(false);
        }
      } finally {
        conn.release();
      }
    }
    const conn = await db.connect();
    try {
      await conn.query('begin');
      await conn.query('set local role authenticated');
      await conn.query("select set_config('request.jwt.claim.sub',$1,true)", [users[6]]);
      expect((await conn.query('select league_id from public.game_revisions')).rows).toEqual([
        { league_id: other.state.id },
      ]);
      await conn.query('rollback');
    } finally {
      conn.release();
    }
  });
  it('publica revisión transaccional para Realtime y genera WAL de la tabla publicada', async () => {
    await db.query(
      "select * from pg_create_logical_replication_slot('demo_realtime_test','pgoutput')",
    );
    try {
      const c = configuration('advanced', false);
      await service.apply(c, source());
      c.users.demo2 = users[1];
      await service.apply(c, source(), true);
      const changes = await db.query(
        "select data from pg_logical_slot_get_binary_changes('demo_realtime_test',null,null,'proto_version','1','publication_names','supabase_realtime')",
      );
      expect(changes.rows.length).toBeGreaterThan(0);
      expect(changes.rows.some((r) => r.data.includes(Buffer.from('game_revisions')))).toBe(true);
      expect(
        (
          await db.query('select revision from public.game_revisions where league_id=$1', [
            c.leagueId,
          ])
        ).rows[0].revision,
      ).toBe('2');
      expect(
        (
          await db.query(
            "select tablename from pg_publication_tables where pubname='supabase_realtime'",
          )
        ).rows.map((r) => r.tablename),
      ).toEqual(['game_revisions']);
    } finally {
      await db.query("select pg_drop_replication_slot('demo_realtime_test')");
    }
  });
  it('rechaza atribución de administrador, cambios de semilla y un plan con reloj antiguo', async () => {
    const c = configuration();
    const preview = await service.preview(c, source());
    const stale = structuredClone(preview.plan);
    stale.state.now -= DAY;
    await expect(rpc.call('online_demo_apply', { p_spec: stale })).rejects.toThrow(
      'DEMO_INVALID_PLAN_OR_CLOCK',
    );
    await service.apply(c, source());
    await expect(
      rpc.call('online_demo_bind', {
        p_league: c.leagueId,
        p_admin: users[7],
        p_request_hash: preview.plan.requestHash,
        p_bindings: { demo1: users[0] },
      }),
    ).rejects.toThrow('DEMO_NOT_AUTHORIZED');
    c.seed = 'semilla-distinta';
    await expect(service.apply(c, source())).rejects.toThrow('DEMO_CONFIG_MISMATCH');
  });
  it('CLI real usa Auth oficial por HTTP, dry-run/status/verify no escriben y apply sin TTY se detiene', async () => {
    const work = mkdtempSync(join(tmpdir(), 'monigones-demo-cli-'));
    const config = configuration('advanced', false),
      file = join(work, 'config.json');
    writeFileSync(file, JSON.stringify(config));
    const calls: string[] = [];
    const fixture = createServer(async (req, res) => {
      try {
        calls.push(req.url!);
        let body = '';
        for await (const part of req) body += part;
        res.setHeader('Content-Type', 'application/json');
        if (req.url?.startsWith('/auth/v1/admin/users/')) {
          const id = req.url.split('/').at(-1)!;
          await auth(id);
          res.end(
            JSON.stringify({
              id,
              email: 'fixture@example.test',
              role: 'authenticated',
              user_metadata: {},
            }),
          );
        } else if (req.url?.startsWith('/rest/v1/rpc/'))
          res.end(JSON.stringify(await rpc.call(req.url.split('/').at(-1)!, JSON.parse(body))));
        else {
          res.statusCode = 404;
          res.end('{}');
        }
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ message: 'fixture rejected' }));
      }
    });
    await new Promise<void>((resolve) => fixture.listen(0, '127.0.0.1', resolve));
    const address = fixture.address() as { port: number };
    async function cli(action: string) {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', resolve('scripts/seed-online-demo.ts'), '--config', file, action],
        {
          env: {
            ...process.env,
            MONIGONES_DEMO_SUPABASE_URL: `http://127.0.0.1:${address.port}`,
            MONIGONES_DEMO_SECRET_KEY: 'sb_secret_fixture',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      let output = '';
      child.stdout.on('data', (b) => (output += b));
      child.stderr.on('data', (b) => (output += b));
      const code = await new Promise((resolve) => child.on('close', resolve));
      return { code, output };
    }
    try {
      const n = await counts();
      expect((await cli('--dry-run')).code).toBe(0);
      expect(await counts()).toEqual(n);
      const rejected = await cli('--apply');
      expect(rejected.code).toBe(1);
      expect(rejected.output).toContain('terminal interactiva');
      expect(await counts()).toEqual(n);
      expect(calls.some((c) => c.startsWith('/auth/v1/admin/users/'))).toBe(true);
      await service.apply(config, source());
      const before = await counts();
      expect((await cli('--status')).code).toBe(0);
      const verified = await cli('--verify');
      expect(verified.code, verified.output).toBe(0);
      expect(await counts()).toEqual(before);
      expect(verified.output).not.toContain('sb_secret_fixture');
    } finally {
      fixture.closeAllConnections();
      await new Promise<void>((resolve) => fixture.close(() => resolve()));
      rmSync(work, { recursive: true, force: true });
    }
  });
});
