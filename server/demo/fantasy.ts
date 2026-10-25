import { RULES } from '../../shared/config.js';
import { populateFantasy } from '../../shared/fantasy.js';
import { z } from 'zod';
import { roster, REAL_CLUBS } from '../../shared/sports.js';
import { FORMATION_CATALOG } from '../../shared/formations.js';
import { invariant } from '../../shared/math.js';
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
  populateFantasy(state, config);
  for (const club of state.clubs)
    invariant(
      callCost(state, club).cost <= club.resources.money,
      'Dotación insuficiente para la convocatoria.',
    );
  syncAttention(state);
  validateDemo(state);
  return snapshotOf(state, 'generated-local-demo');
}
