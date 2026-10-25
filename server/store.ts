import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { createGame, makeClub, uid } from '../shared/seed';
import { execute, publicState, reconcile, syncAttention } from '../shared/engine';
import { normalizeImport } from '../shared/sports';
import { DAY } from '../shared/config';
import { invariant } from '../shared/math';
import type { Command, GameState } from '../shared/types';
export interface User {
  id: string;
  email: string;
  name: string;
}
export class Store {
  db: DatabaseSync;
  constructor(path = ':memory:', demo = true) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL;PRAGMA foreign_keys=ON;PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS leagues(id TEXT PRIMARY KEY,name TEXT NOT NULL,invite TEXT UNIQUE NOT NULL,admin_id TEXT NOT NULL REFERENCES users(id),state TEXT NOT NULL,version INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS memberships(user_id TEXT PRIMARY KEY REFERENCES users(id),league_id TEXT NOT NULL REFERENCES leagues(id),club_id TEXT UNIQUE NOT NULL);
 CREATE INDEX IF NOT EXISTS memberships_league ON memberships(league_id);
 CREATE TABLE IF NOT EXISTS receipts(user_id TEXT NOT NULL REFERENCES users(id),key TEXT NOT NULL,league_id TEXT NOT NULL,command TEXT NOT NULL,result_version INTEGER NOT NULL,PRIMARY KEY(user_id,key));
 CREATE TABLE IF NOT EXISTS sync_logs(id TEXT PRIMARY KEY,league_id TEXT NOT NULL,at INTEGER NOT NULL,status TEXT NOT NULL,detail TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS job_runs(id INTEGER PRIMARY KEY,at INTEGER NOT NULL,status TEXT NOT NULL,detail TEXT NOT NULL);
 `);
    if (demo && !this.db.prepare('SELECT id FROM users WHERE id=?').get('demo1')) {
      this.tx(() => {
        for (let i = 1; i <= 5; i++)
          this.db
            .prepare('INSERT INTO users VALUES(?,?,?,?)')
            .run(`demo${i}`, `presidente${i}@crown.local`, `Presidente ${i}`, 'disabled');
        const s = createGame(Date.now());
        s.clubs[5].userId = `reserved-demo:${s.id}:demo6`;
        this.save(s, true);
        for (const c of s.clubs.filter((c) => /^demo[1-5]$/.test(c.userId)))
          this.db.prepare('INSERT INTO memberships VALUES(?,?,?)').run(c.userId, s.id, c.id);
      });
    }
  }
  tx<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  save(s: GameState, insert = false) {
    syncAttention(s);
    if (insert)
      this.db
        .prepare('INSERT INTO leagues VALUES(?,?,?,?,?,?)')
        .run(s.id, s.name, s.invite, s.adminId, JSON.stringify(s), s.version);
    else
      this.db
        .prepare('UPDATE leagues SET state=?,version=?,name=?,invite=? WHERE id=?')
        .run(JSON.stringify(s), s.version, s.name, s.invite, s.id);
  }
  getLeague(id: string) {
    const row = this.db.prepare('SELECT state FROM leagues WHERE id=?').get(id) as
      { state: string } | undefined;
    invariant(row, 'Liga no encontrada.');
    const state = JSON.parse(row.state) as GameState;
    state.privateRng ??= randomBytes(32).toString('hex');
    return state;
  }
  membership(userId: string) {
    return this.db
      .prepare('SELECT league_id,club_id FROM memberships WHERE user_id=?')
      .get(userId) as { league_id: string; club_id: string } | undefined;
  }
  view(s: GameState, userId: string) {
    const result = publicState(s, userId);
    const rows = this.db
      .prepare(
        'SELECT users.id,users.name FROM users JOIN memberships ON memberships.user_id=users.id WHERE memberships.league_id=?',
      )
      .all(s.id) as { id: string; name: string }[];
    for (const c of result.state.clubs)
      c.presidentName = rows.find((u) => u.id === c.userId)?.name || 'Presidente';
    return result;
  }
  getState(userId: string) {
    return this.tx(() => {
      const m = this.membership(userId);
      invariant(m, 'Todavía no perteneces a una liga.');
      const s = this.getLeague(m.league_id);
      const before = s.version;
      reconcile(s, Math.max(s.now, Date.now() + s.timeOffset));
      if (s.version === before) s.version++;
      this.save(s);
      return this.view(s, userId);
    });
  }
  dispatch(userId: string, command: Command, key: string, adminTools = false, generation?: string) {
    return this.tx(() => {
      const m = this.membership(userId);
      invariant(m, 'No perteneces a una liga.');
      const s = this.getLeague(m.league_id);
      invariant(
        !s.resetId || generation === s.resetId,
        'La demo ha cambiado. Actualiza la partida antes de volver a enviar esta acción.',
      );
      const encoded = JSON.stringify(command);
      const prior = this.db
        .prepare('SELECT command,league_id FROM receipts WHERE user_id=? AND key=?')
        .get(userId, key) as { command: string; league_id: string } | undefined;
      if (prior) {
        invariant(
          prior.command === encoded && prior.league_id === s.id,
          'La clave de idempotencia ya se utilizó con otra acción.',
        );
        return this.view(s, userId);
      }
      reconcile(s, Math.max(s.now, Date.now() + s.timeOffset));
      if (command.type === 'advance') {
        invariant(
          adminTools && s.adminId === userId,
          'El control de tiempo solo está disponible para el administrador de pruebas.',
        );
        let target = s.now;
        const r = s.rounds.find((r) => r.number === s.currentRound)!;
        switch (command.step) {
          case 'day':
            target += DAY;
            break;
          case 'week':
            target += 7 * DAY;
            break;
          case 'market':
            target = s.nextMarketAt + 1;
            break;
          case 'activity':
            target = Math.max(s.now, ...s.clubs.map((c) => c.activity?.endsAt || s.now));
            break;
          case 'jobs':
            target = Math.max(s.now, ...s.jobs.map((j) => j.endsAt));
            break;
          case 'kickoff':
            target = Math.max(s.now, r.startsAt);
            break;
          case 'match':
            target = Math.min(
              ...r.matches.filter((m) => m.status !== 'finished').map((m) => m.endsAt),
            );
            break;
          case 'round':
            target = Math.max(s.now, ...r.matches.map((m) => m.endsAt)) + 1;
            break;
          case 'fifty':
            target = Math.max(s.now, s.seasonStartedAt + 50 * DAY);
            break;
          default:
            throw Error('Paso de simulación inválido.');
        }
        invariant(
          Number.isFinite(target) && target - s.now <= 366 * DAY,
          'Avance de tiempo inválido.',
        );
        s.timeOffset += target - s.now;
        reconcile(s, target);
        s.version++;
        s.audit.push({
          at: s.now,
          actor: m.club_id,
          action: 'admin.advance',
          detail: String(command.step),
        });
      } else if (command.type === 'importSports') {
        invariant(
          adminTools && s.adminId === userId,
          'Importación reservada al administrador de pruebas.',
        );
        const imported = normalizeImport(command.payload, s.now);
        for (const p of imported.players) {
          const old = s.players.find((x) => x.id === p.id);
          if (old) {
            invariant(
              !s.contracts.some((ct) => ct.playerId === p.id),
              'No se puede reemplazar un futbolista con contrato activo.',
            );
            Object.assign(old, p);
          } else s.players.push(p);
        }
        s.audit.push({
          at: s.now,
          actor: m.club_id,
          action: 'sports.sync',
          detail: `${imported.version}: ${imported.players.length} altas`,
        });
        this.db
          .prepare('INSERT INTO sync_logs VALUES(?,?,?,?,?)')
          .run(
            uid(),
            s.id,
            s.now,
            'ok',
            JSON.stringify({ version: imported.version, players: imported.players.length }),
          );
        s.version++;
      } else execute(s, { userId, clubId: m.club_id, admin: s.adminId === userId }, command);
      this.save(s);
      this.db
        .prepare('INSERT INTO receipts VALUES(?,?,?,?,?)')
        .run(userId, key, s.id, encoded, s.version);
      return this.view(s, userId);
    });
  }
  createUser(email: string, password: string, name: string) {
    const normalized = email.toLowerCase().trim();
    invariant(
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized) && normalized.length <= 254,
      'Correo inválido.',
    );
    invariant(
      password.length >= 10 && password.length <= 128,
      'La contraseña necesita entre 10 y 128 caracteres.',
    );
    invariant(name.trim().length >= 2 && name.length <= 60, 'Nombre inválido.');
    const salt = randomBytes(16).toString('hex');
    const digest = scryptSync(password, salt, 64).toString('hex');
    const user = { id: uid(), email: normalized, name: name.trim() };
    try {
      this.db
        .prepare('INSERT INTO users VALUES(?,?,?,?)')
        .run(user.id, user.email, user.name, `${salt}:${digest}`);
    } catch {
      throw Error('No se ha podido crear la cuenta con ese correo.');
    }
    return user;
  }
  login(email: string, password: string) {
    const row = this.db
      .prepare('SELECT * FROM users WHERE email=?')
      .get(email.toLowerCase().trim()) as (User & { password: string }) | undefined;
    invariant(row && row.password.includes(':'), 'Correo o contraseña incorrectos.');
    const [salt, stored] = row.password.split(':');
    const result = scryptSync(password, salt, 64);
    invariant(
      timingSafeEqual(result, Buffer.from(stored, 'hex')),
      'Correo o contraseña incorrectos.',
    );
    return { id: row.id, email: row.email, name: row.name };
  }
  session(userId: string) {
    const token = randomBytes(32).toString('hex');
    this.db
      .prepare('INSERT INTO sessions VALUES(?,?,?)')
      .run(createHash('sha256').update(token).digest('hex'), userId, Date.now() + 7 * DAY);
    return token;
  }
  user(token: string) {
    if (!token || token.length !== 64) return;
    const row = this.db
      .prepare(
        'SELECT u.id,u.email,u.name FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.hash=? AND s.expires_at>?',
      )
      .get(createHash('sha256').update(token).digest('hex'), Date.now()) as User | undefined;
    return row;
  }
  logout(token: string) {
    this.db
      .prepare('DELETE FROM sessions WHERE hash=?')
      .run(createHash('sha256').update(token).digest('hex'));
  }
  createLeague(user: User, name: string, clubName: string, favorite: string, color: string) {
    return this.tx(() => {
      invariant(!this.membership(user.id), 'Solo puedes pertenecer a una liga activa.');
      invariant(
        name.length >= 3 && name.length <= 60,
        'El nombre de liga debe tener entre 3 y 60 caracteres.',
      );
      const s = createGame(Date.now(), false, user.id, name);
      const c = makeClub(user.id, clubName, favorite, color, s.now);
      s.clubs.push(c);
      this.save(s, true);
      this.db.prepare('INSERT INTO memberships VALUES(?,?,?)').run(user.id, s.id, c.id);
      return publicState(s, user.id);
    });
  }
  joinLeague(user: User, invite: string, clubName: string, favorite: string, color: string) {
    return this.tx(() => {
      invariant(!this.membership(user.id), 'Solo puedes pertenecer a una liga activa.');
      const row = this.db
        .prepare('SELECT id FROM leagues WHERE invite=?')
        .get(invite.trim().toUpperCase()) as { id: string } | undefined;
      invariant(row, 'Invitación no válida.');
      const s = this.getLeague(row.id);
      invariant(
        s.draft.active && !s.auctions.some((a) => a.kind === 'draft'),
        'La liga ya ha comenzado el draft.',
      );
      invariant(s.clubs.length < 20, 'La liga está completa.');
      const c = makeClub(user.id, clubName, favorite, color, s.now);
      s.clubs.push(c);
      s.version++;
      this.save(s);
      this.db.prepare('INSERT INTO memberships VALUES(?,?,?)').run(user.id, s.id, c.id);
      return publicState(s, user.id);
    });
  }
  tick() {
    for (const row of this.db.prepare('SELECT id FROM leagues').all() as { id: string }[]) {
      try {
        this.tx(() => {
          const s = this.getLeague(row.id);
          reconcile(s, Math.max(s.now, Date.now() + s.timeOffset));
          s.version++;
          this.save(s);
        });
      } catch (e) {
        this.db
          .prepare('INSERT INTO job_runs(at,status,detail) VALUES(?,?,?)')
          .run(Date.now(), 'error', String(e));
      }
    }
  }
  close() {
    this.db.close();
  }
}
