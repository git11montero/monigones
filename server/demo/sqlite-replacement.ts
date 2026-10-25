import { DatabaseSync, backup } from 'node:sqlite';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  openSync,
  closeSync,
  realpathSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { invariant } from '../../shared/math.js';
import { comparison, digest, localState, summary, validateAssigned } from './replacement.js';
import { rebaseCheckpoint } from './state.js';
import type { GameState } from '../../shared/types.js';
import source from '../../data/demo-fantasy-v06.json' with { type: 'json' };
import { privateDirectory } from './private-directory.js';
const sha = (f: string) => createHash('sha256').update(readFileSync(f)).digest('hex');
function open(file: string, readOnly = true) {
  invariant(existsSync(file), 'REPLACE_SQLITE_MISSING');
  const db = new DatabaseSync(file, { readOnly });
  db.exec('PRAGMA foreign_keys=ON;PRAGMA busy_timeout=5000');
  return db;
}
function capture(db: DatabaseSync, league?: string) {
  const leagues = (
    league
      ? db.prepare('SELECT * FROM leagues WHERE id=?').all(league)
      : db.prepare("SELECT * FROM leagues WHERE admin_id='demo1'").all()
  ) as any[];
  invariant(leagues.length === 1, 'REPLACE_LOCAL_DEMO_NOT_UNIQUE');
  const row = leagues[0];
  const state = JSON.parse(row.state) as GameState;
  const memberships = db
    .prepare('SELECT * FROM memberships WHERE league_id=? ORDER BY user_id')
    .all(row.id) as any[];
  const users = db
    .prepare(
      'SELECT u.* FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.league_id=? ORDER BY u.id',
    )
    .all(row.id) as any[];
  invariant(
    row.admin_id === 'demo1' &&
      state.adminId === 'demo1' &&
      state.clubs.length === 6 &&
      users.length >= 1 &&
      users.every((u) => /^demo[1-6]$/.test(u.id) && u.password === 'disabled'),
    'REPLACE_LOCAL_NOT_SYSTEM_DEMO',
  );
  const receipts = db
    .prepare('SELECT * FROM receipts WHERE league_id=? ORDER BY user_id,key')
    .all(row.id);
  const sync = db.prepare('SELECT * FROM sync_logs WHERE league_id=? ORDER BY id').all(row.id);
  return { row, state, memberships, users, receipts, sync };
}
const slotMap = (s: GameState) => s.clubs.map((c, i) => ({ slot: `demo${i + 1}`, clubId: c.id }));
export function inspectSqlite(file: string, league?: string) {
  const db = open(file);
  try {
    db.exec('BEGIN');
    const current = capture(db, league);
    db.exec('ROLLBACK');
    return { current, fingerprint: digest(current) };
  } finally {
    db.close();
  }
}
function paths(directory: string, id: string) {
  invariant(/^[a-f0-9-]{36}$/.test(id), 'REPLACE_BACKUP_ID');
  return { database: join(directory, `${id}.sqlite`), manifest: join(directory, `${id}.json`) };
}
export function readLocalBackup(directory: string, id: string) {
  const pathsForId = paths(directory, id),
    manifest = JSON.parse(readFileSync(pathsForId.manifest, 'utf8'));
  invariant(
    manifest.format === 'monigones-sqlite-backup-v1' &&
      manifest.id === id &&
      manifest.sha256 === sha(pathsForId.database),
    'REPLACE_BACKUP_INVALID',
  );
  const copy = inspectSqlite(pathsForId.database, manifest.league);
  invariant(copy.fingerprint === manifest.fingerprint, 'REPLACE_BACKUP_INVALID');
  return { ...pathsForId, manifest, ...copy };
}
export function previewSqlite(file: string, directory: string, league?: string, restore?: string) {
  const inspection = inspectSqlite(file, league);
  const old = restore ? readLocalBackup(directory, restore) : null;
  invariant(
    !old || old.current.row.id === inspection.current.row.id,
    'REPLACE_BACKUP_WRONG_TARGET',
  );
  const state = old
    ? rebaseCheckpoint(old.current.state, Date.now())
    : localState(
        Date.now(),
        inspection.current.row.id,
        inspection.current.row.invite,
        inspection.current.row.version + 1,
      );
  validateAssigned(state, slotMap(state));
  return { inspection, state, restore: old, report: comparison(inspection.current.state, state) };
}
export async function applySqlite(
  file: string,
  directory: string,
  operation: string,
  preview: ReturnType<typeof previewSqlite>,
  restore?: string,
) {
  const dir = privateDirectory(directory);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const target = realpathSync(file);
  const p = paths(dir, operation);
  invariant(resolve(p.database) !== target, 'REPLACE_BACKUP_PATH');
  const db = open(file, false);
  try {
    db.exec('BEGIN IMMEDIATE');
    const hasTable = db
      .prepare("SELECT name FROM sqlite_master WHERE name='demo_replacement_runs'")
      .get();
    const key = digest({
      action: restore || 'replace',
      source: restore ? readLocalBackup(dir, restore).manifest.sha256 : digest(source),
      league: preview.inspection.current.row.id,
    });
    if (hasTable) {
      const old = db
        .prepare('SELECT * FROM demo_replacement_runs WHERE id=?')
        .get(operation) as any;
      if (old) {
        invariant(old.request_hash === key, 'REPLACE_OPERATION_COLLISION');
        db.exec('ROLLBACK');
        return { status: 'already_applied', backup: operation, revision: old.revision };
      }
    }
    const current = capture(db, preview.inspection.current.row.id);
    invariant(digest(current) === preview.inspection.fingerprint, 'REPLACE_STALE_PREVIEW');
    // A second read-only connection sees the same committed checkpoint while BEGIN IMMEDIATE blocks all writers.
    if (existsSync(p.manifest))
      invariant(
        readLocalBackup(dir, operation).fingerprint === preview.inspection.fingerprint,
        'REPLACE_BACKUP_COLLISION',
      );
    else {
      invariant(!existsSync(p.database), 'REPLACE_BACKUP_COLLISION');
      const fd = openSync(p.database, 'wx', 0o600);
      closeSync(fd);
      const reader = open(file);
      try {
        await backup(reader, p.database);
      } finally {
        reader.close();
      }
      const check = open(p.database);
      try {
        invariant(
          (check.prepare('PRAGMA integrity_check').get() as any).integrity_check === 'ok' &&
            !check.prepare('PRAGMA foreign_key_check').all().length,
          'REPLACE_BACKUP_INTEGRITY',
        );
        invariant(
          digest(capture(check, current.row.id)) === preview.inspection.fingerprint,
          'REPLACE_BACKUP_SNAPSHOT_MISMATCH',
        );
      } finally {
        check.close();
      }
      writeFileSync(
        p.manifest,
        JSON.stringify(
          {
            format: 'monigones-sqlite-backup-v1',
            id: operation,
            league: current.row.id,
            createdAt: new Date().toISOString(),
            version: current.row.version,
            sha256: sha(p.database),
            fingerprint: preview.inspection.fingerprint,
          },
          null,
          2,
        ),
        { flag: 'wx', mode: 0o600 },
      );
    }
    const restored = restore ? readLocalBackup(dir, restore).current : null;
    const state = restored
      ? rebaseCheckpoint(restored.state, Date.now())
      : localState(
          Date.now(),
          current.row.id,
          randomUUID().replaceAll('-', '').slice(0, 12),
          current.row.version + 1,
        );
    state.version = current.row.version + 1;
    state.resetId = operation;
    state.privateRng = randomUUID();
    state.invite = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
    const memberships =
      restored?.memberships ||
      state.clubs
        .filter((c) => /^demo[1-5]$/.test(c.userId))
        .map((c) => ({ user_id: c.userId, league_id: state.id, club_id: c.id }));
    for (const m of memberships) {
      const user = db.prepare('SELECT password FROM users WHERE id=?').get(m.user_id) as any;
      const member = db
        .prepare('SELECT league_id FROM memberships WHERE user_id=?')
        .get(m.user_id) as any;
      invariant(
        user?.password === 'disabled' && (!member || member.league_id === state.id),
        'REPLACE_OTHER_USERS',
      );
    }
    validateAssigned(state, slotMap(state));
    db.prepare('DELETE FROM memberships WHERE league_id=?').run(state.id);
    for (const m of memberships)
      db.prepare('INSERT INTO memberships VALUES(?,?,?)').run(m.user_id, state.id, m.club_id);
    db.prepare('DELETE FROM receipts WHERE league_id=?').run(state.id);
    db.prepare('DELETE FROM sync_logs WHERE league_id=?').run(state.id);
    if (restored) {
      for (const r of restored.receipts as any[])
        db.prepare('INSERT INTO receipts VALUES(?,?,?,?,?)').run(
          r.user_id,
          r.key,
          r.league_id,
          r.command,
          r.result_version,
        );
      for (const r of restored.sync as any[])
        db.prepare('INSERT INTO sync_logs VALUES(?,?,?,?,?)').run(
          r.id,
          r.league_id,
          r.at,
          r.status,
          r.detail,
        );
    }
    db.prepare('UPDATE leagues SET name=?,invite=?,state=?,version=? WHERE id=?').run(
      state.name,
      state.invite,
      JSON.stringify(state),
      state.version,
      state.id,
    );
    db.exec(
      'CREATE TABLE IF NOT EXISTS demo_replacement_runs(id TEXT PRIMARY KEY,league_id TEXT NOT NULL,request_hash TEXT NOT NULL,revision INTEGER NOT NULL,restore_from TEXT,created_at TEXT NOT NULL)',
    );
    db.prepare('INSERT INTO demo_replacement_runs VALUES(?,?,?,?,?,?)').run(
      operation,
      state.id,
      key,
      state.version,
      restore || null,
      new Date().toISOString(),
    );
    invariant(!db.prepare('PRAGMA foreign_key_check').all().length, 'REPLACE_REFERENCE_ERROR');
    db.exec('COMMIT');
    return { status: 'applied', backup: operation, revision: state.version };
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {}
    throw error;
  } finally {
    db.close();
  }
}
export function verifySqlite(file: string, league?: string) {
  const { current } = inspectSqlite(file, league);
  validateAssigned(current.state, slotMap(current.state));
  invariant(current.row.version === current.state.version, 'REPLACE_INVALID_REVISION');
  for (const m of current.memberships)
    invariant(
      current.state.clubs.some((c) => c.userId === m.user_id && c.id === m.club_id),
      'REPLACE_INVALID_MEMBERSHIP',
    );
  return {
    status: 'verified',
    revision: current.state.version,
    resetId: current.state.resetId,
    report: summary(current.state),
  };
}
