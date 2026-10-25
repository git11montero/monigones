import { describe, it, expect } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  generatedDemo,
  snapshotOf,
  readSnapshot,
  prepareDemo,
  configSchema,
  digest,
} from '../server/demo/state';
import { createGame } from '../shared/seed';
import { RULES, DAY } from '../shared/config';
import { execute, jobQuote, reconcile, syncAttention } from '../shared/engine';
import { dailyKey, nextMarket } from '../shared/math';
import { Store } from '../server/store';
import { exportSqliteDemo } from '../scripts/export-local-demo';
import { validateTarget } from '../scripts/seed-online-demo';

const at = Date.parse('2026-10-23T10:00:00Z');
const admin = randomUUID();
const config = () =>
  configSchema.parse({
    environment: 'local',
    projectRef: 'local',
    leagueId: randomUUID(),
    adminUserId: admin,
    mode: 'advanced',
    seed: 'local-demo-v1',
    sourceAt: new Date(at).toISOString(),
    startAt: 'now',
    users: { demo1: admin },
  });
describe('Fuente de demo, instantáneas y seguridad del CLI', () => {
  it('conserva textos con UUID y desplaza también la fecha de las pujas abiertas', () => {
    const s = generatedDemo('advanced', at, 'local-demo-v1');
    const actor = { userId: 'demo1', clubId: s.clubs[0].id, admin: true };
    execute(s, actor, { type: 'sell', playerId: s.contracts[0].playerId });
    const player = s.players.find((p) => p.id === s.marketPlayers[0])!;
    execute(s, actor, { type: 'bid', playerId: player.id, amount: player.value, salaryBps: 200 });
    s.chat = [
      { id: randomUUID(), clubId: s.clubs[0].id, at: s.now, text: `Referencia histórica ${s.id}` },
    ];
    const plan = prepareDemo(config(), snapshotOf(s, 'generated-local-demo'), at + 30 * DAY);
    expect(plan.state.chat[0].text).toBe(s.chat[0].text);
    expect(plan.state.bids[0].createdAt).toBe(s.bids[0].createdAt + 30 * DAY);
    expect(plan.state.bids[0].amount).toBe(s.bids[0].amount);
  });
  it('reutiliza los datos exactos del motor local con fecha y UUID reproducibles', () => {
    const a = generatedDemo('advanced', at, 'local-demo-v1');
    expect(a).toEqual(generatedDemo('advanced', at, 'local-demo-v1'));
    const local = createGame(at);
    expect(a.players).toEqual(local.players);
    expect(
      a.clubs.map((c) => ({
        name: c.name,
        color: c.color,
        favorite: c.favorite,
        resources: c.resources,
        buildings: c.buildings,
        research: c.research,
      })),
    ).toEqual(
      local.clubs.map((c) => ({
        name: c.name,
        color: c.color,
        favorite: c.favorite,
        resources: c.resources,
        buildings: c.buildings,
        research: c.research,
      })),
    );
    expect(a.contracts).toHaveLength(58);
    expect(a.chat.map((c) => c.text)).toEqual(local.chat.map((c) => c.text));
  });
  it('distingue inicial sin plantilla/prima de avanzada con el draft demo terminado', () => {
    const s = generatedDemo('initial', at, 'local-demo-v1');
    expect(s.clubs.every((c) => c.resources.money === RULES.initialBudget)).toBe(true);
    expect(s.contracts).toHaveLength(0);
    expect(s.draft.active).toBe(true);
    expect(s.ledger).toHaveLength(0);
    expect(s.clubs.map((c) => c.name)).toEqual(createGame(at).clubs.map((c) => c.name));
  });
  it('detecta manipulación, jugadores nuevos, referencias rotas y usuarios ajenos a la demo', () => {
    const snapshot = snapshotOf(
      generatedDemo('advanced', at, 'local-demo-v1'),
      'generated-local-demo',
    );
    const modified = structuredClone(snapshot);
    modified.state.clubs[0].resources.money++;
    expect(() => readSnapshot(modified)).toThrow('huella');
    const duplicate = structuredClone(snapshot.state);
    duplicate.contracts.push(duplicate.contracts[0]);
    expect(() => snapshotOf(duplicate, 'generated-local-demo')).toThrow('propietarios');
    const other = structuredClone(snapshot.state);
    other.clubs[0].userId = randomUUID();
    expect(() => snapshotOf(other, 'generated-local-demo')).toThrow('seis presidentes');
    const extra = structuredClone(snapshot.state);
    extra.players.push(extra.players[0]);
    expect(() => snapshotOf(extra, 'generated-local-demo')).toThrow('catálogo');
  });
  it('rebasa fechas antiguas sin recompensas, conserva progreso y programa Madrid tras el cambio DST', () => {
    const s = generatedDemo('advanced', at, 'local-demo-v1');
    execute(
      s,
      { userId: 'demo1', clubId: s.clubs[0].id, admin: true },
      { type: 'build', target: 'hq' },
    );
    const source = snapshotOf(s, 'generated-local-demo');
    const start = Date.parse('2026-10-25T06:10:00Z');
    const plan = prepareDemo(config(), source, start);
    expect(plan.state.clubs[0].resources).toEqual(s.clubs[0].resources);
    expect(plan.state.jobs[0].endsAt - start).toBe(s.jobs[0].endsAt - s.now);
    expect(plan.state.lastDaily).toBe(dailyKey(start));
    expect(plan.state.nextMarketAt).toBe(nextMarket(start));
    expect(new Date(plan.state.nextMarketAt).toISOString()).toBe('2026-10-26T05:00:00.000Z');
    expect(plan.state.timeOffset).toBe(0);
    expect(source.state).toEqual(s);
    expect(plan.slots.filter((s) => s.userId)).toHaveLength(1);
    expect(plan.state.clubs[1].userId).toMatch(/^reserved-demo:/);
  });
  it('exporta SQLite únicamente en modo lectura y conserva su hash, sin contraseñas o sesiones', async () => {
    const work = mkdtempSync(join(tmpdir(), 'monigones-export-test-')),
      file = join(work, 'fixture.sqlite');
    const db = new Store(file);
    const state = db.getLeague(db.membership('demo1')!.league_id);
    db.db.close();
    try {
      const hash = () => createHash('sha256').update(readFileSync(file)).digest('hex');
      const before = hash();
      const result = await exportSqliteDemo(file, state.id);
      expect(result.state).toEqual({
        ...state,
        clubs: state.clubs.map((c, i) => (i === 5 ? { ...c, userId: 'demo6' } : c)),
      });
      expect(hash()).toBe(before);
      expect(JSON.stringify(result)).not.toMatch(/password|sessions|presidente1@crown.local/);
      expect(readSnapshot(result).sha256).toBe(result.sha256);
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });
  it('rechaza proyectos cruzados, claves públicas, localhost como producción y administradores ambiguos', () => {
    const c = config();
    expect(validateTarget(c, 'http://127.0.0.1:54321', 'sb_secret_fixture')).toContain('127.0.0.1');
    expect(() => validateTarget(c, 'https://example.com', 'sb_secret_fixture')).toThrow('loopback');
    expect(() => validateTarget(c, 'http://localhost:54321', 'sb_publishable_fixture')).toThrow(
      'clave privada',
    );
    const remote = { ...c, environment: 'production' as const, projectRef: 'abcdefghijklmnopqrst' };
    expect(() =>
      validateTarget(remote, 'https://zzzzzzzzzzzzzzzzzzzz.supabase.co', 'sb_secret_fixture'),
    ).toThrow('projectRef');
    expect(() => configSchema.parse({ ...c, users: { demo1: admin, demo2: admin } })).toThrow();
  });
  it('conserva edificios, investigaciones, mercado y clasificación de un checkpoint avanzado real', () => {
    const s = generatedDemo('advanced', at, 'local-demo-v1'),
      c = s.clubs[0];
    const actor = { userId: c.userId, clubId: c.id, admin: true };
    c.buildings.hq = 1;
    c.buildings.stadium = 1;
    execute(s, actor, { type: 'build', target: 'hq' });
    const target = s.jobs[0].endsAt;
    reconcile(s, target);
    syncAttention(s);
    const prepared = prepareDemo(config(), snapshotOf(s, 'generated-local-demo'), at + 90 * DAY);
    expect(prepared.state.clubs[0].buildings).toEqual(s.clubs[0].buildings);
    expect(prepared.state.clubs[0].research).toEqual(s.clubs[0].research);
    expect(prepared.state.clubs[0].totalPoints).toBe(s.clubs[0].totalPoints);
    expect(prepared.state.marketPlayers).toEqual(s.marketPlayers);
    expect(prepared.state.players.map((p) => p.value)).toEqual(s.players.map((p) => p.value));
    expect(jobQuote(prepared.state.clubs[0], 'building', 'hq').money).toBe(
      jobQuote(c, 'building', 'hq').money,
    );
    expect(digest(prepared.state.players.map((p) => p.id))).toBe(
      digest(s.players.map((p) => p.id)),
    );
  });
});
