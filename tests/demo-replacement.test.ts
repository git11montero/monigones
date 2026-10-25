import { afterEach, describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import legacy from './fixtures/legacy-demo-v05.json';
import fantasy from '../data/demo-fantasy-v06.json';
import { Store } from '../server/store';
import { createGame } from '../shared/seed';
import { previewFantasy, fantasySnapshot } from '../server/demo/fantasy';
import { rebaseCheckpoint } from '../server/demo/state';
import { privateDirectory } from '../server/demo/private-directory';
import { execute } from '../shared/engine';
import { nextMarket } from '../shared/math';
import {
  inspectSqlite,
  previewSqlite,
  applySqlite,
  readLocalBackup,
  verifySqlite,
} from '../server/demo/sqlite-replacement';
const cleanup: { store: Store; dir: string }[] = [];
afterEach(() => {
  for (const c of cleanup.splice(0)) {
    try {
      c.store.close();
    } catch {}
    rmSync(c.dir, { recursive: true, force: true });
  }
});
function fixture(old = true) {
  const dir = mkdtempSync(join(tmpdir(), 'monigones-replacement-')),
    file = join(dir, 'game.sqlite'),
    backups = join(dir, 'backups'),
    store = new Store(file);
  cleanup.push({ store, dir });
  const league = store.membership('demo1')!.league_id;
  if (old) {
    const s = structuredClone(legacy) as ReturnType<typeof createGame>;
    s.id = league;
    s.invite = 'LEGACY123456';
    store.db
      .prepare('INSERT INTO users VALUES(?,?,?,?)')
      .run('demo6', 'six@example.test', 'Presidente 6', 'disabled');
    store.db.prepare('DELETE FROM memberships WHERE league_id=?').run(league);
    store.save(s);
    for (const c of s.clubs)
      store.db.prepare('INSERT INTO memberships VALUES(?,?,?)').run(c.userId, league, c.id);
  }
  return { dir, file, backups, store, league };
}
describe('Demo definitiva y reemplazo SQLite real, solo archivos temporales', () => {
  it('rebasa trabajos y contratos durante el cambio horario sin conceder progreso histórico', () => {
    const s = createGame(Date.parse('2026-10-24T23:30:00Z'));
    s.clubs[0].resources.development = 10000;
    execute(
      s,
      { userId: 'demo1', clubId: s.clubs[0].id, admin: true },
      { type: 'build', target: 'hq' },
    );
    const now = Date.parse('2026-10-26T12:00:00Z'),
      result = rebaseCheckpoint(s, now);
    expect(result.jobs[0].endsAt - result.now).toBe(s.jobs[0].endsAt - s.now);
    expect(result.contracts[0].endsAt - result.now).toBe(s.contracts[0].endsAt - s.now);
    expect(result.clubs[0].resources).toEqual(s.clubs[0].resources);
    expect(result.ledger).toHaveLength(s.ledger.length);
    expect(result.processed).toEqual(s.processed);
    expect(result.nextMarketAt).toBe(nextMarket(now));
    expect(new Date(result.nextMarketAt).toISOString()).toBe('2026-10-27T05:00:00.000Z');
    expect(() => privateDirectory('public/backups')).toThrow('DIRECTORY_MUST_BE_PRIVATE');
  });
  it('utiliza una sola fuente completa y conserva las ligas normales sin demo', () => {
    expect(previewFantasy(fantasy).problems).toEqual([]);
    const s = createGame();
    expect(s.clubs.map((c) => c.name)).toEqual([
      ...fantasy.teams.map((t) => t.name),
      fantasy.reservedName,
    ]);
    expect(s.contracts).toHaveLength(58);
    expect(s.contracts.find((c) => c.playerId === 'betis-17')!.clubId).toBe(s.clubs[1].id);
    expect(s.contracts.find((c) => c.playerId === 'barcelona-14')!.clubId).toBe(s.clubs[0].id);
    expect(createGame(Date.now(), false).clubs).toHaveLength(0);
    expect(fantasySnapshot(fantasy, s.now, 'definitive-fixture').state.contracts).toHaveLength(58);
  });
  it('reserva el sexto club sin usuario ni sesión y no sobrescribe al volver a arrancar', () => {
    const { store, file } = fixture(false);
    const before = inspectSqlite(file);
    expect(store.db.prepare("SELECT id FROM users WHERE id='demo6'").get()).toBeUndefined();
    expect(store.membership('demo6')).toBeUndefined();
    expect(before.current.state.clubs[5].userId).toMatch(/^reserved-demo:/);
    store.close();
    const reopened = new Store(file);
    expect(inspectSqlite(file).fingerprint).toBe(before.fingerprint);
    reopened.close();
    // Store.close is idempotent? The cleanup keeps an already closed fixture out of its list.
  });
  it('preview no escribe y apply sin TTY no crea respaldo ni sustituye', () => {
    const { store, file, backups } = fixture();
    const before = inspectSqlite(file).fingerprint;
    expect(previewSqlite(file, backups).report.after.presidents[0].club).toBe('Cholo ATM');
    expect(existsSync(backups)).toBe(false);
    const child = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        'scripts/replace-demo.ts',
        '--target',
        'local',
        '--sqlite',
        file,
        '--backup-dir',
        backups,
        '--apply',
      ],
      { encoding: 'utf8' },
    );
    expect(child.status).toBe(1);
    expect(child.stderr).toContain('INTERACTIVE_TERMINAL');
    expect(child.stdout).not.toMatch(/password|privateRng/);
    expect(inspectSqlite(file).fingerprint).toBe(before);
    expect(existsSync(backups)).toBe(false);
    expect(store.membership('demo1')).toBeTruthy();
  });
  it('copia WAL consistente, sustituye y restaura sin alterar cuentas, sesiones ni otra liga', async () => {
    const { store, file, backups, league } = fixture();
    const other = store.createUser('other@example.test', 'TemporaryPassword123', 'Otro');
    store.createLeague(other, 'Otra liga', 'Otro club', 'betis', '#446688');
    store.db.exec(
      "CREATE TABLE custom_data(id INTEGER PRIMARY KEY,value TEXT); INSERT INTO custom_data VALUES(1,'also backed up')",
    );
    const users = store.db.prepare('SELECT * FROM users ORDER BY id').all();
    const token = store.session('demo1');
    const foreign = store.db.prepare('SELECT * FROM leagues WHERE id<>?').all(league);
    const before = inspectSqlite(file).current;
    const id = randomUUID();
    const result = await applySqlite(file, backups, id, previewSqlite(file, backups));
    expect(result.status).toBe('applied');
    const checkpoint = readLocalBackup(backups, id);
    expect(checkpoint.current.state).toEqual(before.state);
    expect(statSync(checkpoint.database).mode & 0o777).toBe(0o600);
    expect(verifySqlite(file).report.contracts).toBe(58);
    expect(store.getLeague(league).clubs[0].name).toBe('Cholo ATM');
    expect(store.db.prepare('SELECT * FROM users ORDER BY id').all()).toEqual(users);
    expect(store.user(token)?.id).toBe('demo1');
    expect(store.db.prepare('SELECT * FROM leagues WHERE id<>?').all(league)).toEqual(foreign);
    expect((await applySqlite(file, backups, id, previewSqlite(file, backups))).status).toBe(
      'already_applied',
    );
    expect(() => store.dispatch('demo1', { type: 'chat', text: 'stale' }, randomUUID())).toThrow(
      'demo ha cambiado',
    );
    const restored = await applySqlite(
      file,
      backups,
      randomUUID(),
      previewSqlite(file, backups, league, id),
      id,
    );
    expect(restored.revision).toBeGreaterThan(result.revision);
    expect(store.getLeague(league).clubs.map((c) => c.name)).toEqual(
      before.state.clubs.map((c) => c.name),
    );
    expect(store.getLeague(league).contracts).toHaveLength(before.state.contracts.length);
    expect(store.db.prepare('SELECT * FROM leagues WHERE id<>?').all(league)).toEqual(foreign);
    expect(store.user(token)?.id).toBe('demo1');
    expect(store.db.prepare('SELECT value FROM custom_data').get()).toEqual({
      value: 'also backed up',
    });
  });
  it('rechaza preview obsoleto, revierte un fallo intermedio y permite reintentar con el mismo respaldo', async () => {
    const { store, file, backups, league } = fixture();
    const stale = previewSqlite(file, backups);
    store.db.prepare('UPDATE leagues SET version=version+1 WHERE id=?').run(league);
    await expect(applySqlite(file, backups, randomUUID(), stale)).rejects.toThrow('STALE');
    store.db.prepare('UPDATE leagues SET version=version-1 WHERE id=?').run(league);
    const preview = previewSqlite(file, backups),
      id = randomUUID();
    store.db.exec(
      "CREATE TRIGGER fail_replace BEFORE UPDATE ON leagues BEGIN SELECT RAISE(ABORT,'fixture failure'); END",
    );
    await expect(applySqlite(file, backups, id, preview)).rejects.toThrow('fixture failure');
    expect(inspectSqlite(file).fingerprint).toBe(preview.inspection.fingerprint);
    expect(readLocalBackup(backups, id).current.state).toEqual(preview.inspection.current.state);
    store.db.exec('DROP TRIGGER fail_replace');
    await expect(applySqlite(file, backups, id, preview)).resolves.toMatchObject({
      status: 'applied',
    });
  });
  it('impide restaurar un archivo alterado y no modifica la partida actual', async () => {
    const { file, backups } = fixture();
    const id = randomUUID();
    await applySqlite(file, backups, id, previewSqlite(file, backups));
    const before = inspectSqlite(file).fingerprint;
    const path = join(backups, `${id}.sqlite`),
      bytes = readFileSync(path);
    bytes[200] ^= 1;
    writeFileSync(path, bytes);
    expect(() => previewSqlite(file, backups, undefined, id)).toThrow('BACKUP_INVALID');
    expect(inspectSqlite(file).fingerprint).toBe(before);
  });
});
