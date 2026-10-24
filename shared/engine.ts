import { activityOffers, activityDay } from './activities.js';
import { notifications } from './attention.js';
import { economicRandom } from './math.js';
import {
  AD_SLOTS,
  ARTISTS,
  BUILDINGS,
  DAY,
  FACILITIES,
  FORMATIONS,
  HOUR,
  INSTITUTIONS,
  MODULES,
  RESEARCH,
  RULES,
  SPONSORS,
  euro,
} from './config.js';
import {
  acceptance,
  capacity,
  clamp,
  dailyKey,
  hash,
  invariant,
  nextMarket,
  owned,
  playerOf,
  roundRatio,
  score,
  seasonDay,
} from './math.js';
import { COACHES, mockScore } from './sports.js';
import { createGame, emptySelection, makeEvents, makeRound, uid } from './seed.js';
import type {
  Actor,
  Club,
  Command,
  Effect,
  GameState,
  Job,
  Player,
  Resource,
  Round,
  Selection,
} from './types.js';
export function effects(c: Club): Required<Effect> {
  const e: Required<Effect> = {
    salary: 0,
    sale: 0,
    sport: 0,
    sponsor: 0,
    construction: 0,
    secondQueue: 0,
    manual: 0,
    quality: 0,
    fameCap: 0,
    prestigeCap: 0,
    luck: 0,
    fans: 0,
    happiness: 0,
    maintenance: 0,
    wish: 0,
    wishDiscount: 0,
    concerts: 0,
    custom: 0,
    kits: 0,
  };
  for (const r of RESEARCH) {
    const level = c.research[r.id] || 0;
    for (const [k, v] of Object.entries(r.effects)) {
      const key = k as keyof Effect;
      e[key] += (v || 0) * level;
    }
  }
  e.quality = Math.min(3, e.quality);
  e.maintenance = Math.min(3000, e.maintenance);
  e.salary = Math.min(150, e.salary);
  e.sale = Math.min(1500, e.sale);
  e.sport = Math.min(2500, e.sport + (COACHES.find((x) => x.id === c.coach)?.sportBonus || 0));
  e.manual = Math.min(2, e.manual);
  e.construction = Math.min(3000, e.construction);
  e.wish = Math.min(5, e.wish);
  e.wishDiscount = Math.min(250, e.wishDiscount);
  return e;
}
export function resource(
  s: GameState,
  c: Club,
  key: Resource,
  amount: number,
  reason: string,
  ref?: string,
) {
  invariant(Number.isSafeInteger(amount), 'Cantidad inválida.');
  let n = c.resources[key] + amount;
  if (key === 'fame') n = clamp(n, 0, Math.min(100, 10 + effects(c).fameCap));
  if (key === 'prestige') n = clamp(n, 0, Math.min(100, 50 + effects(c).prestigeCap));
  if (key === 'fans' || key === 'luck') n = clamp(n, 0, 100);
  invariant(Number.isSafeInteger(n), 'Saldo fuera de rango.');
  const actual = n - c.resources[key];
  c.resources[key] = n;
  s.ledger.push({
    id: uid(),
    at: s.now,
    season: s.season,
    clubId: c.id,
    resource: key,
    amount: actual,
    balance: n,
    reason,
    ref,
  });
}
export function rosterUsage(s: GameState, c: Club) {
  return (
    owned(s, c).length +
    s.contracts.filter((ct) => ct.loan?.from === c.id && ct.clubId !== c.id).length
  );
}
export function reserved(s: GameState, c: Club, except?: string) {
  return (
    s.bids
      .filter((b) => b.clubId === c.id && b.status === 'open' && b.id !== except)
      .reduce((n, b) => n + b.amount, 0) +
    s.auctions
      .filter((a) => a.clubId === c.id && a.status === 'open' && a.id !== except)
      .reduce((n, a) => n + a.highest, 0)
  );
}
export function available(s: GameState, c: Club, except?: string) {
  return c.resources.money - reserved(s, c, except);
}
function spend(s: GameState, c: Club, n: number, reason: string, except?: string) {
  invariant(Number.isSafeInteger(n) && n >= 0, 'Importe inválido.');
  invariant(
    available(s, c, except) >= n,
    'Saldo insuficiente: parte del dinero puede estar reservado en pujas.',
  );
  resource(s, c, 'money', -n, reason);
}
function news(
  s: GameState,
  category: string,
  title: string,
  subtitle: string,
  clubId?: string,
  ref?: string,
  playerId?: string,
) {
  s.news.push({ id: uid(), at: s.now, category, title, subtitle, clubId, ref, playerId });
}
function award(
  s: GameState,
  c: Club,
  p: Player,
  amount: number,
  salary: number,
  kind: string,
  from: string | null = null,
) {
  invariant(!s.contracts.some((x) => x.playerId === p.id), 'El futbolista ya tiene propietario.');
  invariant(rosterUsage(s, c) < capacity(c), 'Plantilla completa. Amplía los vestuarios.');
  spend(s, c, amount, `${kind}: ${p.name}`);
  s.contracts.push({
    playerId: p.id,
    clubId: c.id,
    salaryBps: salary,
    happiness: 75,
    missed: 0,
    clause: p.value * 2,
    shieldUntil: 0,
    endsAt: s.seasonEndsAt,
  });
  s.transfers.push({ id: uid(), at: s.now, playerId: p.id, from, to: c.id, amount, kind });
  resource(s, c, 'fame', 2, 'Nuevo fichaje');
  if (p.realClubId === c.favorite) resource(s, c, 'fans', 3, 'Fichaje del equipo favorito');
  news(
    s,
    'Mercado',
    `${p.name} ya viste los colores de ${c.name}`,
    `La operación se ha cerrado en ${Math.round(amount / 100).toLocaleString('es-ES')} €.`,
    c.id,
    undefined,
    p.id,
  );
}
export function dailyActions(s: GameState) {
  return activityOffers(s);
}
export function concertOffers(s: GameState) {
  const week = Math.floor((s.now - s.seasonStartedAt) / (7 * DAY));
  return [0, 1, 2].map((i) => ARTISTS[(week * 3 + i) % ARTISTS.length]);
}
export function facilityLimit(c: Club, id: string) {
  const stadium = c.buildings.stadium;
  const max = FACILITIES.find((f) => f.id === id)!.max;
  if (id === 'locker') return Math.min(18, stadium * 4);
  if (id === 'bench') return Math.min(7, stadium + 2);
  return Math.min(max, stadium);
}
export function jobQuote(c: Club, kind: 'building' | 'facility' | 'research', target: string) {
  const def =
    kind === 'building'
      ? BUILDINGS.find((b) => b.id === target)
      : kind === 'facility'
        ? FACILITIES.find((f) => f.id === target)
        : RESEARCH.find((r) => r.id === target);
  invariant(def, 'Mejora no encontrada.');
  const current =
    kind === 'building'
      ? c.buildings[target] || 0
      : kind === 'facility'
        ? c.facilities[target] || 0
        : c.research[target] || 0;
  const level = current + 1;
  let money: number, hours: number;
  let development = 0;
  if (kind === 'research') {
    const r = RESEARCH.find((r) => r.id === target)!;
    invariant(level <= r.maxLevel, 'Investigación completada.');
    invariant(
      r.requires.every((id) => (c.research[id] || 0) > 0),
      'Faltan investigaciones previas.',
    );
    invariant(c.buildings.research >= r.buildingLevel, 'Mejora el centro de investigación.');
    const tier = Math.min(4, Math.max(current, Math.floor(r.row / 2)));
    money = RULES.researchMoney[tier];
    development = RULES.researchPD[tier];
    hours = RULES.researchHours[tier];
  } else if (kind === 'building') {
    const b = BUILDINGS.find((b) => b.id === target)!;
    invariant(b.max > 0 && level <= b.max, 'Este edificio no admite más niveles.');
    invariant(target === 'hq' || level <= c.buildings.hq, 'Primero debes mejorar la sede central.');
    money = RULES.buildingMoney[level - 1];
    hours = RULES.buildingHours[level - 1];
  } else {
    const f = FACILITIES.find((f) => f.id === target)!;
    invariant(
      level <= f.max && level <= facilityLimit(c, target),
      'El estadio limita esta instalación.',
    );
    if (level > 2) invariant((c.research.works || 0) > 0, 'Requiere Dirección de obras.');
    money = euro(100000 * level * level);
    hours = Math.min(168, 4 * level);
  }
  hours *= 1 - effects(c).construction / 10000;
  return { level, money, development, duration: Math.round(hours * HOUR) };
}
export function callCost(s: GameState, c: Club, selection = c.selection) {
  const ef = effects(c);
  let cost = 0;
  const snapshots: Selection['snapshots'] = {};
  const ids = [...selection.starters.map((x) => x.playerId), ...selection.bench].filter(
    Boolean,
  ) as string[];
  invariant(new Set(ids).size === ids.length, 'Un futbolista no puede ocupar dos plazas.');
  const [benchMax] = RULES.bench[Math.min(7, c.facilities.bench || 0)];
  invariant(selection.bench.length <= benchMax, 'El banquillo no admite tantos suplentes.');
  const benchPos = selection.bench.map((id) => playerOf(s, id).position);
  invariant(
    new Set(benchPos).size === benchPos.length,
    'Solo se admite un suplente por demarcación.',
  );
  for (const id of ids) {
    const contract = s.contracts.find((x) => x.playerId === id && x.clubId === c.id);
    invariant(contract, 'Solo puedes convocar futbolistas propios.');
    const p = playerOf(s, id);
    const slot = selection.starters.find((x) => x.playerId === id);
    if (slot) invariant(slot.position === p.position, 'Demarcación incompatible.');
    const salary =
      Math.max(RULES.minSalary, contract.salaryBps - ef.salary) +
      (RULES.qualitySalary[slot?.quality || 0] || 0);
    const payment = roundRatio(p.value, salary);
    snapshots[id] = { value: p.value, salary: payment };
    cost += payment;
  }
  return { cost, snapshots };
}
function clearPlayerSelections(s: GameState, playerId: string) {
  for (const c of s.clubs) {
    if (c.selection.locked) continue;
    c.selection.starters.forEach((slot) => {
      if (slot.playerId === playerId) slot.playerId = null;
    });
    c.selection.bench = c.selection.bench.filter((id) => id !== playerId);
  }
}
function tradable(s: GameState, id: string) {
  invariant(
    !s.clubs.some(
      (c) =>
        c.selection.locked &&
        !s.rounds.find((r) => r.number === c.selection.round)?.settled &&
        [...c.selection.starters.map((x) => x.playerId), ...c.selection.bench].includes(id),
    ),
    'No se puede transferir un convocado durante la jornada.',
  );
  const ct = s.contracts.find((c) => c.playerId === id);
  invariant(!ct?.loan, 'El futbolista está cedido.');
}
function closeMarket(s: GameState) {
  for (const playerId of s.marketPlayers) {
    const p = playerOf(s, playerId);
    const bids = s.bids.filter(
      (b) => b.status === 'open' && b.marketId === s.marketId && b.playerId === playerId,
    );
    const accepted = [];
    for (const b of bids) {
      const c = s.clubs.find((c) => c.id === b.clubId)!;
      const calc = acceptance(p.value, b.amount, b.salaryBps, c.resources.fame);
      b.rejection = calc.rejection;
      b.roll =
        economicRandom(s.privateRng || s.id, `${s.id}:${s.season}:${s.marketId}:${b.id}`) * 100;
      b.attraction = calc.attraction;
      b.status = b.roll < calc.rejection ? 'rejected' : 'lost';
      if (b.status === 'lost') accepted.push(b);
      s.audit.push({
        at: s.now,
        actor: c.id,
        action: 'market.acceptance',
        detail: JSON.stringify({
          bidId: b.id,
          rejection: b.rejection,
          roll: b.roll,
          attraction: b.attraction,
        }),
      });
    }
    accepted.sort(
      (a, b) =>
        b.attraction! - a.attraction! || a.createdAt - b.createdAt || a.id.localeCompare(b.id),
    );
    for (const b of accepted) {
      const c = s.clubs.find((c) => c.id === b.clubId)!;
      if (
        s.contracts.some((x) => x.playerId === playerId) ||
        rosterUsage(s, c) >= capacity(c) ||
        available(s, c) < b.amount
      )
        continue;
      award(s, c, p, b.amount, b.salaryBps, 'Agente libre');
      b.status = 'won';
      if (c.wish.includes(p.id)) {
        resource(
          s,
          c,
          'money',
          roundRatio(p.value, effects(c).wishDiscount),
          'Devolución por lista de deseados',
        );
        c.wish = c.wish.filter((id) => id !== p.id);
      }
      break;
    }
  }
  s.marketId++;
  const free = s.players.filter(
    (p) =>
      !s.contracts.some((c) => c.playerId === p.id) &&
      !s.auctions.some((a) => a.playerId === p.id && a.status === 'open'),
  );
  free.sort((a, b) => hash(`${s.marketId}${a.id}`) - hash(`${s.marketId}${b.id}`));
  s.marketPlayers = free.slice(0, RULES.marketSize).map((p) => p.id);
  s.nextMarketAt = nextMarket(s.now);
}
function settleAuction(s: GameState, id: string) {
  const a = s.auctions.find((a) => a.id === id)!;
  if (a.status === 'closed') return;
  a.status = 'closed';
  if (a.clubId) {
    const c = s.clubs.find((c) => c.id === a.clubId)!;
    if (
      available(s, c) >= a.highest &&
      rosterUsage(s, c) < capacity(c) &&
      !s.contracts.some((c) => c.playerId === a.playerId)
    )
      award(
        s,
        c,
        playerOf(s, a.playerId),
        a.highest,
        200,
        a.kind === 'draft' ? 'Draft' : 'Subasta especial',
      );
  }
}
function completeJob(s: GameState, j: Job) {
  const c = s.clubs.find((c) => c.id === j.clubId)!;
  if (j.kind === 'building') c.buildings[j.target] = j.level;
  else if (j.kind === 'facility') c.facilities[j.target] = j.level;
  else if (j.kind === 'research') {
    c.research[j.target] = j.level;
    const ef = RESEARCH.find((r) => r.id === j.target)!.effects;
    if (ef.luck) resource(s, c, 'luck', ef.luck, 'Investigación completada');
    if (ef.fans) resource(s, c, 'fans', ef.fans, 'Investigación completada');
  } else {
    const p = s.players.find(
      (p) =>
        p.simulated &&
        !s.contracts.some((ct) => ct.playerId === p.id) &&
        !s.marketPlayers.includes(p.id) &&
        !s.auctions.some((a) => a.status === 'open' && a.playerId === p.id),
    );
    if (p && rosterUsage(s, c) < capacity(c)) {
      // Se paga el VM al formar talento: no existe arbitraje de cantera.
      if (available(s, c) >= p.value) award(s, c, p, p.value, 200, 'Cantera');
    }
  }
  s.jobs = s.jobs.filter((x) => x.id !== j.id);
  s.audit.push({ at: s.now, action: 'job.complete', actor: c.id, detail: j.kind + ':' + j.target });
  news(
    s,
    j.kind === 'research' ? 'Investigación' : 'Construcción',
    `${c.name} sigue creciendo`,
    `${j.kind === 'research' ? RESEARCH.find((r) => r.id === j.target)?.name : BUILDINGS.find((b) => b.id === j.target)?.name || FACILITIES.find((f) => f.id === j.target)?.name || 'Proyecto de cantera'}: nivel ${j.level} completado.`,
    c.id,
    j.id,
  );
}
export function lockRound(s: GameState, r: Round) {
  if (s.processed.includes(`lock:${s.season}:${r.number}`)) return;
  s.processed.push(`lock:${s.season}:${r.number}`);
  for (const c of s.clubs) {
    const sel = c.selection;
    sel.locked = true;
    sel.policy = c.ticketPolicy;
    sel.valid = false;
    if (c.resources.money < 0) continue;
    try {
      const { cost, snapshots } = callCost(s, c);
      if (available(s, c) < cost) continue;
      spend(s, c, cost, `Convocatoria J${r.number}`);
      sel.cost = cost;
      sel.snapshots = snapshots;
      sel.valid = true;
    } catch {
      sel.valid = false;
    }
  }
  news(
    s,
    'Competición',
    `Convocatorias cerradas · Jornada ${r.number}`,
    'Los costes y valores de referencia quedan congelados hasta el cierre.',
  );
}
function matchOf(s: GameState, r: Round, id: string) {
  const p = playerOf(s, id);
  return r.matches.find((m) => m.home === p.realClubId || m.away === p.realClubId)!;
}
export function autoSubs(s: GameState, c: Club, r: Round) {
  const sel = c.selection;
  if (!sel.locked || !sel.valid) return;
  const max = RULES.bench[Math.min(7, c.facilities.bench || 0)][1];
  for (const slot of sel.starters) {
    const autoCount = r.reports[c.id]?.substitutions.filter((x) => !x.manual).length || 0;
    if (!slot.playerId || autoCount >= max) continue;
    const out = slot.playerId;
    if (matchOf(s, r, out).status !== 'finished' || r.scores[out]?.minutes !== 0) continue;
    const sub = sel.bench.find(
      (id) =>
        !sel.used.includes(id) &&
        playerOf(s, id).position === slot.position &&
        matchOf(s, r, id).status === 'finished' &&
        (r.scores[id]?.minutes || 0) > 0,
    );
    if (!sub) continue;
    sel.used.push(sub);
    slot.playerId = sub;
    const report = (r.reports[c.id] ??= blankReport());
    report.substitutions.push({ out, in: sub, manual: false });
  }
}
function blankReport() {
  return {
    points: 0,
    salary: 0,
    stadium: 0,
    concerts: 0,
    sponsors: 0,
    merchandising: 0,
    television: 0,
    maintenance: 0,
    substitutions: [],
    invalid: false,
    detail: [],
  };
}
export function settleRound(s: GameState, r: Round) {
  if (r.settled) return;
  invariant(
    r.matches.every((m) => m.status === 'finished'),
    'Quedan encuentros pendientes.',
  );
  lockRound(s, r);
  const before = s.clubs.toSorted(
    (a, b) => b.totalPoints - a.totalPoints || a.id.localeCompare(b.id),
  );
  const weight = (s.clubs.length * (s.clubs.length + 1)) / 2;
  const fund = RULES.tvFundPerClub * s.clubs.length;
  let distributed = 0;
  for (const c of s.clubs) {
    autoSubs(s, c, r);
    const report = (r.reports[c.id] ??= blankReport());
    report.salary = c.selection.cost;
    report.invalid = !c.selection.valid;
    const ef = effects(c);
    if (c.selection.valid) {
      report.detail = c.selection.starters.map((slot) => {
        const base = slot.playerId ? r.scores[slot.playerId]?.points || 0 : RULES.emptyPoints;
        return {
          playerId: slot.playerId,
          position: slot.position,
          base,
          quality: RULES.qualityBonus[slot.quality],
          additional: ef.sport,
          final: slot.playerId ? score(base, RULES.qualityBonus[slot.quality], ef.sport) : base,
        };
      });
      report.points = report.detail.reduce((n, x) => n + x.final, 0);
      c.totalPoints += report.points;
      const comfort =
        ['vip', 'roof', 'security', 'services'].reduce(
          (n, id) => n + (c.facilities[id] || 0) * 2,
          0,
        ) + ((c.facilities.scoreboard || 0) >= 4 ? 2 : 0);
      const policy = c.selection.policy;
      const occupancy = clamp(
        52 +
          c.resources.fame * 0.15 +
          c.resources.fans * 0.2 +
          c.resources.luck * 0.02 +
          comfort +
          (policy === 'economic' ? 12 : policy === 'premium' ? -10 : 0),
        15,
        100,
      );
      const cap = 12000 + (c.facilities.stands || 0) * 8000;
      report.stadium = Math.round(
        ((cap * occupancy) / 100) *
          euro(18) *
          (policy === 'economic' ? 0.75 : policy === 'premium' ? 1.35 : 1) *
          (1 + (c.facilities.vip || 0) * 0.03),
      );
      resource(s, c, 'money', report.stadium, `Taquilla J${r.number}`);
      resource(
        s,
        c,
        'fame',
        policy === 'economic' ? 2 : policy === 'premium' ? -2 : 0,
        'Política de entradas',
      );
    }
    c.roundPoints = report.points;
    const level = c.buildings.stadium;
    const energy = roundRatio(euro(18000 * level), 10000 - (c.facilities.led || 0) * 1000);
    const water = roundRatio(euro(6000 * level), 10000 - (c.facilities.sprinklers || 0) * 1000);
    report.maintenance = roundRatio(
      energy + water + euro(20000 * level * level + Math.max(0, owned(s, c).length - 12) * 3000),
      10000 - Math.min(3000, ef.maintenance),
    );
    resource(s, c, 'money', -report.maintenance, `Mantenimiento J${r.number}`);
    for (const d of s.concerts.filter(
      (d) => d.clubId === c.id && d.startsAt <= s.now && d.endsAt > s.now,
    )) {
      const income = roundRatio(d.perRound, 10000 + (c.facilities.showlights || 0) * 500);
      report.concerts += income;
      resource(s, c, 'money', income, `Concierto J${r.number}`, d.id);
    }
    const goals = owned(s, c).reduce((n, ct) => n + (r.scores[ct.playerId]?.goals || 0), 0);
    report.merchandising = euro(
      Math.round(
        (c.buildings.shop * 20000 +
          c.resources.fans * 300 +
          c.resources.fame * 500 +
          goals * 5000) *
          (1 + ef.sponsor / 10000),
      ),
    );
    resource(s, c, 'money', report.merchandising, `Merchandising J${r.number}`);
    const rank = before.findIndex((x) => x.id === c.id) + 1;
    report.television =
      roundRatio(fund, 5000) / s.clubs.length + Math.floor(((fund / 2) * rank) / weight);
    report.television = Math.floor(report.television);
    distributed += report.television;
    resource(s, c, 'money', report.television, `Reparto televisivo J${r.number}`);
    const selected = Object.keys(c.selection.snapshots);
    for (const ct of owned(s, c)) {
      const called = c.selection.valid && selected.includes(ct.playerId);
      const starter = c.selection.starters.some((x) => x.playerId === ct.playerId);
      ct.missed = called ? 0 : ct.missed + 1;
      ct.happiness = clamp(
        ct.happiness +
          (called ? 5 + ef.happiness + (starter ? 2 : 0) : -4 - (ct.missed >= 3 ? 5 : 0)),
        0,
        100,
      );
      if (ct.happiness === 0) {
        const p = playerOf(s, ct.playerId);
        resource(s, c, 'money', roundRatio(p.value, 8500), 'Abandono por felicidad cero');
        s.contracts = s.contracts.filter((x) => x !== ct);
        s.transfers.push({
          id: uid(),
          at: s.now,
          playerId: p.id,
          from: c.id,
          to: null,
          amount: roundRatio(p.value, 8500),
          kind: 'Abandono',
        });
        news(
          s,
          'Mercado',
          `${p.name} abandona ${c.name}`,
          'Su felicidad llegó a cero. El club recibe el 85 % del valor de mercado.',
          c.id,
        );
      }
    }
    for (const loan of s.loans.filter(
      (l) => l.clubId === c.id && !l.settled && l.dueRound <= r.number,
    )) {
      resource(s, c, 'money', -loan.repay, 'Devolución de préstamo', loan.id);
      loan.settled = true;
    }
  }
  const remainder = fund - distributed;
  if (remainder && s.clubs[0])
    resource(s, s.clubs[0], 'money', remainder, 'Ajuste de céntimos del reparto');
  const ranking = s.clubs.toSorted(
    (a, b) => b.roundPoints - a.roundPoints || a.id.localeCompare(b.id),
  );
  ranking.forEach((c, i) =>
    resource(
      s,
      c,
      'fame',
      i === 0 ? 4 : i < 3 ? 2 : i === ranking.length - 1 ? -3 : 0,
      'Resultado de jornada',
    ),
  );
  if (ranking[0]) {
    ranking[0].trophies.push({
      id: uid(),
      title: `Ganador de la jornada ${r.number}`,
      season: s.season,
      at: s.now,
      detail: `${(ranking[0].roundPoints / 100).toFixed(2)} puntos`,
    });
    news(
      s,
      'Resultados',
      `${ranking[0].name} reina en la jornada ${r.number}`,
      `Una victoria con ${(ranking[0].roundPoints / 100).toFixed(2)} puntos fantasy.`,
      ranking[0].id,
    );
  }
  r.settled = true;
  r.status = 'finished';
  for (const ct of s.contracts.filter((c) => c.loan && c.loan.untilRound <= r.number)) {
    const back = s.clubs.find((c) => c.id === ct.loan!.from)!;
    const borrower = s.clubs.find((c) => c.id === ct.clubId)!;
    ct.clubId = back.id;
    ct.loan = undefined;
    clearPlayerSelections(s, ct.playerId);
    news(
      s,
      'Mercado',
      'Fin de cesión',
      `${playerOf(s, ct.playerId).name} regresa de ${borrower.name} a ${back.name}.`,
      back.id,
    );
  }
  if (r.number < 38) {
    s.currentRound = r.number + 1;
    s.rounds.push(makeRound(s.currentRound, r.startsAt + 7 * DAY));
    for (const c of s.clubs) {
      const prev = c.selection;
      c.selection = {
        ...emptySelection(s.currentRound),
        starters: prev.starters.map((slot) => ({
          ...slot,
          playerId:
            slot.playerId &&
            s.contracts.some((ct) => ct.playerId === slot.playerId && ct.clubId === c.id)
              ? slot.playerId
              : null,
        })),
        bench: prev.bench.filter((id) =>
          s.contracts.some((ct) => ct.playerId === id && ct.clubId === c.id),
        ),
      };
    }
  }
}
function daily(s: GameState) {
  const key = dailyKey(s.now);
  if (s.lastDaily === key) return;
  for (const c of s.clubs) {
    resource(s, c, 'development', RULES.dailyDevelopment, 'Desarrollo diario');
    const previous = activityDay(c, s.lastDaily, c.dailyDone.length);
    previous.closed = true;
    const pending = c.activity && !c.activity.claimedAt && c.activity.offerDay === s.lastDaily;
    if (pending) previous.pendingRunId = c.activity!.id;
    if (previous.completed === 0 && !pending && !previous.penaltyApplied) {
      resource(s, c, 'fame', -1, 'Inactividad: ninguna actividad completada');
      previous.penaltyApplied = true;
      previous.resolvedAt = s.now;
    } else if (previous.completed > 0) previous.resolvedAt = s.now;
    c.dailyDone = [];
  }
  for (const d of s.sponsors) {
    if (d.endsAt <= s.now || d.startsAt > s.now || d.lastPaidDay === key) continue;
    const c = s.clubs.find((c) => c.id === d.clubId)!;
    const amount = roundRatio(d.daily, 10000 + effects(c).sponsor);
    resource(s, c, 'money', amount, 'Patrocinio diario', d.id);
    d.lastPaidDay = key;
  }
  for (const p of s.players) {
    const delta = 9700 + (hash(`${key}${p.id}`) % 601);
    p.value = Math.max(euro(100000), roundRatio(p.value, delta));
    p.valueHistory.push({ at: s.now, value: p.value });
  }
  const week = Math.floor((s.now - s.seasonStartedAt) / (7 * DAY)) + 1;
  if (!s.events.some((e) => e.id === `w${week}-market`)) s.events.push(...makeEvents(s.now, week));
  s.lastDaily = key;
  news(
    s,
    'Edición diaria',
    `El Balonazo · ${key}`,
    'Nueva edición: desarrollo diario y actualidad de los clubes.',
  );
}
// Toda reconciliación usa el reloj del servidor. Se recorren los vencimientos cronológicamente.
export function reconcile(s: GameState, target: number) {
  invariant(target >= s.now, 'El reloj no puede retroceder.');
  let guard = 0;
  while (guard++ < 10000) {
    const r = s.rounds.find((r) => r.number === s.currentRound);
    const candidates = [
      s.nextMarketAt,
      ...s.jobs.map((j) => j.endsAt),
      ...s.auctions.filter((a) => a.status === 'open').map((a) => a.endsAt),
    ];
    if (r && !s.draft.active) {
      if (!s.processed.includes(`lock:${s.season}:${r.number}`)) candidates.push(r.locksAt);
      for (const m of r.matches)
        if (m.status === 'scheduled') candidates.push(m.startsAt);
        else if (m.status === 'live') candidates.push(m.endsAt);
    }
    const due = Math.min(...candidates);
    if (due > target || !Number.isFinite(due)) break;
    s.now = Math.max(s.now, due);
    for (const j of [...s.jobs]) if (j.endsAt <= s.now) completeJob(s, j);
    for (const a of s.auctions)
      if (a.status === 'open' && a.endsAt <= s.now) settleAuction(s, a.id);
    if (s.nextMarketAt <= s.now) {
      closeMarket(s);
      daily(s);
    }
    if (r && !s.draft.active) {
      if (r.locksAt <= s.now) lockRound(s, r);
      for (const m of r.matches) {
        if (m.startsAt <= s.now && m.status === 'scheduled') {
          m.status = 'live';
          r.status = 'live';
        }
        if (m.endsAt <= s.now && m.status === 'live') {
          m.status = 'finished';
          m.homeGoals = hash(m.id + ':' + s.season) % 4;
          m.awayGoals = hash(m.id + ':away' + s.season) % 3;
          for (const p of s.players.filter(
            (p) => p.realClubId === m.home || p.realClubId === m.away,
          ))
            r.scores[p.id] = mockScore(p, r.number);
          for (const c of s.clubs) autoSubs(s, c, r);
        }
      }
      if (r.matches.every((m) => m.status === 'finished') && !r.settled) settleRound(s, r);
    }
  }
  invariant(guard < 10000, 'Demasiados procesos pendientes.');
  s.now = target;
}
export function eventProgress(s: GameState, c: Club, id: string) {
  const event = s.events.find((e) => e.id === id);
  if (!event) return 0;
  switch (event.type) {
    case 'market':
      return s.transfers.filter(
        (t) => t.to === c.id && t.at >= event.startsAt && t.kind !== 'Asignación demo (simulada)',
      ).length;
    case 'development':
      return s.audit.filter(
        (a) => a.actor === c.id && a.action === 'job.complete' && a.at >= event.startsAt,
      ).length;
    case 'matchday':
      return s.rounds.filter(
        (r) =>
          r.settled && r.reports[c.id] && !r.reports[c.id].invalid && r.startsAt >= event.startsAt,
      ).length;
    case 'sport':
      return Math.max(
        0,
        ...s.rounds
          .filter((r) => r.startsAt >= event.startsAt)
          .map((r) => r.reports[c.id]?.points || 0),
      );
    case 'coach':
      return s.audit.filter(
        (a) => a.actor === c.id && a.action === 'daily' && a.at >= event.startsAt,
      ).length;
    case 'auction':
      return s.transfers.filter(
        (t) => t.to === c.id && t.kind === 'Subasta especial' && t.at >= event.startsAt,
      ).length;
  }
}
const str = (cmd: Command, key: string, max = 100) => {
  const x = cmd[key];
  invariant(typeof x === 'string' && x.length > 0 && x.length <= max, `Campo inválido: ${key}.`);
  return x;
};
const num = (cmd: Command, key: string, min = 0, max = 1e12) => {
  const x = cmd[key];
  invariant(
    typeof x === 'number' && Number.isSafeInteger(x) && x >= min && x <= max,
    `Cantidad inválida: ${key}.`,
  );
  return x;
};
export function execute(s: GameState, actor: Actor, cmd: Command) {
  const c = s.clubs.find((c) => c.id === actor.clubId && c.userId === actor.userId);
  invariant(c, 'No puedes operar sobre otro club.');
  const isAdmin = actor.userId === s.adminId;
  const type = cmd.type;
  invariant(typeof type === 'string', 'Acción inválida.');
  const r = s.rounds.find((r) => r.number === s.currentRound)!;
  switch (type) {
    case 'bid': {
      invariant(!s.draft.active, 'Termina el draft antes de operar en el mercado.');
      const id = str(cmd, 'playerId');
      invariant(
        s.marketPlayers.includes(id) && s.now < s.nextMarketAt,
        'Este agente libre ya no está disponible.',
      );
      const p = playerOf(s, id);
      invariant(!s.contracts.some((x) => x.playerId === id), 'El futbolista ya tiene propietario.');
      invariant(rosterUsage(s, c) < capacity(c), 'Plantilla completa.');
      const amount = num(cmd, 'amount', p.value);
      const salary = num(cmd, 'salaryBps', 200, 1000);
      const old = s.bids.find(
        (b) =>
          b.clubId === c.id &&
          b.playerId === id &&
          b.marketId === s.marketId &&
          b.status === 'open',
      );
      invariant(
        available(s, c, old?.id) >= amount,
        'Saldo insuficiente para reservar esta oferta.',
      );
      if (old) {
        old.amount = amount;
        old.salaryBps = salary;
        old.createdAt = s.now;
      } else
        s.bids.push({
          id: uid(),
          clubId: c.id,
          playerId: id,
          amount,
          salaryBps: salary,
          createdAt: s.now,
          status: 'open',
          marketId: s.marketId,
        });
      break;
    }
    case 'withdrawBid': {
      const b = s.bids.find((b) => b.id === str(cmd, 'id') && b.clubId === c.id);
      invariant(b && b.status === 'open', 'Oferta no disponible.');
      b.status = 'withdrawn';
      break;
    }
    case 'sell': {
      const id = str(cmd, 'playerId');
      const ct = s.contracts.find((x) => x.playerId === id && x.clubId === c.id);
      invariant(ct, 'El futbolista no es tuyo.');
      tradable(s, id);
      const p = playerOf(s, id);
      const amount = roundRatio(p.value, 8500 + effects(c).sale);
      resource(s, c, 'money', amount, `Venta de ${p.name}`);
      resource(s, c, 'fame', -2, 'Venta de futbolista');
      if (p.realClubId === c.favorite) resource(s, c, 'fans', -3, 'Venta de jugador apreciado');
      s.contracts = s.contracts.filter((x) => x !== ct);
      clearPlayerSelections(s, id);
      s.transfers.push({
        id: uid(),
        at: s.now,
        playerId: id,
        from: c.id,
        to: null,
        amount,
        kind: 'Venta al mercado',
      });
      news(
        s,
        'Mercado',
        `${c.name} traspasa a ${p.name}`,
        'El mercado ha aceptado la venta del futbolista.',
        c.id,
      );
      break;
    }
    case 'wish': {
      const id = str(cmd, 'playerId');
      playerOf(s, id);
      if (c.wish.includes(id)) c.wish = c.wish.filter((p) => p !== id);
      else {
        invariant(
          c.wish.length < effects(c).wish,
          'Investiga Negociador deportivo para ampliar tu lista.',
        );
        c.wish.push(id);
      }
      break;
    }
    case 'build':
    case 'research':
    case 'facility': {
      const target = str(cmd, 'target');
      const kind = type === 'build' ? 'building' : type === 'research' ? 'research' : 'facility';
      invariant(
        !s.jobs.some((j) => j.clubId === c.id && j.target === target && j.kind === kind),
        'La mejora ya está en curso.',
      );
      if (kind === 'research')
        invariant(
          !s.jobs.some((j) => j.clubId === c.id && j.kind === 'research'),
          'Solo puedes investigar una tecnología a la vez.',
        );
      else
        invariant(
          s.jobs.filter((j) => j.clubId === c.id && ['building', 'facility'].includes(j.kind))
            .length < (effects(c).secondQueue ? 2 : 1),
          'Todas las colas de construcción están ocupadas.',
        );
      const quote = jobQuote(c, kind, target);
      invariant(
        c.resources.development >= quote.development,
        'Puntos de desarrollo insuficientes.',
      );
      spend(s, c, quote.money, 'Inicio de mejora');
      if (quote.development)
        resource(s, c, 'development', -quote.development, 'Inicio de investigación');
      s.jobs.push({
        id: uid(),
        clubId: c.id,
        kind,
        target,
        level: quote.level,
        startedAt: s.now,
        endsAt: s.now + quote.duration,
        money: quote.money,
        development: quote.development,
      });
      break;
    }
    case 'cancelJob': {
      const j = s.jobs.find((j) => j.id === str(cmd, 'id') && j.clubId === c.id);
      invariant(j && j.kind !== 'research', 'Solo se pueden cancelar construcciones o cantera.');
      resource(s, c, 'money', Math.floor(j.money / 2), 'Cancelación de obra: devolución 50 %');
      resource(s, c, 'development', Math.floor(j.development / 2), 'Cancelación de obra');
      s.jobs = s.jobs.filter((x) => x !== j);
      break;
    }
    case 'lineup': {
      invariant(!c.selection.locked && s.now < r.locksAt, 'La convocatoria ya está cerrada.');
      const index = num(cmd, 'slot', 0, 10);
      const id = cmd.playerId === null ? null : str(cmd, 'playerId');
      if (id) {
        const p = playerOf(s, id);
        invariant(
          s.contracts.some((ct) => ct.playerId === id && ct.clubId === c.id),
          'Solo puedes alinear futbolistas propios.',
        );
        invariant(p.position === c.selection.starters[index].position, 'Demarcación incompatible.');
        c.selection.starters.forEach((slot) => {
          if (slot.playerId === id) slot.playerId = null;
        });
        c.selection.bench = c.selection.bench.filter((x) => x !== id);
      }
      c.selection.starters[index].playerId = id;
      break;
    }
    case 'autoLineup': {
      invariant(!c.selection.locked && s.now < r.locksAt, 'La convocatoria ya está cerrada.');
      const roster = owned(s, c).map((ct) => playerOf(s, ct.playerId));
      const used = new Set<string>();
      for (const slot of c.selection.starters) {
        const p = roster
          .filter((p) => p.position === slot.position && !used.has(p.id))
          .sort((a, b) => b.value - a.value)[0];
        slot.playerId = p?.id || null;
        if (p) used.add(p.id);
      }
      c.selection.bench = [];
      break;
    }
    case 'formation': {
      invariant(!c.selection.locked && s.now < r.locksAt, 'La convocatoria ya está cerrada.');
      const f = str(cmd, 'formation');
      invariant(
        Object.keys(FORMATIONS)
          .slice(0, 1 + (c.facilities.pitch || 0))
          .includes(f),
        'Formación bloqueada por el césped.',
      );
      const previous = c.selection.starters;
      c.selection.starters = FORMATIONS[f].map((position, i) => ({
        position,
        playerId: null,
        quality: previous[i]?.quality || 0,
        unlockedQuality: previous[i]?.unlockedQuality || 0,
      }));
      c.selection.bench = [];
      break;
    }
    case 'bench': {
      invariant(!c.selection.locked && s.now < r.locksAt, 'La convocatoria ya está cerrada.');
      const id = str(cmd, 'playerId');
      if (c.selection.bench.includes(id)) {
        c.selection.bench = c.selection.bench.filter((x) => x !== id);
        break;
      }
      const p = playerOf(s, id);
      invariant(
        owned(s, c).some((ct) => ct.playerId === id),
        'El futbolista no es tuyo.',
      );
      invariant(!c.selection.starters.some((x) => x.playerId === id), 'El jugador ya es titular.');
      invariant(
        c.selection.bench.length < RULES.bench[Math.min(7, c.facilities.bench || 0)][0],
        'Banquillo completo o bloqueado.',
      );
      invariant(
        !c.selection.bench.some((x) => playerOf(s, x).position === p.position),
        'Ya tienes un suplente de esta demarcación.',
      );
      c.selection.bench.push(id);
      break;
    }
    case 'ticket': {
      invariant(
        !c.selection.locked && s.now < r.locksAt,
        'La política de entradas está congelada.',
      );
      const p = str(cmd, 'policy');
      invariant(['economic', 'standard', 'premium'].includes(p), 'Política inválida.');
      c.ticketPolicy = p as Club['ticketPolicy'];
      break;
    }
    case 'manualSub': {
      invariant(
        c.selection.locked && c.selection.valid && !r.settled,
        'La jornada no admite cambios.',
      );
      invariant(c.selection.manual < effects(c).manual, 'Sin cambios manuales disponibles.');
      const slot = c.selection.starters[num(cmd, 'slot', 0, 10)];
      const sub = str(cmd, 'playerId');
      invariant(
        slot.playerId && c.selection.bench.includes(sub) && !c.selection.used.includes(sub),
        'Suplente no disponible.',
      );
      invariant(playerOf(s, sub).position === slot.position, 'Demarcación incompatible.');
      invariant(
        matchOf(s, r, slot.playerId).status === 'finished',
        'El partido del titular no ha terminado.',
      );
      invariant(
        matchOf(s, r, sub).status === 'scheduled' && matchOf(s, r, sub).startsAt > s.now,
        'El partido del suplente ya ha comenzado.',
      );
      const report = (r.reports[c.id] ??= blankReport());
      report.substitutions.push({ out: slot.playerId, in: sub, manual: true });
      slot.playerId = sub;
      c.selection.used.push(sub);
      c.selection.manual++;
      break;
    }
    case 'quality': {
      invariant(!c.selection.locked, 'No puedes modificar la calidad durante una jornada.');
      const slot = c.selection.starters[num(cmd, 'slot', 0, 10)];
      const level = num(cmd, 'level', 0, 3);
      if (level > slot.unlockedQuality) {
        invariant(
          level === slot.unlockedQuality + 1 && effects(c).quality >= level,
          'Investiga primero la calidad correspondiente.',
        );
        invariant(c.buildings.training >= level, 'Mejora el centro de entrenamiento.');
        const medals = level * 2;
        invariant(c.resources.medals >= medals, 'Medallas de élite insuficientes.');
        spend(s, c, euro(level * 100000), 'Mejora de casilla');
        resource(s, c, 'medals', -medals, 'Mejora de casilla');
        slot.unlockedQuality = level;
      }
      slot.quality = level;
      break;
    }
    case 'unlockModule': {
      const m = MODULES.find((m) => m.id === str(cmd, 'id'));
      invariant(m && !c.modules.includes(m.id), 'Módulo ya disponible o inexistente.');
      invariant(seasonDay(s) >= m.day, `Disponible a partir del día ${m.day}.`);
      invariant(!m.research || c.research[m.research] > 0, 'Completa la investigación requerida.');
      spend(s, c, m.cost, 'Desbloqueo de ' + m.name);
      c.modules.push(m.id);
      break;
    }
    case 'shield': {
      invariant(c.modules.includes('shield'), 'Desbloquea Blindajes en las oficinas.');
      const ct = owned(s, c).find((ct) => ct.playerId === str(cmd, 'playerId'));
      invariant(ct && !ct.loan, 'Contrato no disponible.');
      invariant(ct.shieldUntil <= s.now, 'El blindaje ya está activo.');
      spend(s, c, roundRatio(playerOf(s, ct.playerId).value, 5000), 'Blindaje de quince días');
      ct.shieldUntil = s.now + 15 * DAY;
      break;
    }
    case 'clause': {
      invariant(
        c.modules.includes('clauses') && seasonDay(s) >= 50,
        'Clausulazos bloqueados hasta el día 50 y desbloqueo de oficinas.',
      );
      const id = str(cmd, 'playerId');
      tradable(s, id);
      const ct = s.contracts.find((ct) => ct.playerId === id && ct.clubId !== c.id);
      invariant(ct, 'Contrato rival no encontrado.');
      invariant(ct.shieldUntil <= s.now, 'El futbolista está blindado.');
      invariant(rosterUsage(s, c) < capacity(c), 'Plantilla completa.');
      const seller = s.clubs.find((x) => x.id === ct.clubId)!;
      spend(s, c, ct.clause, 'Clausulazo');
      resource(s, seller, 'money', ct.clause, 'Cobro de cláusula');
      const amount = ct.clause;
      ct.clubId = c.id;
      clearPlayerSelections(s, id);
      s.transfers.push({
        id: uid(),
        at: s.now,
        playerId: id,
        from: seller.id,
        to: c.id,
        amount,
        kind: 'Clausulazo',
      });
      news(
        s,
        'Mercado',
        `${c.name} ejecuta una cláusula`,
        `${playerOf(s, id).name} deja ${seller.name}.`,
        c.id,
      );
      break;
    }
    case 'renegotiate': {
      invariant(c.modules.includes('renegotiate'), 'Desbloquea Renegociaciones en las oficinas.');
      const ct = owned(s, c).find((ct) => ct.playerId === str(cmd, 'playerId'));
      invariant(ct, 'Contrato no encontrado.');
      const salary = num(cmd, 'salaryBps', 50, 1000);
      invariant(salary < ct.salaryBps, 'El nuevo salario debe ser inferior.');
      spend(s, c, roundRatio(playerOf(s, ct.playerId).value, 3000), 'Renegociación contractual');
      ct.salaryBps = salary;
      break;
    }
    case 'notificationRead': {
      invariant(Array.isArray(cmd.ids) && cmd.ids.length <= 2000, 'Avisos inválidos.');
      const valid = new Set(
        notifications(
          s,
          c,
          effects(c),
          Object.fromEntries(s.events.map((e) => [e.id, eventProgress(s, c, e.id)])),
        ).map((n) => n.id),
      );
      c.notificationReads ??= {};
      for (const id of cmd.ids)
        if (typeof id === 'string' && valid.has(id)) c.notificationReads[id] = s.now;
      break;
    }
    case 'resourceVisibility': {
      invariant(typeof cmd.hidden === 'boolean', 'Preferencia inválida.');
      c.hideResources = cmd.hidden;
      break;
    }
    case 'daily':
    case 'dailyStart': {
      const id = str(cmd, 'id');
      const action = dailyActions(s).find((a) => a.id === id);
      invariant(
        !c.activity || !!c.activity.claimedAt,
        'Recoge la actividad actual antes de iniciar otra.',
      );
      invariant(action && !c.dailyDone.includes(id), 'Actividad no disponible o ya realizada.');
      invariant(c.buildings.hq >= action.minimumHQ, 'Mejora la sede central.');
      activityDay(c, dailyKey(s.now), c.dailyDone.length);
      spend(s, c, action.cost, action.name);
      c.activity = {
        id: uid(),
        offerDay: dailyKey(s.now),
        definition: structuredClone(action),
        startedAt: s.now,
        endsAt: s.now + action.duration,
      };
      break;
    }
    case 'dailyClaim': {
      const run = c.activity;
      invariant(run && !run.claimedAt && run.id === str(cmd, 'id'), 'No hay recompensa pendiente.');
      invariant(s.now >= run.endsAt, 'La actividad todavía no ha terminado.');
      resource(s, c, run.definition.resource, run.definition.reward, run.definition.name, run.id);
      for (const [key, amount] of Object.entries(run.definition.extra || {}))
        resource(s, c, key as Resource, amount, run.definition.name, run.id);
      const completedDay = activityDay(
        c,
        run.offerDay,
        run.offerDay === dailyKey(s.now) ? c.dailyDone.length : 0,
      );
      completedDay.completed++;
      delete completedDay.pendingRunId;
      completedDay.resolvedAt = s.now;
      run.claimedAt = s.now;
      news(
        s,
        'Actividades',
        `${c.name} deja huella`,
        `${run.definition.name}: actividad completada y recompensa recogida.`,
        c.id,
        run.id,
      );
      (c.activityHistory ??= []).push(structuredClone(run));
      if (run.offerDay === dailyKey(s.now)) c.dailyDone.push(run.definition.id);
      s.audit.push({ at: s.now, action: 'daily', actor: c.id, detail: run.definition.id });
      break;
    }
    case 'sponsor': {
      const brand = SPONSORS.find((x) => x.id === str(cmd, 'id'));
      invariant(
        brand && c.resources.fame >= brand.fame,
        'Fama insuficiente para este patrocinador.',
      );
      const slot = str(cmd, 'slot');
      invariant(AD_SLOTS.includes(slot), 'Espacio publicitario inválido.');
      if (slot.startsWith('Videomarcador')) {
        const n = Number(slot.at(-1));
        invariant(Math.min(3, c.facilities.scoreboard || 0) >= n, 'Mejora el videomarcador.');
      }
      invariant(
        !s.sponsors.some((d) => d.clubId === c.id && d.slot === slot && d.endsAt > s.now),
        'El espacio ya tiene patrocinador.',
      );
      const days = num(cmd, 'days', 7, 30);
      invariant([7, 14, 30].includes(days), 'Duración inválida.');
      spend(s, c, brand.cost, 'Alta de patrocinador');
      s.sponsors.push({
        id: uid(),
        clubId: c.id,
        sponsorId: brand.id,
        slot,
        startsAt: s.now,
        endsAt: s.now + days * DAY,
        daily: brand.daily,
        lastPaidDay: dailyKey(s.now),
      });
      news(
        s,
        'Patrocinadores',
        `${brand.name} apuesta por ${c.name}`,
        `Nuevo acuerdo en ${slot} durante ${days} días.`,
        c.id,
      );
      break;
    }
    case 'concert': {
      invariant(c.modules.includes('concerts'), 'Desbloquea Conciertos en las oficinas.');
      const a = concertOffers(s).find((a) => a.id === str(cmd, 'id'));
      invariant(a && c.buildings.stadium >= a.level, 'El estadio no cumple los requisitos.');
      invariant(
        !s.concerts.some((d) => d.clubId === c.id && d.endsAt > s.now),
        'Ya tienes un concierto activo.',
      );
      spend(s, c, a.cost, 'Organización del concierto');
      s.concerts.push({
        id: uid(),
        clubId: c.id,
        artistId: a.id,
        startsAt: s.now,
        endsAt: s.now + 14 * DAY,
        perRound: a.income,
      });
      resource(s, c, 'fans', a.fans, 'Nuevo concierto');
      resource(s, c, 'fame', 2, 'Anuncio de concierto');
      news(
        s,
        'Conciertos',
        `${a.name} llega al estadio de ${c.name}`,
        'Un cartel original y dos semanas de ingresos por jornada.',
        c.id,
      );
      break;
    }
    case 'institution': {
      invariant(
        s.now - c.lastInstitution >= RULES.institutionCooldown,
        'Debes esperar 48 horas entre decisiones institucionales.',
      );
      const a = INSTITUTIONS.find((a) => a.id === str(cmd, 'id'));
      invariant(a, 'Acción no encontrada.');
      if (!['campaign', 'bank', 'urgent'].includes(a.id))
        invariant(c.resources.prestige >= 20, 'Requiere al menos 20 de prestigio.');
      invariant(c.resources.money >= 0, 'No puedes negociar con saldo negativo.');
      if (['bank', 'urgent'].includes(a.id))
        invariant(
          !s.loans.some((l) => l.clubId === c.id && !l.settled),
          'Ya tienes un préstamo pendiente.',
        );
      spend(s, c, a.cost, a.name);
      c.lastInstitution = s.now;
      resource(s, c, 'money', a.money, a.name);
      resource(s, c, 'fame', a.fame, a.name);
      resource(s, c, 'prestige', a.prestige, a.name);
      if (['bank', 'urgent'].includes(a.id))
        s.loans.push({
          id: uid(),
          clubId: c.id,
          principal: a.money,
          repay: roundRatio(a.money, a.id === 'bank' ? 11000 : 20000),
          dueRound: s.currentRound,
          settled: false,
        });
      const roll = economicRandom(s.privateRng || s.id, `${s.id}:${c.id}:${s.now}:${a.id}`) * 100;
      s.audit.push({
        at: s.now,
        actor: c.id,
        action: 'institution',
        detail: JSON.stringify({ id: a.id, risk: a.risk, roll }),
      });
      if (roll < a.risk) {
        resource(s, c, 'money', -euro(600000), 'Multa por escándalo');
        resource(s, c, 'fame', -10, 'Escándalo institucional');
        resource(s, c, 'prestige', -12, 'Escándalo institucional');
        if (a.id === 'leverage') {
          c.totalPoints -= 500;
        }
        news(
          s,
          'Escándalos',
          `El palco de ${c.name}, bajo los focos`,
          'El comité ficticio sanciona una operación irregular. Multa y daño reputacional; la palanca resta 5 puntos.',
          c.id,
        );
      } else if (a.id === 'favor') {
        for (const j of s.jobs.filter((j) => j.clubId === c.id && j.kind === 'building'))
          j.endsAt = Math.max(s.now + HOUR, j.endsAt - 6 * HOUR);
      }
      break;
    }
    case 'chat': {
      const text = str(cmd, 'text', 500).trim();
      invariant(text, 'Escribe un mensaje.');
      const last = s.chat.filter((m) => m.clubId === c.id).at(-1);
      invariant(
        !last || s.now - last.at >= 1000,
        'Espera un segundo antes de enviar otro mensaje.',
      );
      s.chat.push({ id: uid(), clubId: c.id, text, at: s.now });
      break;
    }
    case 'deleteMessage': {
      invariant(isAdmin, 'Solo el administrador puede moderar.');
      s.chat = s.chat.filter((m) => m.id !== str(cmd, 'id'));
      break;
    }
    case 'eventClaim': {
      const e = s.events.find((e) => e.id === str(cmd, 'id'));
      invariant(e && s.now >= e.startsAt && s.now < e.endsAt, 'Evento no disponible.');
      invariant(!c.eventClaims.includes(e.id), 'Recompensa ya cobrada.');
      invariant(eventProgress(s, c, e.id) >= e.goal, 'Objetivo pendiente.');
      resource(s, c, 'money', e.reward.money, 'Recompensa: ' + e.title);
      resource(s, c, 'development', e.reward.development, 'Recompensa: ' + e.title);
      resource(s, c, 'medals', e.reward.medals, 'Recompensa: ' + e.title);
      c.eventClaims.push(e.id);
      c.trophies.push({
        id: uid(),
        title: e.title,
        season: s.season,
        at: s.now,
        detail: 'Objetivo de evento completado',
      });
      if (e.type === 'coach') {
        const coach = COACHES[1 + (hash(c.id + e.id) % (COACHES.length - 1))].id;
        c.coachInventory ??= ['generic'];
        if (!c.coachInventory.includes(coach)) c.coachInventory.push(coach);
        c.coach = coach;
      }
      break;
    }
    case 'coach': {
      const id = str(cmd, 'id');
      invariant(
        (c.coachInventory || ['generic', c.coach]).includes(id),
        'Solo puedes seleccionar tu entrenador desbloqueado.',
      );
      c.coach = id;
      break;
    }
    case 'academy': {
      invariant(
        !s.jobs.some((j) => j.clubId === c.id && j.kind === 'academy'),
        'Ya tienes un proyecto de cantera.',
      );
      invariant(
        !s.processed.includes(
          `academy:${s.season}:${c.id}:${Math.floor((s.now - s.seasonStartedAt) / (7 * DAY))}`,
        ),
        'Solo un proyecto de cantera por semana.',
      );
      invariant(rosterUsage(s, c) < capacity(c), 'Plantilla completa.');
      spend(s, c, euro(50000), 'Proyecto de cantera');
      s.jobs.push({
        id: uid(),
        clubId: c.id,
        kind: 'academy',
        target: 'academy',
        level: 1,
        startedAt: s.now,
        endsAt: s.now + DAY,
        money: euro(50000),
        development: 0,
      });
      s.processed.push(
        `academy:${s.season}:${c.id}:${Math.floor((s.now - s.seasonStartedAt) / (7 * DAY))}`,
      );
      break;
    }
    case 'negotiate': {
      const id = str(cmd, 'playerId');
      tradable(s, id);
      const ct = s.contracts.find((ct) => ct.playerId === id);
      invariant(ct && ct.clubId !== c.id, 'Debes negociar por un futbolista rival.');
      const amount = num(cmd, 'amount', 0);
      const offered = cmd.offeredPlayerId ? str(cmd, 'offeredPlayerId') : undefined;
      if (offered) {
        invariant(
          owned(s, c).some((ct) => ct.playerId === offered),
          'No puedes ofrecer un futbolista ajeno.',
        );
        tradable(s, offered);
      }
      invariant(available(s, c) >= amount, 'Saldo insuficiente.');
      const loanRounds = cmd.loanRounds ? num(cmd, 'loanRounds', 1, 3) : undefined;
      if (loanRounds)
        invariant(
          c.modules.includes('loans') && !offered,
          'Las cesiones requieren su módulo y no admiten intercambio.',
        );
      s.negotiations.push({
        id: uid(),
        from: c.id,
        to: ct.clubId,
        playerId: id,
        offeredPlayerId: offered,
        amount,
        status: 'open',
        at: s.now,
        loanRounds,
      });
      break;
    }
    case 'respondTrade': {
      const n = s.negotiations.find(
        (n) => n.id === str(cmd, 'id') && n.status === 'open' && n.to === c.id,
      );
      invariant(n, 'Negociación no disponible.');
      if (cmd.accept !== true) {
        n.status = 'rejected';
        break;
      }
      tradable(s, n.playerId);
      const ct = owned(s, c).find((ct) => ct.playerId === n.playerId);
      invariant(ct, 'El futbolista ya no pertenece al vendedor.');
      const buyer = s.clubs.find((c) => c.id === n.from)!;
      const offered = n.offeredPlayerId
        ? s.contracts.find((ct) => ct.playerId === n.offeredPlayerId && ct.clubId === buyer.id)
        : undefined;
      if (n.offeredPlayerId) {
        invariant(offered, 'El jugador ofrecido ya no está disponible.');
        tradable(s, n.offeredPlayerId);
      }
      invariant(
        rosterUsage(s, buyer) - (offered ? 1 : 0) < capacity(buyer),
        'El comprador no tiene plazas.',
      );
      if (offered) invariant(rosterUsage(s, c) <= capacity(c), 'El vendedor no tiene plazas.');
      spend(s, buyer, n.amount, 'Acuerdo entre clubes');
      resource(s, c, 'money', n.amount, 'Acuerdo entre clubes');
      ct.clubId = buyer.id;
      if (n.loanRounds) ct.loan = { from: c.id, untilRound: s.currentRound + n.loanRounds - 1 };
      if (offered) {
        offered.clubId = c.id;
        clearPlayerSelections(s, offered.playerId);
        s.transfers.push({
          id: uid(),
          at: s.now,
          playerId: offered.playerId,
          from: buyer.id,
          to: c.id,
          amount: 0,
          kind: 'Intercambio',
        });
      }
      clearPlayerSelections(s, ct.playerId);
      s.transfers.push({
        id: uid(),
        at: s.now,
        playerId: ct.playerId,
        from: c.id,
        to: buyer.id,
        amount: n.amount,
        kind: n.loanRounds ? 'Cesión' : 'Acuerdo directo',
      });
      n.status = 'accepted';
      news(
        s,
        'Mercado',
        `${buyer.name} y ${c.name} cierran un acuerdo`,
        `${playerOf(s, ct.playerId).name} cambia de club.`,
        buyer.id,
      );
      break;
    }
    case 'counterTrade': {
      const n = s.negotiations.find(
        (n) => n.id === str(cmd, 'id') && n.status === 'open' && n.to === c.id,
      );
      invariant(n, 'Negociación no disponible.');
      n.amount = num(cmd, 'amount', 0);
      n.status = 'countered';
      break;
    }
    case 'acceptCounter': {
      const n = s.negotiations.find(
        (n) => n.id === str(cmd, 'id') && n.status === 'countered' && n.from === c.id,
      );
      invariant(n, 'Contraoferta no disponible.');
      n.status = 'open';
      execute(
        s,
        { userId: s.clubs.find((c) => c.id === n.to)!.userId, clubId: n.to, admin: false },
        { type: 'respondTrade', id: n.id, accept: true },
      );
      break;
    }
    case 'auctionBid': {
      const a = s.auctions.find((a) => a.id === str(cmd, 'id') && a.status === 'open');
      invariant(a && a.endsAt > s.now, 'La subasta ha terminado.');
      invariant(rosterUsage(s, c) < capacity(c), 'Plantilla completa.');
      const amount = num(
        cmd,
        'amount',
        Math.max(playerOf(s, a.playerId).value, a.highest + euro(100000)),
      );
      invariant(available(s, c, a.id) >= amount, 'Presupuesto insuficiente.');
      a.highest = amount;
      a.clubId = c.id;
      a.bids.push({ clubId: c.id, amount, at: s.now });
      if (a.kind === 'special' && a.endsAt - s.now < 30000) a.endsAt = s.now + 30000;
      break;
    }
    case 'nextAuction': {
      invariant(isAdmin, 'Solo el administrador presenta jugadores.');
      invariant(
        !s.auctions.some((a) => a.status === 'open' && a.kind === 'draft'),
        'Ya hay una subasta de draft activa.',
      );
      invariant(s.draft.active, 'El draft no está activo.');
      const requested = cmd.playerId ? str(cmd, 'playerId') : s.draft.queue[0];
      const id = s.draft.queue.find(
        (id) => id === requested && !s.contracts.some((ct) => ct.playerId === id),
      );
      invariant(id, 'No quedan jugadores disponibles en el orden del draft.');
      s.draft.queue = s.draft.queue.filter((x) => x !== id);
      s.auctions.push({
        id: uid(),
        playerId: id,
        kind: 'draft',
        endsAt: s.now + 60000,
        highest: 0,
        clubId: null,
        bids: [],
        status: 'open',
      });
      break;
    }
    case 'finishDraft': {
      invariant(
        isAdmin && s.draft.active,
        'Solo el administrador puede finalizar el draft activo.',
      );
      invariant(
        !s.auctions.some((a) => a.status === 'open' && a.kind === 'draft'),
        'Espera a que termine la subasta actual.',
      );
      s.draft.active = false;
      s.draft.finished = true;
      for (const club of s.clubs)
        resource(s, club, 'money', RULES.draftGift, 'Prima de finalización de draft');
      const start = s.now + 2 * DAY;
      s.rounds = [makeRound(1, start)];
      s.currentRound = 1;
      break;
    }
    case 'specialAuction': {
      invariant(
        isAdmin && !s.draft.active,
        'Solo el administrador puede abrir este evento tras el draft.',
      );
      invariant(
        !s.auctions.some((a) => a.status === 'open' && a.kind === 'special'),
        'Ya hay una subasta especial activa.',
      );
      const p = s.players.find(
        (p) => !s.contracts.some((ct) => ct.playerId === p.id) && !s.marketPlayers.includes(p.id),
      );
      invariant(p, 'No quedan agentes libres.');
      s.auctions.push({
        id: uid(),
        playerId: p.id,
        kind: 'special',
        endsAt: s.now + 2 * HOUR,
        highest: 0,
        clubId: null,
        bids: [],
        status: 'open',
      });
      break;
    }
    case 'identity': {
      const name = str(cmd, 'name', 40).trim();
      invariant(name.length >= 3, 'El nombre debe tener al menos tres caracteres.');
      const color = str(cmd, 'color');
      invariant(/^#[0-9a-f]{6}$/i.test(color), 'Color inválido.');
      spend(s, c, euro(100000), 'Cambio de identidad');
      c.name = name;
      c.color = color;
      resource(s, c, 'fame', -1, 'Cambio de identidad');
      break;
    }
    case 'resetSeason': {
      invariant(isAdmin, 'Solo el administrador puede reiniciar la temporada.');
      const ranking = s.clubs
        .toSorted((a, b) => b.totalPoints - a.totalPoints)
        .map((c) => ({ id: c.id, name: c.name, points: c.totalPoints }));
      if (ranking[0]) {
        const winner = s.clubs.find((c) => c.id === ranking[0].id)!;
        winner.trophies.push({
          id: uid(),
          at: s.now,
          season: s.season,
          title: `Campeón · Temporada ${s.season}`,
          detail: `${winner.totalPoints / 100} puntos`,
        });
      }
      const archives = [...s.archives, { season: s.season, at: s.now, ranking }];
      const fresh = createGame(s.now, false, s.adminId, s.name);
      fresh.id = s.id;
      fresh.invite = s.invite;
      fresh.season = s.season + 1;
      fresh.timeOffset = s.timeOffset;
      fresh.archives = archives;
      fresh.clubs = s.clubs.map((c) => {
        const base = createGame(s.now, true).clubs[0];
        return {
          ...base,
          id: c.id,
          userId: c.userId,
          name: c.name,
          color: c.color,
          favorite: c.favorite,
          resources: {
            money: RULES.initialBudget,
            development: 100,
            medals: 0,
            fame: 0,
            prestige: 25,
            luck: 0,
            fans: 60,
          },
          selection: emptySelection(1),
          trophies: c.trophies,
          hideResources: c.hideResources,
          notificationReads: c.notificationReads,
        };
      });
      fresh.ledger = s.ledger;
      fresh.transfers = [];
      Object.assign(s, fresh);
      news(
        s,
        'Temporadas',
        `Comienza la temporada ${s.season}`,
        'Presupuestos y progresión reiniciados. El museo conserva la historia.',
      );
      break;
    }
    default:
      throw new Error('Acción desconocida.');
  }
  if (!['notificationRead', 'resourceVisibility'].includes(type))
    s.audit.push({
      at: s.now,
      action: type === 'daily' ? 'dailyStart' : type,
      actor: c.id,
      detail: JSON.stringify(cmd),
    });
  s.version++;
  return s;
}
/** Persist event first-seen and action resolution on every authoritative transaction/tick. */
export function syncAttention(s: GameState) {
  for (const c of s.clubs) {
    const items = notifications(
      s,
      c,
      effects(c),
      Object.fromEntries(s.events.map((e) => [e.id, eventProgress(s, c, e.id)])),
    );
    c.notificationEvents ??= {};
    const live = new Set(items.filter((n) => n.status === 'pending').map((n) => n.id));
    for (const n of items) {
      c.notificationEvents[n.id] ??= { firstSeenAt: n.at };
      if (n.status === 'resolved') c.notificationEvents[n.id].resolvedAt ??= s.now;
      else delete c.notificationEvents[n.id].resolvedAt;
    }
    for (const [id, event] of Object.entries(c.notificationEvents))
      if (!live.has(id)) event.resolvedAt ??= s.now;
  }
}
// La respuesta pública nunca entrega pujas rivales abiertas ni información privada de negociaciones.
export function publicState(s: GameState, userId: string) {
  const c = s.clubs.find((c) => c.userId === userId);
  invariant(c, 'No perteneces a esta liga.');
  const out = structuredClone(s);
  out.privateRng = undefined;
  for (const m of out.chat)
    if (
      m.at === s.seasonStartedAt - 180000 &&
      m.text === '¡Bienvenidos! Esta temporada la corona se queda en el barrio.'
    )
      m.text = '¡Bienvenidos! Esta temporada el título se queda en el barrio.';
  for (const n of out.news)
    if (n.title === 'La corona busca nuevo dueño') n.title = 'La liga busca nuevo campeón';
  const history = c.modules.includes('bidhistory');
  out.bids = out.bids.filter(
    (b) => b.clubId === c.id || (b.status !== 'open' && (b.status === 'won' || history)),
  );
  out.audit = out.audit.filter((a) => a.actor === c.id && a.action !== 'market.acceptance');
  out.ledger = out.ledger.filter((l) => l.clubId === c.id);
  out.negotiations = out.negotiations.filter((n) => n.from === c.id || n.to === c.id);
  out.invite = userId === s.adminId ? s.invite : '';
  out.clubs = out.clubs.map((club) =>
    club.id === c.id
      ? club
      : {
          ...club,
          dailyDone: [],
          activity: undefined,
          activityHistory: undefined,
          activityDays: undefined,
          notificationReads: undefined,
          notificationEvents: undefined,
          hideResources: undefined,
          selection: {
            ...club.selection,
            bench: club.selection.locked ? club.selection.bench : [],
            starters: club.selection.locked ? club.selection.starters : [],
            snapshots: {},
          },
        },
  );
  return {
    state: out,
    clubId: c.id,
    admin: userId === s.adminId,
    available: available(s, c),
    effects: effects(c),
    daily: dailyActions(s),
    notifications: notifications(
      s,
      c,
      effects(c),
      Object.fromEntries(s.events.map((e) => [e.id, eventProgress(s, c, e.id)])),
    ),
    concertOffers: concertOffers(s),
    eventProgress: Object.fromEntries(s.events.map((e) => [e.id, eventProgress(s, c, e.id)])),
  };
}
