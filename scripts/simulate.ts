import { writeFileSync } from 'node:fs';
import { createGame } from '../shared/seed';
import { dailyActions, execute, reconcile } from '../shared/engine';
import { DAY } from '../shared/config';
import { money } from '../shared/math';
const scenarios = [];
for (const strategy of ['base', 'social', 'development']) {
  let state = createGame(Date.parse('2026-08-01T10:00:00Z'));
  for (const [i, c] of state.clubs.entries())
    state = JSON.parse(JSON.stringify(state).replaceAll(c.id, `club-${i + 1}`));
  state.id = 'simulation-seed-2026';
  state.privateRng = 'season-audit';
  let minBalance = Infinity;
  const violations: string[] = [];
  for (let day = 0; day < 266; day++) {
    for (const club of state.clubs) {
      const actor = { userId: club.userId, clubId: club.id, admin: club.userId === state.adminId };
      if (strategy !== 'base')
        for (const a of dailyActions(state)) {
          try {
            execute(state, actor, { type: 'daily', id: a.id });
          } catch {
            /* Actividad ya completada o coste no disponible. */
          }
        }
      if (strategy === 'development') {
        if (
          !club.research.accounting &&
          !state.jobs.some((j) => j.clubId === club.id && j.kind === 'research')
        )
          try {
            execute(state, actor, { type: 'research', target: 'accounting' });
          } catch {}
        if (
          club.buildings.hq < 3 &&
          !state.jobs.some((j) => j.clubId === club.id && j.kind === 'building')
        )
          try {
            execute(state, actor, { type: 'build', target: 'hq' });
          } catch {}
      }
    }
    reconcile(state, state.now + DAY);
    for (const c of state.clubs) {
      minBalance = Math.min(minBalance, c.resources.money);
      if (!Number.isSafeInteger(c.resources.money)) violations.push('Saldo no entero');
    }
    if (new Set(state.contracts.map((ct) => ct.playerId)).size !== state.contracts.length)
      violations.push('Propiedad duplicada');
  }
  const result = {
    strategy,
    days: 266,
    settledRounds: state.rounds.filter((r) => r.settled).length,
    minBalance,
    minFinal: Math.min(...state.clubs.map((c) => c.resources.money)),
    maxFinal: Math.max(...state.clubs.map((c) => c.resources.money)),
    averageFinal: Math.round(
      state.clubs.reduce((n, c) => n + c.resources.money, 0) / state.clubs.length,
    ),
    development: state.clubs[0].resources.development,
    violations,
  };
  scenarios.push(result);
  console.log(
    `${strategy}: ${result.settledRounds} jornadas · saldo medio ${money(result.averageFinal)} · mínimo ${money(result.minBalance)} · incidencias ${violations.length}`,
  );
  if (result.settledRounds !== 38 || violations.length) process.exitCode = 1;
}
writeFileSync(
  'docs/simulation-results.json',
  JSON.stringify({ seed: '2026-08-01 / season-audit', moneyUnit: 'céntimos', scenarios }, null, 2) +
    '\n',
);
