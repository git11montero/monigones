import { createHash } from 'node:crypto';
import { z } from 'zod';
import { BUILDINGS, FACILITIES, RESEARCH, DAY } from '../../shared/config.js';
import { createGame, makeClub } from '../../shared/seed.js';
import { publicState, syncAttention } from '../../shared/engine.js';
import { dailyKey, invariant, nextMarket } from '../../shared/math.js';
import { COACHES, REAL_CLUBS, roster } from '../../shared/sports.js';
import { nextWake } from '../online/store.js';
import type { GameState } from '../../shared/types.js';

export const slots = ['demo1', 'demo2', 'demo3', 'demo4', 'demo5', 'demo6'] as const;
export const uuid = z.string().uuid();
export const configSchema = z
  .object({
    environment: z.enum(['local', 'staging', 'production']),
    projectRef: z.string().regex(/^(local|[a-z0-9]{20})$/),
    leagueId: uuid,
    adminUserId: uuid,
    mode: z.enum(['initial', 'advanced']),
    seed: z.string().min(8).max(200),
    sourceAt: z.string().datetime({ offset: true }).optional(),
    startAt: z.union([z.literal('now'), z.string().datetime({ offset: true })]),
    users: z.partialRecord(z.enum(slots), uuid),
    snapshot: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.users.demo1 !== c.adminUserId)
      ctx.addIssue({ code: 'custom', message: 'demo1 debe corresponder al administrador.' });
    const ids = Object.values(c.users).filter(Boolean);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: 'custom', message: 'Un usuario no puede ocupar dos clubes.' });
    if (!c.snapshot && !c.sourceAt)
      ctx.addIssue({ code: 'custom', message: 'Indica sourceAt o una instantánea explícita.' });
    if (c.snapshot && c.mode !== 'advanced')
      ctx.addIssue({ code: 'custom', message: 'Las instantáneas solo se usan en modo avanzado.' });
  });
export type DemoConfig = z.infer<typeof configSchema>;
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );
}
export const digest = (value: unknown) =>
  createHash('sha256').update(canonical(value)).digest('hex');
function stableId(seed: string) {
  const bytes = createHash('sha256').update(seed).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const s = bytes.toString('hex');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const literalKeys = new Set([
  'text',
  'title',
  'subtitle',
  'name',
  'fullName',
  'description',
  'story',
  'detail',
  'reason',
  'source',
  'avatar',
  'verifiedAt',
]);
function walk(value: any, transform: (v: any, key: string) => any, key = ''): any {
  if (Array.isArray(value)) return value.map((v) => walk(v, transform, key));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [transform(k, '$key'), walk(v, transform, k)]),
    );
  return transform(value, key);
}
/** UUIDs are incidental; resources/catalog/rules come exclusively from the local motor. */
export function generatedDemo(mode: DemoConfig['mode'], at: number, seed: string): GameState {
  let state = createGame(at, true);
  if (mode === 'initial') {
    const demoClubs = state.clubs;
    state = createGame(at, false);
    state.clubs = demoClubs.map((c) => makeClub(c.userId, c.name, c.favorite, c.color, at));
    // Generate news for the same six clubs through the existing generator.
    state.news = createGame(at, true).news;
  }
  state.privateRng = 'rotated-by-postgresql-on-create';
  state.invite = 'assigned-by-postgresql';
  const ids = new Map<string, string>();
  state = walk(state, (v) =>
    typeof v === 'string'
      ? v.replace(uuidPattern, (id) => {
          if (!ids.has(id)) ids.set(id, stableId(`${seed}:${ids.size}`));
          return ids.get(id)!;
        })
      : v,
  );
  syncAttention(state);
  validateDemo(state);
  return state;
}

export type DemoSnapshot = {
  format: 'monigones-demo-snapshot-v1';
  source: 'generated-local-demo' | 'explicit-sqlite-readonly';
  capturedAt: string;
  presidents: Record<string, string>;
  state: GameState;
  sha256: string;
};
export function snapshotOf(
  state: GameState,
  source: DemoSnapshot['source'],
  presidents = Object.fromEntries(slots.map((s, i) => [s, `Presidente ${i + 1}`])),
): DemoSnapshot {
  validateDemo(state);
  invariant(
    slots.every(
      (s) =>
        typeof presidents[s] === 'string' &&
        presidents[s].length >= 2 &&
        presidents[s].length <= 60,
    ),
    'Presidentes inválidos.',
  );
  const payload = { state: structuredClone(state), presidents };
  return {
    format: 'monigones-demo-snapshot-v1',
    source,
    capturedAt: new Date().toISOString(),
    ...payload,
    sha256: digest(payload),
  };
}
export function readSnapshot(value: unknown): DemoSnapshot {
  const s = z
    .object({
      format: z.literal('monigones-demo-snapshot-v1'),
      source: z.enum(['generated-local-demo', 'explicit-sqlite-readonly']),
      capturedAt: z.string().datetime(),
      presidents: z.record(z.string(), z.string().min(2).max(60)),
      state: z.unknown(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict()
    .parse(value);
  invariant(
    s.sha256 === digest({ state: s.state, presidents: s.presidents }),
    'La huella de la instantánea no coincide.',
  );
  validateDemo(s.state);
  invariant(
    slots.every((id) => s.presidents[id]),
    'Faltan presidentes en la instantánea.',
  );
  return s as DemoSnapshot;
}

/** Validate references and exercise all six public views before accepting private state. */
export function validateDemo(input: unknown): asserts input is GameState {
  invariant(input && typeof input === 'object' && !Array.isArray(input), 'Partida inválida.');
  const s = input as GameState;
  const integer = (n: unknown, label: string) =>
    invariant(Number.isSafeInteger(n), `Entero inválido: ${label}`);
  for (const key of [
    'version',
    'now',
    'season',
    'seasonStartedAt',
    'seasonEndsAt',
    'nextMarketAt',
    'currentRound',
    'marketId',
    'timeOffset',
  ] as const)
    integer(s[key], key);
  invariant(
    s.version > 0 && s.season > 0 && s.seasonEndsAt > s.seasonStartedAt,
    'Temporada inválida.',
  );
  invariant(
    typeof s.id === 'string' &&
      typeof s.name === 'string' &&
      s.name.length >= 3 &&
      s.name.length <= 60,
    'Liga inválida.',
  );
  for (const k of [
    'clubs',
    'players',
    'contracts',
    'jobs',
    'bids',
    'auctions',
    'rounds',
    'ledger',
    'news',
    'chat',
    'sponsors',
    'concerts',
    'loans',
    'negotiations',
    'transfers',
    'events',
    'archives',
    'processed',
    'audit',
    'marketPlayers',
  ] as const)
    invariant(Array.isArray(s[k]), `Falta ${k}.`);
  for (const key of [
    'jobs',
    'bids',
    'auctions',
    'ledger',
    'news',
    'chat',
    'sponsors',
    'concerts',
    'loans',
    'negotiations',
    'transfers',
    'events',
  ] as const) {
    const ids = s[key].map((item) => item.id);
    invariant(
      ids.every((id) => typeof id === 'string' && id.length > 0) &&
        new Set(ids).size === ids.length,
      `Identificadores duplicados en ${key}.`,
    );
  }
  invariant(
    s.clubs.length === 6 &&
      slots.every((id) => s.clubs.some((c) => c.userId === id)) &&
      s.adminId === 'demo1',
    'Solo se admiten los seis presidentes de la demo local y su administrador demo1.',
  );
  const clubs = new Set(s.clubs.map((c) => c.id)),
    players = new Set(s.players.map((p) => p.id));
  invariant(
    clubs.size === 6 && players.size === 500 && s.players.length === 500,
    'Clubes o catálogo duplicados/incompletos.',
  );
  const catalog = roster(s.now);
  for (const p of s.players) {
    const original = catalog.find((c) => c.id === p.id);
    invariant(
      original &&
        original.name === p.name &&
        original.position === p.position &&
        original.realClubId === p.realClubId &&
        original.simulated === p.simulated,
      'El catálogo no corresponde al motor local.',
    );
    integer(p.value, 'VM');
    invariant(p.value > 0, 'VM inválido.');
    invariant(Array.isArray(p.valueHistory), 'Historial de VM inválido.');
    p.valueHistory.forEach((h) => {
      integer(h.at, 'VM.at');
      integer(h.value, 'VM.value');
    });
  }
  const clubRef = (id: string | null) =>
    invariant(id === null || clubs.has(id), 'Referencia a club inexistente.');
  const playerRef = (id: string | null) =>
    invariant(id === null || players.has(id), 'Referencia a futbolista inexistente.');
  const owned = new Set<string>();
  for (const c of s.contracts) {
    clubRef(c.clubId);
    playerRef(c.playerId);
    invariant(!owned.has(c.playerId), 'Futbolista con dos propietarios.');
    owned.add(c.playerId);
    integer(c.salaryBps, 'salario');
    integer(c.clause, 'cláusula');
    integer(c.endsAt, 'contrato');
    invariant(c.salaryBps >= 50 && c.salaryBps <= 1000, 'Salario inválido.');
    if (c.loan) clubRef(c.loan.from);
  }
  for (const c of s.clubs) {
    invariant(
      REAL_CLUBS.some((r) => r.id === c.favorite) && COACHES.some((r) => r.id === c.coach),
      'Club o entrenador inválido.',
    );
    for (const r of ['money', 'development', 'medals', 'fame', 'prestige', 'luck', 'fans'] as const)
      integer(c.resources[r], r);
    for (const [key, level] of Object.entries(c.buildings))
      invariant(
        BUILDINGS.some(
          (b) => b.id === key && Number.isInteger(level) && level >= 1 && level <= b.max,
        ),
        'Edificio inválido.',
      );
    for (const [key, level] of Object.entries(c.facilities))
      invariant(
        FACILITIES.some(
          (b) => b.id === key && Number.isInteger(level) && level >= 0 && level <= b.max,
        ),
        'Instalación inválida.',
      );
    for (const [key, level] of Object.entries(c.research))
      invariant(
        RESEARCH.some(
          (b) => b.id === key && Number.isInteger(level) && level >= 0 && level <= b.maxLevel,
        ),
        'Investigación inválida.',
      );
    for (const id of [...c.selection.starters.map((p) => p.playerId), ...c.selection.bench]) {
      playerRef(id);
      invariant(
        id === null || s.contracts.some((ct) => ct.playerId === id && ct.clubId === c.id),
        'Convocatoria sin contrato.',
      );
    }
  }
  s.marketPlayers.forEach(playerRef);
  s.draft.queue.forEach(playerRef);
  for (const j of s.jobs) {
    clubRef(j.clubId);
    integer(j.endsAt, 'job.endsAt');
    invariant(
      j.kind === 'academy'
        ? j.target === 'academy'
        : j.kind === 'building'
          ? BUILDINGS.some((d) => d.id === j.target)
          : j.kind === 'facility'
            ? FACILITIES.some((d) => d.id === j.target)
            : j.kind === 'research' && RESEARCH.some((d) => d.id === j.target),
      'Trabajo con tipo u objetivo desconocido.',
    );
    invariant(
      j.endsAt > j.startedAt && j.endsAt > s.now,
      'Hay trabajos vencidos: exporta un checkpoint local actualizado.',
    );
  }
  for (const b of s.bids) {
    clubRef(b.clubId);
    playerRef(b.playerId);
    integer(b.amount, 'puja');
  }
  for (const a of s.auctions) {
    clubRef(a.clubId);
    playerRef(a.playerId);
    a.bids.forEach((b) => clubRef(b.clubId));
    invariant(a.status !== 'open' || a.endsAt > s.now, 'Hay subastas vencidas.');
  }
  invariant(
    s.rounds.some((r) => r.number === s.currentRound),
    'Jornada actual inexistente.',
  );
  for (const r of s.rounds) {
    Object.keys(r.reports).forEach(clubRef);
    Object.keys(r.scores).forEach(playerRef);
    for (const m of r.matches)
      invariant(
        REAL_CLUBS.some((c) => c.id === m.home) &&
          REAL_CLUBS.some((c) => c.id === m.away) &&
          m.endsAt > m.startsAt,
        'Partido inválido.',
      );
    if (r.number === s.currentRound && !s.draft.active) {
      invariant(
        s.processed.includes(`lock:${s.season}:${r.number}`) || r.locksAt > s.now,
        'Hay cierres de jornada vencidos.',
      );
      invariant(
        r.matches.every((m) =>
          m.status === 'scheduled' ? m.startsAt > s.now : m.status !== 'live' || m.endsAt > s.now,
        ),
        'Hay partidos vencidos.',
      );
    }
  }
  for (const list of [s.ledger, s.news, s.chat, s.sponsors, s.concerts, s.loans])
    for (const row of list) if (row.clubId !== undefined) clubRef(row.clubId!);
  for (const n of s.negotiations) {
    clubRef(n.from);
    clubRef(n.to);
    playerRef(n.playerId);
    if (n.offeredPlayerId) playerRef(n.offeredPlayerId);
  }
  for (const t of s.transfers) {
    clubRef(t.from);
    clubRef(t.to);
    playerRef(t.playerId);
  }
  invariant(
    s.nextMarketAt > s.now && s.lastDaily === dailyKey(s.now),
    'El checkpoint diario está vencido: actualízalo en local antes de exportar.',
  );
  for (const c of s.clubs) publicState(s, c.userId);
}

const timeKeys = new Set([
  'at',
  'now',
  'seasonStartedAt',
  'seasonEndsAt',
  'nextMarketAt',
  'startsAt',
  'endsAt',
  'locksAt',
  'startedAt',
  'createdAt',
  'shieldUntil',
  'lastInstitution',
  'claimedAt',
  'firstSeenAt',
  'resolvedAt',
]);
/** Rebase a coherent checkpoint; do not replay historical jobs or grant rewards. */
export function prepareDemo(config: DemoConfig, snapshot: DemoSnapshot, start: number) {
  const source = snapshot.state;
  validateDemo(source);
  invariant(Number.isSafeInteger(start), 'Inicio temporal inválido.');
  invariant(
    snapshot.sha256 === digest({ state: source, presidents: snapshot.presidents }),
    'La huella de la instantánea no coincide.',
  );
  const offset = start - source.now;
  const days = (Date.parse(dailyKey(start)) - Date.parse(dailyKey(source.now))) / DAY;
  const ids = new Map([[source.id, config.leagueId]]);
  const renameIds = (v: string) =>
    v.replace(uuidPattern, (id) => {
      if (!ids.has(id)) ids.set(id, stableId(`${config.leagueId}:${config.seed}:${id}`));
      return ids.get(id)!;
    });
  const state: GameState = walk(source, (v, key) => {
    if (typeof v === 'number' && timeKeys.has(key) && v !== 0) return v + offset;
    if (typeof v !== 'string') return v;
    if (literalKeys.has(key)) return v;
    let result = renameIds(v);
    if (['$key', 'offerDay', 'lastPaidDay', 'lastDaily'].includes(key))
      result = result.replace(/\d{4}-\d{2}-\d{2}/g, (d) =>
        new Date(Date.parse(d) + days * DAY).toISOString().slice(0, 10),
      );
    return result;
  });
  // notificationReads stores timestamps as values under notification IDs.
  for (let i = 0; i < state.clubs.length; i++) {
    const before = source.clubs[i].notificationReads;
    if (before)
      state.clubs[i].notificationReads = Object.fromEntries(
        Object.entries(before).map(([k, v]) => [
          renameIds(k).replace(/\d{4}-\d{2}-\d{2}/g, (d) =>
            new Date(Date.parse(d) + days * DAY).toISOString().slice(0, 10),
          ),
          v + offset,
        ]),
      );
  }
  state.now = start;
  state.timeOffset = 0;
  state.version = 1;
  state.lastDaily = dailyKey(start);
  state.nextMarketAt = nextMarket(start);
  state.privateRng = 'rotated-by-postgresql-on-create';
  state.invite = 'assigned-by-postgresql';
  const bindings = slots.map((slot) => {
    const club = state.clubs.find((c) => c.userId === slot)!;
    const reservedUserId = `reserved-demo:${config.leagueId}:${slot}`;
    const userId = config.users[slot] || null;
    club.userId = userId || reservedUserId;
    club.presidentName = snapshot.presidents[slot];
    return { slot, clubId: club.id, reservedUserId, userId, presidentName: club.presidentName };
  });
  state.adminId = config.adminUserId;
  syncAttention(state);
  const sourceHash = snapshot.sha256;
  // A renamed snapshot file or a later user association does not change its identity.
  const requestHash = digest({
    environment: config.environment,
    projectRef: config.projectRef,
    leagueId: config.leagueId,
    adminUserId: config.adminUserId,
    mode: config.mode,
    seed: config.seed,
    startAt: config.startAt,
    sourceHash,
    format: 1,
  });
  invariant(
    Number.isFinite(nextWake(state)) && nextWake(state) > start,
    'El plan contiene tareas vencidas.',
  );
  return {
    state,
    slots: bindings,
    requestHash,
    sourceHash,
    mode: config.mode,
    due: new Date(nextWake(state)).toISOString(),
  };
}
export type DemoPlan = ReturnType<typeof prepareDemo>;
export function summary(state: GameState) {
  return {
    league: state.id,
    name: state.name,
    players: state.players.length,
    clubs: state.clubs.length,
    contracts: state.contracts.length,
    draft: state.draft.active ? 'pending' : 'finished',
    jobs: state.jobs.length,
    researches: state.clubs.reduce((n, c) => n + Object.keys(c.research).length, 0),
    rounds: state.rounds.length,
    news: state.news.length,
    chat: state.chat.length,
    sponsors: state.sponsors.length,
    concerts: state.concerts.length,
    startAt: new Date(state.now).toISOString(),
    nextDue: new Date(nextWake(state)).toISOString(),
    presidents: state.clubs.map((c) => ({
      club: c.name,
      president: c.presidentName,
      resources: c.resources,
      assigned: !c.userId.startsWith('reserved-demo:'),
    })),
  };
}
