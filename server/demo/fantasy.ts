import { z } from 'zod';
import { roster, REAL_CLUBS } from '../../shared/sports.js';
import { FORMATION_CATALOG } from '../../shared/formations.js';
import { RULES, euro } from '../../shared/config.js';
import { capacity, invariant } from '../../shared/math.js';
import { callCost, syncAttention } from '../../shared/engine.js';
import { generatedDemo, snapshotOf, validateDemo } from './state.js';
const identity = z
  .object({
    reference: z.string().min(1),
    playerId: z.string().nullable(),
    realClubId: z.string().nullable(),
    fullName: z.string().nullable(),
    position: z.enum(['POR', 'DEF', 'MED', 'DEL']).nullable(),
    pending: z.string().optional(),
  })
  .strict();
export const fantasySchema = z
  .object({
    format: z.literal('monigones-fantasy-teams-v06'),
    season: z.literal('2026/27'),
    initialMoneyEuros: z.number().int().min(0).max(100_000_000),
    reservedName: z.string().min(3).max(40),
    teams: z
      .array(
        z
          .object({
            slot: z.enum(['demo1', 'demo2', 'demo3', 'demo4', 'demo5']),
            name: z.string().min(3).max(40),
            favorite: z.string(),
            formation: z.string(),
            starters: z.array(identity).length(11),
            bench: z.array(identity).max(4),
          })
          .strict(),
      )
      .length(5),
  })
  .strict();
export function previewFantasy(input: unknown) {
  const config = fantasySchema.parse(input),
    catalog = roster(0),
    problems: string[] = [],
    owned = new Set<string>();
  if (new Set(config.teams.map((t) => t.slot)).size !== 5) problems.push('Presidentes repetidos.');
  for (const team of config.teams) {
    if (!REAL_CLUBS.some((c) => c.id === team.favorite))
      problems.push(`${team.name}: club favorito desconocido.`);
    const positions = FORMATION_CATALOG.find((f) => f.id === team.formation)?.positions;
    if (!positions) problems.push(`${team.name}: formación desconocida.`);
    for (const row of [...team.starters, ...team.bench]) {
      if (!row.playerId) {
        problems.push(`${team.name}: ${row.reference}: ${row.pending || 'Identidad pendiente.'}`);
        continue;
      }
      const player = catalog.find((p) => p.id === row.playerId);
      if (
        !player ||
        player.fullName !== row.fullName ||
        player.realClubId !== row.realClubId ||
        player.position !== row.position
      )
        problems.push(`${team.name}: identidad, club o posición no coinciden: ${row.reference}.`);
      if (owned.has(row.playerId))
        problems.push(`${team.name}: futbolista duplicado: ${row.reference}.`);
      owned.add(row.playerId);
    }
    if (positions && team.starters.every((r) => r.playerId)) {
      for (const pos of ['POR', 'DEF', 'MED', 'DEL'])
        if (
          team.starters.filter((r) => r.position === pos).length !==
          positions.filter((p) => p === pos).length
        )
          problems.push(`${team.name}: distribución incompatible con ${team.formation}: ${pos}.`);
    }
    if (new Set(team.bench.map((r) => r.position)).size !== team.bench.length)
      problems.push(`${team.name}: solo un suplente por demarcación.`);
    if (team.starters.length + team.bench.length > RULES.maxCapacity)
      problems.push(`${team.name}: plantilla completa.`);
  }
  return {
    complete: !problems.length,
    problems,
    config,
    players: owned.size,
    clubs: 6,
    reservedRoster: 0,
  };
}
/** No network or database. A missing identity prevents creation of any snapshot. */
export function fantasySnapshot(input: unknown, at: number, seed: string) {
  const report = previewFantasy(input);
  invariant(report.complete, report.problems.join('\n'));
  const state = generatedDemo('initial', at, seed),
    config = report.config;
  state.name = 'Monigones · Fantasy v0.6';
  state.draft = { active: false, finished: true, queue: [] };
  state.contracts = [];
  state.ledger = [];
  state.transfers = [];
  state.chat = [];
  state.news = [
    {
      id: state.id,
      at,
      category: 'Liga',
      title: 'Nueva liga Fantasy de demostración',
      subtitle: 'Identidades reales; valores, contratos y resultados propios del simulador.',
    },
  ];
  for (const club of state.clubs) {
    club.resources.money = euro(config.initialMoneyEuros);
    const team = config.teams.find((t) => t.slot === club.userId);
    club.name = team?.name || config.reservedName;
    state.ledger.push({
      id: `grant-${club.id}`,
      at,
      season: 1,
      clubId: club.id,
      resource: 'money',
      amount: club.resources.money,
      balance: club.resources.money,
      reason: 'Dotación inicial de la nueva demo personalizada',
    });
    if (!team) continue;
    club.favorite = team.favorite;
    const formation = FORMATION_CATALOG.find((f) => f.id === team.formation)!;
    club.buildings.hq = 4;
    club.buildings.stadium = 4;
    club.facilities = {
      pitch: formation.pitch,
      locker: Math.max(0, team.starters.length + team.bench.length - RULES.initialCapacity),
      bench: team.bench.length ? 4 : 0,
    };
    invariant(
      team.starters.length + team.bench.length <= capacity(club),
      'Plantilla sin capacidad.',
    );
    const remaining = [...team.starters];
    club.selection.formation = team.formation;
    club.selection.starters = formation.positions.map((position) => {
      const index = remaining.findIndex((p) => p.position === position);
      invariant(index >= 0, 'Demarcación sin titular.');
      const [row] = remaining.splice(index, 1);
      return { position, playerId: row.playerId, quality: 0, unlockedQuality: 0 };
    });
    club.selection.bench = team.bench.map((r) => r.playerId!);
    for (const row of [...team.starters, ...team.bench]) {
      const player = state.players.find((p) => p.id === row.playerId)!;
      state.contracts.push({
        playerId: player.id,
        clubId: club.id,
        salaryBps: RULES.baseSalary,
        happiness: 75,
        missed: 0,
        clause: player.value * 2,
        shieldUntil: 0,
        endsAt: state.seasonEndsAt,
      });
      state.transfers.push({
        id: `assignment-${player.id}`,
        at,
        playerId: player.id,
        from: null,
        to: club.id,
        amount: 0,
        kind: 'Asignación de demostración personalizada',
      });
    }
    const quotation = callCost(state, club);
    invariant(
      quotation.cost <= club.resources.money,
      'Dotación insuficiente para la convocatoria.',
    );
  }
  state.marketPlayers = state.players
    .filter((p) => !state.contracts.some((c) => c.playerId === p.id))
    .slice(0, RULES.marketSize)
    .map((p) => p.id);
  syncAttention(state);
  validateDemo(state);
  return snapshotOf(state, 'generated-local-demo');
}
