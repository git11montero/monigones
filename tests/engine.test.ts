import { describe, it, expect, beforeEach } from 'vitest';
import { createGame } from '../shared/seed';
import {
  autoSubs,
  available,
  callCost,
  dailyActions,
  effects,
  execute,
  jobQuote,
  lockRound,
  publicState,
  reconcile,
  rosterUsage,
  settleRound,
} from '../shared/engine';
import { acceptance, dailyKey, nextMarket, score } from '../shared/math';
import { DAY, HOUR, euro, RESEARCH, RULES } from '../shared/config';
import type { Actor, Club, Command, GameState, Player } from '../shared/types';
let s: GameState, c: Club, actor: Actor;
const start = Date.parse('2026-10-23T10:00:00Z');
beforeEach(() => {
  s = createGame(start);
  c = s.clubs[0];
  actor = { userId: c.userId, clubId: c.id, admin: true };
});
const cmd = (command: Command) => execute(s, actor, command);
function round() {
  return s.rounds.find((r) => r.number === s.currentRound)!;
}
function finish(r = round()) {
  lockRound(s, r);
  for (const m of r.matches) m.status = 'finished';
  for (const p of s.players)
    r.scores[p.id] = { playerId: p.id, points: 500, minutes: 90, goals: 0, assists: 0 };
  settleRound(s, r);
}
function spare(position: Player['position'] = 'POR') {
  const p = s.players.find(
    (p) => p.position === position && !s.contracts.some((ct) => ct.playerId === p.id),
  )!;
  s.contracts.push({
    playerId: p.id,
    clubId: c.id,
    salaryBps: 200,
    happiness: 75,
    missed: 0,
    clause: p.value * 2,
    shieldUntil: 0,
    endsAt: s.seasonEndsAt,
  });
  return p;
}
describe('horario autoritativo', () => {
  it('cierra exactamente a las seis de Madrid', () => {
    expect(new Date(nextMarket(Date.parse('2026-10-23T03:59:59Z'))).toISOString()).toBe(
      '2026-10-23T04:00:00.000Z',
    );
    expect(new Date(nextMarket(Date.parse('2026-10-23T04:00:00Z'))).toISOString()).toBe(
      '2026-10-24T04:00:00.000Z',
    );
  });
  it('respeta el cambio a horario de invierno', () => {
    const a = nextMarket(Date.parse('2026-10-24T04:00:01Z'));
    expect(new Date(a).toISOString()).toBe('2026-10-25T05:00:00.000Z');
    expect(a - Date.parse('2026-10-24T04:00:00Z')).toBe(25 * HOUR);
  });
  it('respeta el cambio de verano de marzo', () => {
    expect(new Date(nextMarket(Date.parse('2027-03-27T05:00:01Z'))).toISOString()).toBe(
      '2027-03-28T04:00:00.000Z',
    );
  });
  it('mantiene las mismas actividades entre medianoche y las seis', () => {
    expect(dailyKey(Date.parse('2026-10-23T23:30:00Z'))).toBe('2026-10-23');
    expect(dailyKey(Date.parse('2026-10-24T04:00:00Z'))).toBe('2026-10-24');
  });
  it('concede desarrollo diario una sola vez por ciclo', () => {
    const before = c.resources.development;
    reconcile(s, s.nextMarketAt + 1);
    expect(c.resources.development).toBe(before + 100);
    reconcile(s, s.now);
    expect(c.resources.development).toBe(before + 100);
  });
});
describe('mercado, presupuesto y contratos', () => {
  it('aplica la fórmula de rechazo y atractivo', () => {
    expect(acceptance(100, 100, 200, 0).rejection).toBe(50);
    expect(acceptance(100, 100, 1000, 0).rejection).toBe(2);
    expect(acceptance(100, 110, 200, 100).rejection).toBeCloseTo(35);
  });
  it('reserva presupuesto sin cobrar ofertas abiertas', () => {
    s.contracts = s.contracts.filter((ct) => ct.clubId !== c.id);
    const p = s.players.find((p) => p.id === s.marketPlayers[0])!;
    const balance = c.resources.money;
    cmd({ type: 'bid', playerId: p.id, amount: p.value, salaryBps: 1000 });
    expect(c.resources.money).toBe(balance);
    expect(available(s, c)).toBe(balance - p.value);
  });
  it('permite retirar y modificar una puja sin doble reserva', () => {
    s.contracts = s.contracts.filter((ct) => ct.clubId !== c.id);
    const p = s.players.find((p) => p.id === s.marketPlayers[0])!;
    cmd({ type: 'bid', playerId: p.id, amount: p.value, salaryBps: 200 });
    cmd({ type: 'bid', playerId: p.id, amount: p.value + 10000, salaryBps: 1000 });
    expect(s.bids).toHaveLength(1);
    cmd({ type: 'withdrawBid', id: s.bids[0].id });
    expect(available(s, c)).toBe(c.resources.money);
  });
  it('rechaza puja sin presupuesto, salario superior al diez y VM inferior', () => {
    s.contracts = s.contracts.filter((ct) => ct.clubId !== c.id);
    const p = s.players.find((p) => p.id === s.marketPlayers[0])!;
    expect(() =>
      cmd({ type: 'bid', playerId: p.id, amount: c.resources.money + 1, salaryBps: 200 }),
    ).toThrow();
    expect(() => cmd({ type: 'bid', playerId: p.id, amount: p.value, salaryBps: 1001 })).toThrow();
    expect(() =>
      cmd({ type: 'bid', playerId: p.id, amount: p.value - 1, salaryBps: 200 }),
    ).toThrow();
  });
  it('resuelve dos ofertas a un solo propietario y publica auditoría', () => {
    s.contracts = [];
    const p = s.players.find((p) => p.id === s.marketPlayers[0])!;
    for (const club of s.clubs.slice(0, 2))
      execute(
        s,
        { userId: club.userId, clubId: club.id, admin: false },
        { type: 'bid', playerId: p.id, amount: p.value * 2, salaryBps: 1000 },
      );
    s.privateRng = Array.from({ length: 100 }, (_, i) => String(i)).find((secret) => {
      s.privateRng = secret;
      const copy = structuredClone(s);
      reconcile(copy, s.nextMarketAt + 1);
      return copy.contracts.filter((ct) => ct.playerId === p.id).length === 1;
    })!;
    reconcile(s, s.nextMarketAt + 1);
    expect(s.contracts.filter((ct) => ct.playerId === p.id)).toHaveLength(1);
    expect(s.audit.some((a) => a.action === 'market.acceptance')).toBe(true);
    const won = s.bids.find((b) => b.status === 'won')!;
    expect(() =>
      cmd({ type: 'bid', playerId: won.playerId, amount: p.value, salaryBps: 200 }),
    ).toThrow();
  });
  it('un futbolista puede rechazar una oferta reproduciblemente', () => {
    s.contracts = [];
    const id = s.marketPlayers[0],
      p = s.players.find((p) => p.id === id)!;
    cmd({ type: 'bid', playerId: id, amount: p.value, salaryBps: 200 });
    let candidate: GameState | undefined;
    for (let i = 0; i < 100; i++) {
      const copy = structuredClone(s);
      copy.privateRng = String(i);
      reconcile(copy, copy.nextMarketAt + 1);
      if (copy.bids[0].status === 'rejected') {
        candidate = copy;
        break;
      }
    }
    expect(candidate?.bids[0].roll).toBeLessThan(candidate!.bids[0].rejection!);
    expect(candidate?.contracts.some((ct) => ct.playerId === id)).toBe(false);
  });
  it('oculta las ofertas abiertas de rivales y la semilla', () => {
    s.contracts = [];
    const p = s.players.find((p) => p.id === s.marketPlayers[0])!;
    cmd({ type: 'bid', playerId: p.id, amount: p.value, salaryBps: 200 });
    const view = publicState(s, s.clubs[1].userId);
    expect(view.state.bids).toHaveLength(0);
    expect(view.state.privateRng).toBeUndefined();
  });
  it('no permite vender un futbolista ajeno', () => {
    const id = s.contracts.find((ct) => ct.clubId !== c.id)!.playerId;
    expect(() => cmd({ type: 'sell', playerId: id })).toThrow();
  });
  it('no admite acceso a otro club', () => {
    expect(() =>
      execute(s, { ...actor, clubId: s.clubs[1].id }, { type: 'daily', id: dailyActions(s)[0].id }),
    ).toThrow();
  });
  it('vende al 85 por ciento inicialmente y reduce fama', () => {
    const ct = s.contracts.find((ct) => ct.clubId === c.id)!;
    const p = s.players.find((p) => p.id === ct.playerId)!;
    const before = c.resources.money;
    cmd({ type: 'sell', playerId: p.id });
    expect(c.resources.money - before).toBe(Math.round(p.value * 0.85));
    expect(s.contracts.some((ct) => ct.playerId === p.id)).toBe(false);
  });
});
describe('convocatorias y puntuaciones', () => {
  it('cobra salario del diez por ciento y aplica reducción máxima de 1,5 pp', () => {
    const ct = s.contracts.find((ct) => ct.clubId === c.id)!;
    const p = s.players.find((p) => p.id === ct.playerId)!;
    ct.salaryBps = 1000;
    c.research.salary = 5;
    const q = callCost(s, c);
    expect(q.snapshots[p.id].salary).toBe(Math.round(p.value * 0.085));
    expect(effects(c).salary).toBe(150);
  });
  it('congela el VM y no vuelve a cobrar la convocatoria', () => {
    const r = round();
    lockRound(s, r);
    const cost = c.selection.cost,
      balance = c.resources.money;
    for (const p of s.players) p.value *= 2;
    lockRound(s, r);
    expect(c.selection.cost).toBe(cost);
    expect(c.resources.money).toBe(balance);
  });
  it('invalida convocatoria sin dinero y no genera puntos ni taquilla', () => {
    c.resources.money = 0;
    finish();
    expect(round().number).toBe(2);
    const report = s.rounds[0].reports[c.id];
    expect(report.invalid).toBe(true);
    expect(report.points).toBe(0);
    expect(report.stadium).toBe(0);
  });
  it('invalida convocatoria que empieza con saldo negativo', () => {
    c.resources.money = -100;
    lockRound(s, round());
    expect(c.selection.valid).toBe(false);
  });
  it('penaliza casilla vacía pero no a un convocado sin minutos', () => {
    c.selection.starters[0].playerId = null;
    const absent = c.selection.starters[1].playerId!;
    const r = round();
    lockRound(s, r);
    r.matches.forEach((m) => (m.status = 'finished'));
    for (const p of s.players)
      r.scores[p.id] = { playerId: p.id, points: 0, minutes: 0, goals: 0, assists: 0 };
    settleRound(s, r);
    expect(r.reports[c.id].points).toBe(-500);
    expect(r.reports[c.id].detail[1].final).toBe(0);
  });
  it('no multiplica negativos y limita positivos al 50 por ciento', () => {
    expect(score(-215, 2500, 2500)).toBe(-215);
    expect(score(1000, 9900, 9900)).toBe(1500);
    expect(score(101, 500, 0)).toBe(106);
    expect(score(0, 2500, 2500)).toBe(0);
  });
  it('procesa suplencias una sola vez por jugador y espera al final de su partido', () => {
    const released = s.contracts.find(
      (ct) => ct.clubId === c.id && ct.playerId === c.selection.starters[10].playerId,
    )!;
    s.contracts = s.contracts.filter((ct) => ct !== released);
    c.selection.starters[10].playerId = null;
    const sub = spare('DEF');
    c.facilities.bench = 7;
    c.selection.bench = [sub.id];
    const r = round();
    lockRound(s, r);
    const def = c.selection.starters.find((slot) => slot.position === 'DEF')!;
    const out = def.playerId!;
    r.matches.forEach((m) => (m.status = 'finished'));
    r.scores[out] = { playerId: out, minutes: 0, points: 0, goals: 0, assists: 0 };
    r.scores[sub.id] = { playerId: sub.id, minutes: 90, points: 700, goals: 0, assists: 0 };
    const match = r.matches.find((m) => m.home === sub.realClubId || m.away === sub.realClubId)!;
    match.status = 'live';
    autoSubs(s, c, r);
    expect(def.playerId).toBe(out);
    match.status = 'finished';
    autoSubs(s, c, r);
    autoSubs(s, c, r);
    expect(def.playerId).toBe(sub.id);
    expect(c.selection.used).toEqual([sub.id]);
  });
  it('dos ausentes de la misma posición no usan dos veces el suplente', () => {
    c.facilities.locker = 1;
    const sub = spare('DEF');
    c.facilities.bench = 7;
    c.selection.bench = [sub.id];
    const r = round();
    lockRound(s, r);
    r.matches.forEach((m) => (m.status = 'finished'));
    for (const p of s.players)
      r.scores[p.id] = { playerId: p.id, minutes: 0, points: 0, goals: 0, assists: 0 };
    r.scores[sub.id].minutes = 90;
    autoSubs(s, c, r);
    expect(c.selection.starters.filter((x) => x.playerId === sub.id)).toHaveLength(1);
  });
  it('rechaza cambio manual sin investigación o con suplente usado', () => {
    c.selection.locked = true;
    c.selection.valid = true;
    expect(() =>
      cmd({ type: 'manualSub', slot: 1, playerId: c.selection.bench[0] || 'x' }),
    ).toThrow();
    c.research.smart1 = 1;
    c.selection.used = ['x'];
    c.selection.bench = ['x'];
    expect(() => cmd({ type: 'manualSub', slot: 1, playerId: 'x' })).toThrow();
  });
  it('liquida una jornada dos veces sin duplicar cobros', () => {
    const r = round();
    finish(r);
    const balance = c.resources.money,
      points = c.totalPoints,
      ledger = s.ledger.length;
    settleRound(s, r);
    expect(c.resources.money).toBe(balance);
    expect(c.totalPoints).toBe(points);
    expect(s.ledger).toHaveLength(ledger);
  });
  it('abandono por felicidad cero paga exactamente el 85 % sin bonus', () => {
    const reserve = s.contracts.find(
      (ct) =>
        ct.clubId === c.id && !c.selection.starters.some((slot) => slot.playerId === ct.playerId),
    )!;
    reserve.happiness = 1;
    c.research.sale = 5;
    const p = s.players.find((p) => p.id === reserve.playerId)!;
    finish();
    expect(s.contracts.some((ct) => ct.playerId === p.id)).toBe(false);
    expect(
      s.ledger.find((l) => l.reason === 'Abandono por felicidad cero' && l.clubId === c.id)?.amount,
    ).toBe(Math.round(p.value * 0.85));
  });
});
describe('ciudad e investigación', () => {
  it('solo permite una construcción inicialmente y cancela con devolución del 50 %', () => {
    const before = c.resources.money;
    cmd({ type: 'build', target: 'hq' });
    expect(() => cmd({ type: 'facility', target: 'stands' })).toThrow();
    const paid = before - c.resources.money;
    cmd({ type: 'cancelJob', id: s.jobs[0].id });
    expect(c.resources.money).toBe(before - paid + Math.floor(paid / 2));
  });
  it('la sede limita edificios y las instalaciones al estadio', () => {
    expect(() => cmd({ type: 'build', target: 'stadium' })).toThrow();
    c.buildings.hq = 2;
    cmd({ type: 'build', target: 'stadium' });
    reconcile(s, s.jobs[0].endsAt);
    expect(c.buildings.stadium).toBe(2);
    c.facilities.stands = 2;
    expect(() => cmd({ type: 'facility', target: 'stands' })).toThrow();
  });
  it('completa sede central y desbloquea los demás niveles', () => {
    cmd({ type: 'build', target: 'hq' });
    const end = s.jobs[0].endsAt;
    reconcile(s, end);
    expect(c.buildings.hq).toBe(2);
    expect(s.jobs).toHaveLength(0);
    expect(jobQuote(c, 'building', 'stadium').level).toBe(2);
  });
  it('investigación única entre los tres árboles y no admite duplicados', () => {
    cmd({ type: 'research', target: 'accounting' });
    expect(() => cmd({ type: 'research', target: 'tactics' })).toThrow();
    expect(() => cmd({ type: 'research', target: 'accounting' })).toThrow();
    reconcile(s, s.jobs[0].endsAt);
    expect(c.research.accounting).toBe(1);
    expect(() => cmd({ type: 'research', target: 'accounting' })).toThrow();
  });
  it('no tiene ciclos ni referencias rotas en los tres árboles', () => {
    const visit = (id: string, path: string[]) => {
      expect(path).not.toContain(id);
      const node = RESEARCH.find((r) => r.id === id);
      expect(node).toBeDefined();
      node!.requires.forEach((dep) => visit(dep, [...path, id]));
    };
    RESEARCH.forEach((r) => visit(r.id, []));
    expect(new Set(RESEARCH.map((r) => r.tree)).size).toBe(3);
  });
  it('impide clausulazo antes del día cincuenta y respeta blindaje', () => {
    const rival = s.contracts.find((ct) => ct.clubId !== c.id)!;
    c.modules.push('clauses');
    expect(() => cmd({ type: 'clause', playerId: rival.playerId })).toThrow();
    s.now = s.seasonStartedAt + 50 * DAY;
    rival.shieldUntil = s.now + DAY;
    expect(() => cmd({ type: 'clause', playerId: rival.playerId })).toThrow('blindado');
  });
  it('las oficinas no tienen nivel general', () => {
    expect(c.buildings.offices).toBeUndefined();
    expect(() => cmd({ type: 'build', target: 'offices' })).toThrow();
  });
});
describe('comercio, eventos e historia', () => {
  it('recompensa diaria no puede repetirse', () => {
    const a = dailyActions(s)[0];
    cmd({ type: 'daily', id: a.id });
    expect(() => cmd({ type: 'daily', id: a.id })).toThrow();
  });
  it('el préstamo puede dejar saldo negativo y no se devuelve dos veces', () => {
    cmd({ type: 'institution', id: 'urgent' });
    const loan = s.loans[0];
    // Los ingresos de la jornada no deben ocultar el descubierto que comprueba esta prueba.
    c.resources.money = -euro(10_000_000);
    finish();
    expect(loan.settled).toBe(true);
    expect(s.ledger.filter((l) => l.ref === loan.id)).toHaveLength(1);
    expect(c.resources.money).toBeLessThan(0);
  });
  it('la palanca con escándalo aplica sanciones limitadas', () => {
    let found = false;
    for (let i = 0; i < 100; i++) {
      const copy = structuredClone(s);
      copy.privateRng = String(i);
      execute(copy, actor, { type: 'institution', id: 'leverage' });
      if (copy.news.some((n) => n.category === 'Escándalos')) {
        found = true;
        expect(copy.clubs[0].totalPoints).toBe(-500);
        expect(copy.clubs[0].resources.prestige).toBe(9);
        break;
      }
    }
    expect(found).toBe(true);
  });
  it('concierto paga por jornada sin duplicar la liquidación', () => {
    c.modules.push('concerts');
    cmd({ type: 'concert', id: 'dua' });
    const r = round();
    finish(r);
    expect(r.reports[c.id].concerts).toBe(euro(250000));
    const n = s.ledger.length;
    settleRound(s, r);
    expect(s.ledger).toHaveLength(n);
  });
  it('patrocinio paga al día siguiente sin conceder fama al firmar', () => {
    const fame = c.resources.fame;
    cmd({ type: 'sponsor', id: 'aurum', slot: 'Pecho', days: 7 });
    expect(c.resources.fame).toBe(fame);
    reconcile(s, s.nextMarketAt + 1);
    expect(
      s.ledger.filter((l) => l.reason === 'Patrocinio diario' && l.clubId === c.id),
    ).toHaveLength(1);
  });
  it('reinicia progreso, vuelve a cien millones y conserva el museo', () => {
    c.trophies.push({ id: 't', season: 1, at: s.now, title: 'Historia', detail: 'Test' });
    c.research.accounting = 1;
    c.resources.fame = 5;
    cmd({ type: 'resetSeason' });
    const reset = s.clubs.find((club) => club.id === c.id)!;
    expect(reset.resources.money).toBe(RULES.initialBudget);
    expect(reset.research).toEqual({});
    expect(s.contracts).toHaveLength(0);
    expect(reset.trophies.some((t) => t.id === 't')).toBe(true);
    expect(s.archives).toHaveLength(1);
    expect(s.draft.active).toBe(true);
  });
  it('reserva una plaza para el retorno de una cesión', () => {
    const ct = s.contracts.find((ct) => ct.clubId === c.id)!;
    ct.clubId = s.clubs[1].id;
    ct.loan = { from: c.id, untilRound: 2 };
    expect(rosterUsage(s, c)).toBe(12);
  });
  it('impide recoger dos veces un premio de evento', () => {
    s.audit.push(
      ...Array.from({ length: 3 }, () => ({
        at: s.now,
        action: 'daily',
        actor: c.id,
        detail: 'x',
      })),
    );
    const id = s.events.find((e) => e.type === 'coach')!.id;
    cmd({ type: 'eventClaim', id });
    expect(c.resources.medals).toBe(2);
    expect(() => cmd({ type: 'eventClaim', id })).toThrow();
  });
});
describe('cambios manuales y acuerdos directos', () => {
  it('permite sustituir un titular finalizado por un suplente cuyo partido no empezó', () => {
    c.facilities.locker = 1;
    c.facilities.bench = 7;
    c.research.smart1 = 1;
    const sub = spare('MED');
    c.selection.bench = [sub.id];
    const r = round();
    lockRound(s, r);
    const slot = c.selection.starters.findIndex(
      (slot) =>
        slot.position === 'MED' &&
        s.players.find((p) => p.id === slot.playerId)!.realClubId !== sub.realClubId,
    );
    const original = c.selection.starters[slot].playerId!;
    const out = s.players.find((p) => p.id === original)!;
    r.matches.forEach((m) => {
      if (m.home === out.realClubId || m.away === out.realClubId) m.status = 'finished';
      else m.startsAt = s.now + HOUR;
    });
    const subMatch = r.matches.find((m) => m.home === sub.realClubId || m.away === sub.realClubId)!;
    expect(subMatch.status).toBe('scheduled');
    cmd({ type: 'manualSub', slot, playerId: sub.id });
    expect(c.selection.starters[slot].playerId).toBe(sub.id);
    expect(c.selection.manual).toBe(1);
    expect(() => cmd({ type: 'manualSub', slot, playerId: sub.id })).toThrow();
  });
  it('acepta un intercambio de plantillas completas sin duplicar propiedad', () => {
    const seller = s.clubs[1],
      target = s.contracts.find((ct) => ct.clubId === seller.id)!,
      offered = s.contracts.find((ct) => ct.clubId === c.id)!;
    cmd({
      type: 'negotiate',
      playerId: target.playerId,
      amount: euro(100000),
      offeredPlayerId: offered.playerId,
    });
    const n = s.negotiations[0];
    execute(
      s,
      { userId: seller.userId, clubId: seller.id, admin: false },
      { type: 'respondTrade', id: n.id, accept: true },
    );
    expect(target.clubId).toBe(c.id);
    expect(offered.clubId).toBe(seller.id);
    expect(new Set(s.contracts.map((ct) => ct.playerId)).size).toBe(s.contracts.length);
    expect(() =>
      execute(
        s,
        { userId: seller.userId, clubId: seller.id, admin: false },
        { type: 'respondTrade', id: n.id, accept: true },
      ),
    ).toThrow();
  });
});
describe('límite diario en las noches de cambio horario', () => {
  it('no renueva actividades a las cinco en el día de veinticinco horas', () => {
    expect(dailyKey(Date.parse('2026-10-25T04:00:00Z'))).toBe('2026-10-24');
    expect(dailyKey(Date.parse('2026-10-25T05:00:00Z'))).toBe('2026-10-25');
  });
});
