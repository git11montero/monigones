import { describe, it, expect } from 'vitest';
import {
  FORMATION_CATALOG,
  FORMATIONS,
  formationAllowed,
  formationRows,
  selectionFormation,
} from '../shared/formations';
import { createGame } from '../shared/seed';
import { autoSubs, callCost, execute, lockRound, publicState, settleRound } from '../shared/engine';
import { matchdaySummary } from '../shared/matchday-summary';
import { RULES, RESEARCH } from '../shared/config';
import { roundRatio } from '../shared/math';
import type { GameState } from '../shared/types';
const start = Date.parse('2026-10-24T10:00:00Z');
function fixture() {
  const state = createGame(start, true),
    club = state.clubs[0];
  club.facilities.pitch = 4;
  club.facilities.locker = 18;
  club.facilities.bench = 7;
  const actor = { userId: club.userId, clubId: club.id, admin: true };
  for (const [position, count] of [
    ['POR', 2],
    ['DEF', 6],
    ['MED', 7],
    ['DEL', 5],
  ] as const) {
    while (
      state.contracts.filter(
        (ct) =>
          ct.clubId === club.id &&
          state.players.find((p) => p.id === ct.playerId)!.position === position,
      ).length < count
    ) {
      const p = state.players.find(
        (p) => p.position === position && !state.contracts.some((ct) => ct.playerId === p.id),
      )!;
      state.contracts.push({
        playerId: p.id,
        clubId: club.id,
        salaryBps: 200,
        happiness: 75,
        missed: 0,
        clause: p.value * 2,
        shieldUntil: 0,
        endsAt: state.seasonEndsAt,
      });
    }
  }
  const command = (data: Record<string, unknown>) => execute(state, actor, data as any);
  return { state, club, actor, command };
}
describe('catálogo táctico v0.5', () => {
  it('ofrece 14 sistemas válidos y excluye explícitamente los doce titulares de 3-4-4', () => {
    expect(FORMATION_CATALOG).toHaveLength(14);
    expect(FORMATIONS['3-4-4']).toBeUndefined();
    for (const f of FORMATION_CATALOG) {
      expect(f.positions).toHaveLength(11);
      expect(f.positions.filter((p) => p === 'POR')).toHaveLength(1);
      expect(
        formationRows(f)
          .flat()
          .sort((a, b) => a - b),
      ).toEqual(Array.from({ length: 11 }, (_, i) => i));
      for (let pitch = 0; pitch <= 4; pitch++)
        expect(formationAllowed(f.id, pitch)).toBe(pitch >= f.pitch);
    }
    expect(FORMATION_CATALOG.filter((f) => f.pitch === 4).map((f) => f.id)).toEqual([
      '4-2-4',
      '3-3-4',
    ]);
    expect(formationAllowed('__proto__', 4)).toBe(false);
  });
  it.each(FORMATION_CATALOG.map((f) => [f.id, f] as const))(
    '%s: validación autoritativa, plazas, coste, calidad, banquillo y persistencia',
    (_id, f) => {
      const { state, club, command } = fixture();
      if (f.pitch > 0) {
        club.facilities.pitch = f.pitch - 1;
        const before = structuredClone(club.selection);
        expect(() => command({ type: 'formation', formation: f.id })).toThrow(/bloqueada/);
        expect(club.selection).toEqual(before);
      }
      club.facilities.pitch = 4;
      club.selection.starters.forEach((s, i) => {
        s.quality = i % 4;
        s.unlockedQuality = 3;
      });
      const quality = club.selection.starters.map((s) => s.quality);
      command({ type: 'formation', formation: f.id });
      command({ type: 'autoLineup' });
      expect(club.selection.starters.map((s) => s.position)).toEqual(f.positions);
      expect(club.selection.starters.map((s) => s.quality)).toEqual(quality);
      expect(new Set(club.selection.starters.map((s) => s.playerId)).size).toBe(11);
      for (const position of ['POR', 'DEF', 'MED', 'DEL']) {
        const spare = state.players.find(
          (p) =>
            p.position === position &&
            state.contracts.some((ct) => ct.playerId === p.id && ct.clubId === club.id) &&
            !club.selection.starters.some((s) => s.playerId === p.id),
        )!;
        command({ type: 'bench', playerId: spare.id });
      }
      expect(club.selection.bench).toHaveLength(4);
      const result = callCost(state, club),
        roster = [...club.selection.starters.map((s) => s.playerId!), ...club.selection.bench];
      const expected = roster.reduce((n, id) => {
        const player = state.players.find((p) => p.id === id)!,
          contract = state.contracts.find((ct) => ct.playerId === id)!;
        const slot = club.selection.starters.find((s) => s.playerId === id);
        return (
          n + roundRatio(player.value, contract.salaryBps + RULES.qualitySalary[slot?.quality || 0])
        );
      }, 0);
      expect(result.cost).toBe(expected);
      const loaded = JSON.parse(JSON.stringify(state)) as GameState;
      expect(selectionFormation(loaded.clubs[0].selection)?.id).toBe(f.id);
      expect(callCost(loaded, loaded.clubs[0])).toEqual(result);
      const r = loaded.rounds[0],
        scoringClub = loaded.clubs[0];
      lockRound(loaded, r);
      for (const m of r.matches) m.status = 'finished';
      for (const p of loaded.players)
        r.scores[p.id] = { playerId: p.id, points: 500, minutes: 90, goals: 0, assists: 0 };
      settleRound(loaded, r);
      expect(r.reports[scoringClub.id].salary).toBe(result.cost);
      expect(r.reports[scoringClub.id].detail.map((d) => d.final)).toEqual(
        quality.map((q) => Math.round((500 * (10000 + RULES.qualityBonus[q])) / 10000)),
      );
      club.selection.bench.push(roster[0]);
      expect(() => callCost(state, club)).toThrow(/dos plazas/);
    },
  );
  it('las cinco formaciones antiguas conservan slots, jugadores, calidad y convocatorias congeladas al leerlas', () => {
    for (const id of ['4-4-2', '4-3-3', '3-5-2', '3-4-3', '5-3-2']) {
      const { state, club, command } = fixture();
      command({ type: 'formation', formation: id });
      command({ type: 'autoLineup' });
      delete club.selection.formation;
      const before = JSON.stringify(club.selection);
      expect(selectionFormation(club.selection)?.id).toBe(id);
      expect(JSON.stringify(club.selection)).toBe(before);
      lockRound(state, state.rounds[0]);
      const frozen = structuredClone(club.selection);
      expect(() => command({ type: 'formation', formation: '4-3-3' })).toThrow(/cerrada/);
      expect(club.selection).toEqual(frozen);
    }
  });
  it('distingue filas de 4-5-1 y 4-2-3-1, conserva compatibles, y mantiene la táctica entre jornadas', () => {
    const { state, club, command } = fixture();
    command({ type: 'formation', formation: '4-5-1' });
    command({ type: 'autoLineup' });
    const before = structuredClone(club.selection.starters);
    command({ type: 'formation', formation: '4-2-3-1' });
    expect(club.selection.starters).toEqual(before);
    expect(formationRows(selectionFormation(club.selection)!).map((r) => r.length)).toEqual([
      1, 3, 2, 4, 1,
    ]);
    const r = state.rounds[0];
    lockRound(state, r);
    for (const m of r.matches) m.status = 'finished';
    for (const p of state.players)
      r.scores[p.id] = { playerId: p.id, points: 500, minutes: 90, goals: 0, assists: 0 };
    settleRound(state, r);
    expect(selectionFormation(club.selection)?.id).toBe('4-2-3-1');
    expect(club.selection.starters).toEqual(before);
    const report = r.reports[club.id];
    expect(report.detail).toHaveLength(11);
    expect(report.detail.reduce((n, d) => n + d.final, 0)).toBe(report.points);
  });
  it('rechaza doce titulares y no divulga la táctica rival antes del cierre', () => {
    const { state, club, command } = fixture();
    command({ type: 'formation', formation: '4-2-3-1' });
    const rival = state.clubs[1];
    expect(
      publicState(state, rival.userId).state.clubs.find((c) => c.id === club.id)!.selection
        .formation,
    ).toBeUndefined();
    club.selection.starters.push({ ...club.selection.starters[0] });
    expect(() => callCost(state, club)).toThrow(/once titulares/);
  });
});
describe('sustituciones con todas las nuevas distribuciones', () => {
  it.each(
    FORMATION_CATALOG.flatMap((f) =>
      (['auto', 'manual'] as const).map((mode) => [f.id, mode] as const),
    ),
  )('%s: cambio %s sin duplicar ni cambiar casillas', (formation, mode) => {
    const { state, club, command } = fixture();
    command({ type: 'formation', formation });
    command({ type: 'autoLineup' });
    const r = state.rounds[0],
      outSlot = club.selection.starters.find((s) => s.position === 'MED')!;
    const out = state.players.find((p) => p.id === outSlot.playerId)!;
    const spare = state.players.find(
      (p) =>
        p.position === 'MED' &&
        p.realClubId !== out.realClubId &&
        !r.matches.some(
          (m) =>
            (m.home === out.realClubId || m.away === out.realClubId) &&
            (m.home === p.realClubId || m.away === p.realClubId),
        ) &&
        !state.contracts.some((ct) => ct.playerId === p.id),
    )!;
    const contract = state.contracts.find((ct) => ct.clubId === club.id)!;
    state.contracts.push({ ...contract, playerId: spare.id });
    command({ type: 'bench', playerId: spare.id });
    if (mode === 'manual') club.research[RESEARCH.find((r) => (r.effects.manual || 0) > 0)!.id] = 1;
    const oldQuality = outSlot.quality;
    lockRound(state, r);
    const outMatch = r.matches.find((m) => m.home === out.realClubId || m.away === out.realClubId)!;
    const inMatch = r.matches.find(
      (m) => m.home === spare.realClubId || m.away === spare.realClubId,
    )!;
    outMatch.status = 'finished';
    inMatch.status = 'finished';
    r.scores[out.id] = { playerId: out.id, minutes: 0, points: 0, goals: 0, assists: 0 };
    r.scores[spare.id] = { playerId: spare.id, minutes: 90, points: 600, goals: 0, assists: 0 };
    if (mode === 'manual') {
      inMatch.status = 'scheduled';
      inMatch.startsAt = state.now + 3600000;
      command({
        type: 'manualSub',
        slot: club.selection.starters.indexOf(outSlot),
        playerId: spare.id,
      });
      expect(() =>
        command({
          type: 'manualSub',
          slot: club.selection.starters.indexOf(outSlot),
          playerId: spare.id,
        }),
      ).toThrow();
    } else {
      autoSubs(state, club, r);
      autoSubs(state, club, r);
    }
    expect(outSlot.playerId).toBe(spare.id);
    expect(outSlot.quality).toBe(oldQuality);
    expect(r.reports[club.id].substitutions).toHaveLength(1);
    expect(new Set(club.selection.starters.map((s) => s.playerId)).size).toBe(11);
  });
});
describe('resumen de jornada desde datos reales', () => {
  it('muestra convocatoria previa, evento correcto y puntos provisionales; después conserva el informe final', () => {
    const { state, club } = fixture(),
      r = state.rounds[0];
    let info = matchdaySummary(state, club)!;
    expect(info.status).toBe('Previa');
    expect(info.event?.at).toBe(r.locksAt);
    state.now = r.locksAt + 1;
    info = matchdaySummary(state, club)!;
    expect(info.event?.at).toBe(r.startsAt);
    r.status = 'live';
    r.matches[0].status = 'live';
    state.now = r.startsAt + 1;
    const id = club.selection.starters[0].playerId!;
    r.scores[id] = { playerId: id, minutes: 45, points: 123, goals: 0, assists: 0 };
    info = matchdaySummary(state, club)!;
    expect(info.status).toBe('En curso');
    expect(info.points).toBe(123);
    expect(info.event!.at).toBeGreaterThan(state.now);
    for (const m of r.matches) m.status = 'finished';
    settleRound(state, r);
    state.now = Math.max(...r.matches.map((m) => m.endsAt)) + 1;
    info = matchdaySummary(state, club)!;
    expect(info.status).toBe('Finalizada');
    expect(info.round.number).toBe(r.number);
    expect(info.report).toBe(r.reports[club.id]);
  });
});
