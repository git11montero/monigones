import type { Club, GameState } from './types.js';
import { callCost, effects } from './engine.js';
import { HOUR, RULES } from './config.js';
export function matchdaySummary(state: GameState, club: Club) {
  const current = state.rounds.find((r) => r.number === state.currentRound) || state.rounds.at(-1);
  const last = state.rounds.filter((r) => r.settled).at(-1);
  const endedAt = last ? Math.max(...last.matches.map((m) => m.endsAt)) : 0;
  const round =
    current?.status === 'upcoming' && last && state.now < endedAt + 24 * HOUR ? last : current;
  if (!round) return null;
  const status = round.settled ? 'Finalizada' : round.status === 'live' ? 'En curso' : 'Previa';
  const next = state.rounds.find((r) => r.number > round.number && !r.settled);
  const candidates = round.matches
    .flatMap((m) =>
      m.status === 'live'
        ? [{ at: m.endsAt, label: 'Fin de partido' }]
        : m.status === 'scheduled'
          ? [{ at: m.startsAt, label: 'Próximo partido' }]
          : [],
    )
    .filter((e) => e.at > state.now)
    .sort((a, b) => a.at - b.at);
  const event = round.settled
    ? next
      ? { at: next.locksAt, label: 'Próxima convocatoria' }
      : null
    : round.status === 'upcoming'
      ? {
          at: state.now < round.locksAt ? round.locksAt : round.startsAt,
          label: state.now < round.locksAt ? 'Cierre de convocatoria' : 'Primer partido',
        }
      : candidates[0] || null;
  const ids = club.selection.starters.flatMap((s) => (s.playerId ? [s.playerId] : []));
  const pending = ids.filter((id) => {
    const player = state.players.find((p) => p.id === id);
    return (
      player &&
      round.matches.find((m) => m.home === player.realClubId || m.away === player.realClubId)
        ?.status !== 'finished'
    );
  }).length;
  const report = round.reports[club.id];
  const ranking = state.clubs.toSorted(
    (a, b) =>
      (round.reports[b.id]?.points || 0) - (round.reports[a.id]?.points || 0) ||
      a.id.localeCompare(b.id),
  );
  let cost: number | undefined,
    costError = '';
  try {
    cost = club.selection.locked ? club.selection.cost : callCost(state, club).cost;
  } catch (error) {
    costError = (error as Error).message;
  }
  return {
    round,
    status,
    event,
    report,
    pending,
    cost,
    costError,
    called: ids.length + club.selection.bench.length,
    starters: ids.length,
    bench: club.selection.bench.length,
    points: round.settled
      ? report?.points
      : ids.reduce((n, id) => n + (round.scores[id]?.points || 0), 0),
    rank: round.settled && report ? ranking.findIndex((c) => c.id === club.id) + 1 : undefined,
    manual:
      club.selection.locked && club.selection.valid && !round.settled
        ? Math.max(0, effects(club).manual - club.selection.manual)
        : 0,
    auto:
      club.selection.locked && club.selection.valid && !round.settled
        ? Math.max(
            0,
            RULES.bench[Math.min(7, club.facilities.bench || 0)][1] -
              (report?.substitutions.filter((s) => !s.manual).length || 0),
          )
        : 0,
  };
}
