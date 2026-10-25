import { DEFAULT_FANTASY, populateFantasy } from './fantasy.js';
import { BUILDINGS, DAY, FORMATIONS, RULES, euro } from './config.js';
import { dailyKey, nextMarket } from './math.js';
import { mockMatches, roster } from './sports.js';
import type { Club, GameEvent, GameState, Round, Selection } from './types.js';
export const uid = () => crypto.randomUUID();
export function emptySelection(round: number): Selection {
  return {
    round,
    starters: FORMATIONS['4-4-2'].map((position) => ({
      position,
      playerId: null,
      quality: 0,
      unlockedQuality: 0,
    })),
    bench: [],
    policy: 'standard',
    locked: false,
    valid: true,
    cost: 0,
    snapshots: {},
    used: [],
    manual: 0,
  };
}
export function makeClub(
  userId: string,
  name: string,
  favorite = 'madrid',
  color = '#bf9b50',
  now = Date.now(),
): Club {
  return {
    id: uid(),
    userId,
    name,
    color,
    favorite,
    coach: 'generic',
    coachInventory: ['generic'],
    resources: {
      money: RULES.initialBudget,
      development: 100,
      medals: 0,
      fame: 0,
      prestige: 25,
      luck: 0,
      fans: 60,
    },
    buildings: Object.fromEntries(BUILDINGS.filter((b) => b.max).map((b) => [b.id, 1])),
    facilities: {},
    modules: ['contracts', 'trades'],
    research: {},
    selection: emptySelection(1),
    totalPoints: 0,
    roundPoints: 0,
    dailyDone: [],
    lastInstitution: now - 2 * DAY,
    wish: [],
    trophies: [],
    eventClaims: [],
    ticketPolicy: 'standard',
  };
}
export function makeRound(number: number, start: number): Round {
  return {
    number,
    startsAt: start,
    locksAt: start - 3600000,
    status: 'upcoming',
    settled: false,
    matches: mockMatches(number, start),
    scores: {},
    reports: {},
  };
}
export function makeEvents(now: number, week = 1): GameEvent[] {
  return [
    {
      type: 'market',
      title: 'Buen ojo',
      description: 'Completa dos fichajes en el mercado.',
      goal: 2,
    },
    {
      type: 'development',
      title: 'El club del mañana',
      description: 'Completa dos mejoras de edificios o investigaciones.',
      goal: 2,
    },
    {
      type: 'matchday',
      title: 'Día de recompensas',
      description: 'Participa en una jornada con convocatoria válida.',
      goal: 1,
    },
    {
      type: 'sport',
      title: 'Once con ambición',
      description: 'Consigue 40 puntos en una jornada.',
      goal: 4000,
    },
    {
      type: 'coach',
      title: 'Una nueva mirada',
      description: 'Completa tres actividades diarias para atraer un entrenador.',
      goal: 3,
    },
    {
      type: 'auction',
      title: 'La última palabra',
      description: 'Gana una subasta pública especial.',
      goal: 1,
    },
  ].map((x, i) => ({
    ...x,
    id: `w${week}-${x.type}`,
    type: x.type as GameEvent['type'],
    startsAt: now,
    endsAt: now + 7 * DAY,
    reward: { money: euro(100000 + i * 25000), development: 75, medals: i === 4 ? 2 : 1 },
  }));
}
export function createGame(
  now = Date.now(),
  demo = true,
  adminId = 'demo1',
  name = 'La Liga de los Elegidos',
): GameState {
  const players = roster(now);
  const clubs = demo
    ? [
        ...DEFAULT_FANTASY.teams.map((t) => ({ name: t.name, favorite: t.favorite })),
        { name: DEFAULT_FANTASY.reservedName, favorite: 'madrid' },
      ].map((t, i) =>
        makeClub(
          `demo${i + 1}`,
          t.name,
          t.favorite,
          ['#b5944c', '#b26252', '#758bb4', '#60977a', '#6c9ca2', '#9e759b'][i],
          now,
        ),
      )
    : [];
  const s: GameState = {
    privateRng: uid(),
    version: 1,
    id: uid(),
    name,
    invite: uid().replaceAll('-', '').slice(0, 12).toUpperCase(),
    adminId,
    season: 1,
    seasonStartedAt: now,
    seasonEndsAt: now + 266 * DAY,
    timeOffset: 0,
    now,
    lastDaily: dailyKey(now),
    nextMarketAt: nextMarket(now),
    marketId: 1,
    marketPlayers: [],
    clubs,
    players,
    contracts: [],
    jobs: [],
    bids: [],
    auctions: [],
    draft: {
      active: !demo,
      finished: demo,
      queue: players.filter((p) => p.value < euro(3000000)).map((p) => p.id),
    },
    rounds: [makeRound(1, now + 2 * DAY)],
    currentRound: 1,
    ledger: [],
    news: [],
    chat: [],
    sponsors: [],
    concerts: [],
    loans: [],
    negotiations: [],
    transfers: [],
    events: makeEvents(now),
    archives: [],
    processed: [],
    audit: [],
  };
  s.marketPlayers = players
    .filter((p) => !s.contracts.some((c) => c.playerId === p.id))
    .sort((a, b) => Number(a.simulated) - Number(b.simulated))
    .slice(0, 5)
    .map((p) => p.id);
  s.news = [
    {
      id: uid(),
      at: now,
      category: 'Liga',
      title: 'La liga busca nuevo campeón',
      subtitle: `${clubs.length} clubes abren una temporada de ambición en ${name}. Los resultados deportivos de esta partida son simulados.`,
    },
  ];
  if (demo) populateFantasy(s);
  return s;
}
