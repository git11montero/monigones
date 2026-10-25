import source from '../data/demo-fantasy-v06.json' with { type: 'json' };
import { FORMATION_CATALOG } from './formations.js';
import { RULES, euro } from './config.js';
import { capacity, invariant } from './math.js';
import type { GameState } from './types.js';
export const DEFAULT_FANTASY = source;
export type FantasySource = {
  initialMoneyEuros: number;
  reservedName: string;
  teams: {
    slot: string;
    name: string;
    favorite: string;
    formation: string;
    starters: { playerId: string | null; position: string | null }[];
    bench: { playerId: string | null; position: string | null }[];
  }[];
};
/** Browser-safe shared initialization; no persistence or clock advancement. */
export function populateFantasy(state: GameState, config: FantasySource = source) {
  const at = state.now;
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
  }
  state.marketPlayers = state.players
    .filter((p) => !state.contracts.some((c) => c.playerId === p.id))
    .slice(0, RULES.marketSize)
    .map((p) => p.id);
  return state;
}
