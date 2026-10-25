import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import legacy from '../fixtures/legacy-demo-v05.json';
import fantasy from '../../data/demo-fantasy-v06.json';
import { fantasySnapshot } from '../../server/demo/fantasy';
import { DemoService } from '../../server/demo/service';
import { configSchema, snapshotOf } from '../../server/demo/state';
import { ReplacementService } from '../../server/demo/replacement';
import { PostgresStore, type RpcTransport, type Snapshot } from '../../server/online/store';
import { onlineHandler } from '../../server/online/handler';
import { nextMarket } from '../../shared/math';
import type { GameState } from '../../shared/types';

const url = process.env.MONIGONES_TEST_DATABASE_URL || '';
if (
  process.env.MONIGONES_ISOLATED_TEST !== 'true' ||
  !/^postgresql:\/\/postgres@127\.0\.0\.1:\d+\/postgres$/.test(url)
)
  throw Error('Se exige PostgreSQL local desechable.');
const db = new Pool({ connectionString: url, max: 12 });
const rpc: RpcTransport = {
  async call<T>(name: string, args: Record<string, unknown> = {}) {
    if (!/^online_[a-z_]+$/.test(name) || Object.keys(args).some((k) => !/^p_[a-z_]+$/.test(k)))
      throw Error('RPC inválida');
    const client = await db.connect();
    try {
      await client.query('begin');
      await client.query('set local role service_role');
      const result = await client.query(
        `select public.${name}(${Object.keys(args)
          .map((k, i) => `${k}=>$${i + 1}`)
          .join(',')}) value`,
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
const replacement = new ReplacementService(rpc),
  store = new PostgresStore(rpc),
  creator = new DemoService(rpc, async () => {});
let admin: string, other: string;
const config = () =>
  configSchema.parse({
    environment: 'local',
    projectRef: 'local',
    leagueId: randomUUID(),
    adminUserId: admin,
    mode: 'advanced',
    seed: 'replacement-pg-v1',
    sourceAt: '2026-10-23T10:00:00Z',
    startAt: 'now',
    users: { demo1: admin },
  });
const load = (league: string) => rpc.call<Snapshot>('online_load_league', { p_league: league });
async function setup() {
  const c = config();
  await creator.apply(c, snapshotOf(structuredClone(legacy) as GameState, 'generated-local-demo'));
  return c;
}
beforeEach(async () => {
  await db.query('truncate auth.users cascade');
  admin = randomUUID();
  other = randomUUID();
  await db.query('insert into auth.users values($1,$2),($3,$4)', [
    admin,
    'admin@example.test',
    other,
    'other@example.test',
  ]);
});
afterAll(() => db.end());
describe('Sustitución y recuperación de demo en PostgreSQL real', () => {
  it('permite asociar después una cuenta real a una reserva sin cambiar plantillas ni crear usuarios', async () => {
    const c = await setup(),
      preview = await replacement.preview(c),
      id = randomUUID();
    await replacement.apply(c, id, preview);
    const bind = { ...c, users: { ...c.users, demo2: other } };
    await creator.apply(bind, fantasySnapshot(fantasy, Date.parse(c.sourceAt!), c.seed), true);
    const state = (await load(c.leagueId)).state;
    expect(state.clubs[1].userId).toBe(other);
    expect(state.resetId).toBe(id);
    expect(state.contracts).toHaveLength(58);
    expect((await db.query('select count(*)::int n from auth.users')).rows[0].n).toBe(2);
    expect((await replacement.preview(c)).problems).toContain('REPLACE_OTHER_USERS');
  });
  it('sustituye el agregado, mantiene Auth y otra liga, publica revisión y restaura con respaldo de seguridad', async () => {
    const c = await setup();
    await store.profile({ id: other, email: 'other@example.test', name: 'Otro presidente' });
    const foreign = await store.createLeague(
      { id: other, email: 'other@example.test', name: 'Otro presidente' },
      { name: 'Liga ajena', clubName: 'Club ajeno', favorite: 'betis', color: '#113355' },
    );
    const untouched = await load(foreign.state.id),
      before = await load(c.leagueId);
    const auth = await db.query('select * from auth.users order by id'),
      profiles = await db.query('select * from public.profiles order by id');
    const preview = await replacement.preview(c);
    expect(preview.problems).toEqual([]);
    expect(preview.report.before.contracts).toBe(72);
    expect(preview.report.after.contracts).toBe(58);
    expect((await load(c.leagueId)).state).toEqual(before.state);
    const id = randomUUID();
    await replacement.apply(c, id, preview);
    expect(await replacement.apply(c, id, preview)).toMatchObject({ status: 'already_applied' });
    const current = await load(c.leagueId);
    expect(current.revision).toBe(before.revision + 1);
    expect(current.state.resetId).toBe(id);
    expect(current.state.clubs.map((x) => x.name)).toEqual([
      'Cholo ATM',
      'Porcinos FC',
      'Madurito',
      'Juancarli Team',
      'Joselinho',
      'Plaza reservada',
    ]);
    expect(current.state.clubs[0].userId).toBe(admin);
    expect(current.state.contracts).toHaveLength(58);
    expect(current.state.clubs.slice(1).every((x) => x.userId.startsWith('reserved-demo:'))).toBe(
      true,
    );
    expect(current.state.nextMarketAt).toBe(nextMarket(current.state.now));
    expect(current.state.ledger).toEqual(preview.plan.state.ledger);
    expect((await db.query('select * from auth.users order by id')).rows).toEqual(auth.rows);
    expect((await db.query('select * from public.profiles order by id')).rows).toEqual(
      profiles.rows,
    );
    expect(await load(foreign.state.id)).toEqual(
      expect.objectContaining({ state: untouched.state, revision: untouched.revision }),
    );
    expect(
      (
        await db.query('select revision from public.game_revisions where league_id=$1', [
          c.leagueId,
        ])
      ).rows[0].revision,
    ).toBe(String(current.revision));
    const backup = await replacement.backup(id);
    expect(backup.payload.game.state).toEqual(before.state);
    expect(backup.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(await replacement.verify(c)).toMatchObject({ status: 'verified' });
    const restore = await replacement.preview(c, id),
      restoreId = randomUUID();
    await replacement.apply(c, restoreId, restore, id);
    const recovered = await load(c.leagueId);
    expect(
      recovered.state.clubs.map(
        ({ id, name, userId, resources, buildings, research, facilities, selection }) => ({
          id,
          name,
          userId,
          resources,
          buildings,
          research,
          facilities,
          selection,
        }),
      ),
    ).toEqual(
      before.state.clubs.map(
        ({ id, name, userId, resources, buildings, research, facilities, selection }) => ({
          id,
          name,
          userId,
          resources,
          buildings,
          research,
          facilities,
          selection,
        }),
      ),
    );
    expect(
      recovered.state.contracts.map(({ endsAt, ...contract }) => ({
        ...contract,
        remaining: endsAt - recovered.state.now,
      })),
    ).toEqual(
      before.state.contracts.map(({ endsAt, ...contract }) => ({
        ...contract,
        remaining: endsAt - before.state.now,
      })),
    );
    expect(recovered.revision).toBe(current.revision + 1);
    expect(recovered.state.resetId).toBe(restoreId);
    expect(recovered.state.now).toBeGreaterThanOrEqual(before.state.now);
    expect((await replacement.backup(restoreId)).payload.game.state).toEqual(current.state);
    expect((await db.query('select * from auth.users order by id')).rows).toEqual(auth.rows);
    expect((await load(foreign.state.id)).state).toEqual(untouched.state);
  });
  it('bloquea otras membresías y ligas ajenas; rechaza restauraciones manipuladas y colisiones', async () => {
    const c = await setup(),
      p = await replacement.preview(c),
      id = randomUUID();
    await replacement.apply(c, id, p);
    await expect(replacement.inspect({ ...c, adminUserId: other })).rejects.toThrow(
      'REPLACE_NOT_AUTHORIZED_DEMO',
    );
    const altered = await replacement.preview(c, id);
    altered.plan.state.clubs[0].resources.money++;
    await expect(replacement.apply(c, randomUUID(), altered, id)).rejects.toThrow(
      'REPLACE_RESTORE_CONTENT_MISMATCH',
    );
    const conflicting = await replacement.preview(c, id);
    await expect(replacement.apply(c, id, conflicting, id)).rejects.toThrow(
      'REPLACE_OPERATION_COLLISION',
    );
    await store.profile({ id: other, email: 'other@example.test', name: 'Otro' });
    await db.query('insert into public.memberships(user_id,league_id,club_id) values($1,$2,$3)', [
      other,
      c.leagueId,
      p.plan.state.clubs[1].id,
    ]);
    const blocked = await replacement.preview(c);
    expect(blocked.problems).toContain('REPLACE_OTHER_USERS');
    expect(blocked.otherUsers.some((x) => x.userId === other)).toBe(true);
    await expect(replacement.apply(c, randomUUID(), blocked)).rejects.toThrow(
      'REPLACE_OTHER_USERS',
    );
    await expect(
      rpc.call('online_demo_replace', {
        p_league: c.leagueId,
        p_admin: admin,
        p_operation: randomUUID(),
        p_expected: blocked.inspection.fingerprint,
        p_spec: blocked.plan,
      }),
    ).rejects.toThrow('REPLACE_OTHER_USERS');
    expect((await load(c.leagueId)).state.resetId).toBe(id);
  });
  it('serializa dos reemplazos, rechaza CAS antiguo y recupera un fallo transaccional sin dejar respaldo parcial', async () => {
    const c = await setup(),
      p = await replacement.preview(c),
      old = await load(c.leagueId);
    const ids = [randomUUID(), randomUUID()];
    const results = await Promise.allSettled(ids.map((id) => replacement.apply(c, id, p)));
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(
      String((results.find((x) => x.status === 'rejected') as PromiseRejectedResult).reason),
    ).toContain('REPLACE_STALE_PREVIEW');
    expect(
      await rpc.call('online_commit', {
        p_league: c.leagueId,
        p_expected: old.revision,
        p_state: old.state,
        p_due: new Date(old.state.nextMarketAt).toISOString(),
      }),
    ).toBe('conflict');
    const next = await replacement.preview(c),
      operation = randomUUID();
    await db.query(
      "create function public.fail_replace_fixture() returns trigger language plpgsql as $$begin raise exception 'FAULT_FIXTURE';end$$;create trigger fail_replace_fixture before insert on monigones_private.demo_replacements for each row execute function public.fail_replace_fixture()",
    );
    try {
      await expect(replacement.apply(c, operation, next)).rejects.toThrow('FAULT_FIXTURE');
    } finally {
      await db.query(
        'drop trigger fail_replace_fixture on monigones_private.demo_replacements;drop function public.fail_replace_fixture()',
      );
    }
    expect((await load(c.leagueId)).state).toEqual(next.inspection.current.game.state);
    expect(
      (
        await db.query('select count(*)::int n from monigones_private.demo_backups where id=$1', [
          operation,
        ])
      ).rows[0].n,
    ).toBe(0);
    expect(await replacement.apply(c, operation, next)).toMatchObject({ status: 'applied' });
  });
  it('descarta el lease de cron anterior y los comandos del navegador antiguo; permite sesión y chat tras recargar', async () => {
    const c = await setup();
    await db.query(
      "update monigones_private.games set next_due_at=now()-interval '1 second' where league_id=$1",
      [c.leagueId],
    );
    const claims = await rpc.call<Snapshot[]>('online_claim_due', { p_limit: 10 });
    expect(claims).toHaveLength(1);
    const preview = await replacement.preview(c),
      id = randomUUID();
    await replacement.apply(c, id, preview);
    const current = await load(c.leagueId);
    await rpc.call('online_tick_failed', {
      p_league: c.leagueId,
      p_lease: claims[0].lease,
      p_error: 'old worker',
    });
    expect((await load(c.leagueId)).state).toEqual(current.state);
    expect(
      await rpc.call('online_commit', {
        p_league: c.leagueId,
        p_expected: claims[0].revision,
        p_state: claims[0].state,
        p_due: new Date(claims[0].state.nextMarketAt).toISOString(),
      }),
    ).toBe('conflict');
    await expect(
      store.dispatch(admin, { type: 'chat', text: 'Obsoleto' }, randomUUID()),
    ).rejects.toThrow('La demo ha cambiado');
    const handler = onlineHandler(
      store,
      {
        url: 'http://127.0.0.1:54321',
        secret: 'fixture',
        cronSecret: 'x'.repeat(40),
        origin: 'https://monigones.vercel.app',
      },
      async () => ({ id: admin, email: 'admin@example.test', name: 'Presidente 1' }),
    );
    const headers = { authorization: 'Bearer fixture', 'content-type': 'application/json' };
    const session = await handler(
      new Request('https://monigones.vercel.app/api/session', { headers }),
    );
    expect((await session.json()).membership).toBe(true);
    const chat = await handler(
      new Request('https://monigones.vercel.app/api/command', {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': randomUUID(), 'x-monigones-generation': id },
        body: JSON.stringify({ type: 'chat', text: 'Nueva demo verificada' }),
      }),
    );
    expect(chat.status).toBe(200);
    const view = await chat.json();
    expect(view.state.chat.at(-1).text).toBe('Nueva demo verificada');
    expect(view.state.privateRng).toBeUndefined();
    await store.tick();
    expect((await load(c.leagueId)).state.contracts).toHaveLength(58);
  });
  it('protege RPC, respaldos inmutables y metadatos de Realtime con permisos reales', async () => {
    const c = await setup(),
      p = await replacement.preview(c),
      id = randomUUID();
    await replacement.apply(c, id, p);
    for (const role of ['anon', 'authenticated']) {
      const client = await db.connect();
      try {
        await client.query('begin');
        await client.query(`set local role ${role}`);
        await expect(client.query('select public.online_demo_backup($1)', [id])).rejects.toThrow(
          'permission denied',
        );
        await client.query('rollback');
      } finally {
        client.release();
      }
    }
    const client = await db.connect();
    try {
      await client.query('begin');
      await client.query('set local role service_role');
      await expect(
        client.query("update monigones_private.demo_backups set sha256='bad' where id=$1", [id]),
      ).rejects.toThrow('permission denied');
      await client.query('rollback');
      await client.query('begin');
      await client.query('set local role authenticated');
      await client.query("select set_config('request.jwt.claim.sub',$1,true)", [other]);
      expect(
        (await client.query('select * from public.game_revisions where league_id=$1', [c.leagueId]))
          .rows,
      ).toHaveLength(0);
      await client.query("select set_config('request.jwt.claim.sub',$1,true)", [admin]);
      expect(
        (await client.query('select * from public.game_revisions where league_id=$1', [c.leagueId]))
          .rows,
      ).toHaveLength(1);
      await client.query('rollback');
    } finally {
      client.release();
    }
    await db.query("update monigones_private.demo_backups set sha256='bad' where id=$1", [id]);
    await expect(replacement.preview(c, id)).rejects.toThrow('REPLACE_BACKUP_INVALID');
  });
});
