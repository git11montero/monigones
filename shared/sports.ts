import catalog from '../data/sports/laliga-2026-27.json' with { type: 'json' };
import { z } from 'zod';
import { euro } from './config.js';
import { hash, random } from './math.js';
import type { Player, PlayerScore, Position, RealClub, Match } from './types.js';
export const REAL_CLUBS: RealClub[] = [
  ['athletic', 'Athletic Club', 'ATH', '#c94443'],
  ['atletico', 'Atlético de Madrid', 'ATM', '#c84748'],
  ['osasuna', 'CA Osasuna', 'OSA', '#a9323c'],
  ['celta', 'RC Celta', 'CEL', '#6caece'],
  ['alaves', 'Deportivo Alavés', 'ALA', '#5686bc'],
  ['elche', 'Elche CF', 'ELC', '#499269'],
  ['barcelona', 'FC Barcelona', 'BAR', '#9a4268'],
  ['getafe', 'Getafe CF', 'GET', '#4270b2'],
  ['levante', 'Levante UD', 'LEV', '#9a4353'],
  ['malaga', 'Málaga CF', 'MAL', '#70b9d2'],
  ['racing', 'Racing de Santander', 'RAC', '#418465'],
  ['deportivo', 'RC Deportivo', 'DEP', '#719ac5'],
  ['espanyol', 'RCD Espanyol', 'ESP', '#5986c1'],
  ['betis', 'Real Betis', 'BET', '#47966c'],
  ['madrid', 'Real Madrid', 'RMA', '#9a90af'],
  ['sociedad', 'Real Sociedad', 'RSO', '#5c8ac4'],
  ['sevilla', 'Sevilla FC', 'SEV', '#cc5555'],
  ['valencia', 'Valencia CF', 'VAL', '#d1844b'],
  ['villarreal', 'Villarreal CF', 'VIL', '#cabd42'],
  ['rayo', 'Rayo Vallecano', 'RAY', '#ce6961'],
].map(([id, name, short, color]) => ({
  id,
  name,
  short,
  color,
  source: 'https://www.laliga.com/laliga-easports/clubes',
}));
export const clubById = (id: string) => REAL_CLUBS.find((c) => c.id === id)!;
export const SPORTS_VERSION = catalog.version;
/** Verified identities; prices and match points remain deterministic simulator values. */
export function roster(now: number): Player[] {
  return catalog.players.map((p) => {
    const value = euro(1_500_000 + (hash(p.name) % 18_000_000));
    return {
      id: p.id,
      name: p.name,
      fullName: p.fullName,
      realClubId: p.realClubId,
      position: p.position as Position,
      externalIds: p.externalIds,
      season: p.season,
      value,
      valueHistory: [{ at: now, value }],
      simulated: false,
      source: p.source,
      verifiedAt: p.verifiedAt,
      status: 'available',
    };
  });
}
export interface CoachData {
  id: string;
  name: string;
  clubId?: string;
  sportBonus: number;
  simulated: boolean;
  source?: string;
}
export const COACHES: CoachData[] = [
  { id: 'generic', name: 'Álex del Campo', sportBonus: 0, simulated: true },
  {
    id: 'flick',
    name: 'Hansi Flick',
    clubId: 'barcelona',
    sportBonus: 300,
    simulated: false,
    source:
      'https://as.com/futbol/primera/fc-barcelona-en-laliga-ea-sports-202627-plantilla-fichajes-bajas-figuras-y-claves-de-la-temporada-f202608-n/',
  },
  {
    id: 'mourinho',
    name: 'José Mourinho',
    clubId: 'madrid',
    sportBonus: 300,
    simulated: false,
    source:
      'https://as.com/futbol/primera/real-madrid-en-laliga-ea-sports-202627-plantilla-fichajes-bajas-figuras-y-claves-de-la-temporada-f202608-n/',
  },
  {
    id: 'simeone',
    name: 'Diego Simeone',
    clubId: 'atletico',
    sportBonus: 300,
    simulated: false,
    source:
      'https://as.com/futbol/primera/atletico-de-madrid-en-laliga-ea-sports-202627-plantilla-fichajes-bajas-figuras-y-claves-de-la-temporada-f202608-n/',
  },
];
export interface SportsProvider {
  getSeason(): Promise<{ id: string; simulated: boolean }>;
  getClubs(): Promise<RealClub[]>;
  getPlayers(): Promise<Player[]>;
  getCalendar(round: number, start: number): Promise<Match[]>;
  getMatchdays(): Promise<number[]>;
  getMatches(round: number, start: number): Promise<Match[]>;
  getResults(matches: Match[]): Promise<Match[]>;
  getStatistics(players: Player[], round: number): Promise<PlayerScore[]>;
  getScores(players: Player[], round: number): Promise<PlayerScore[]>;
  getMarketValue(player: Player): Promise<number>;
  getValueHistory(player: Player): Promise<Player['valueHistory']>;
  getCoaches(): Promise<CoachData[]>;
  syncRoster(): Promise<{ version: string; updatedAt: string }>;
  getLastUpdated(): Promise<string>;
}
export function mockMatches(round: number, start: number): Match[] {
  const ids = REAL_CLUBS.map((c) => c.id);
  const fixed = ids[0];
  const others = ids.slice(1);
  for (let r = 1; r < round % 19; r++) others.unshift(others.pop()!);
  const order = [fixed, ...others];
  return Array.from({ length: 10 }, (_, i) => ({
    id: `r${round}m${i}`,
    home: order[i],
    away: order[19 - i],
    startsAt: start + i * 2 * 3600000,
    endsAt: start + i * 2 * 3600000 + 2 * 3600000,
    status: 'scheduled',
  }));
}
export function mockScore(p: Player, round: number): PlayerScore {
  const seed = `${p.id}:${round}`;
  const minutes = random(seed + 'minutes') < 0.17 ? 0 : 60 + (hash(seed) % 31);
  const goals =
    minutes && p.position !== 'POR' && random(seed + 'goals') > 0.87
      ? 1 + (hash(seed + 'g') % 2)
      : 0;
  const assists = minutes && random(seed + 'a') > 0.89 ? 1 : 0;
  return {
    playerId: p.id,
    minutes,
    goals,
    assists,
    points: minutes ? -200 + (hash(seed) % 1101) + goals * 300 + assists * 150 : 0,
  };
}
export class MockSportsProvider implements SportsProvider {
  async getSeason() {
    return { id: '2026/27', simulated: true };
  }
  async getClubs() {
    return REAL_CLUBS;
  }
  async getPlayers() {
    return roster(Date.now());
  }
  async getCalendar(r: number, s: number) {
    return mockMatches(r, s);
  }
  async getMatchdays() {
    return Array.from({ length: 38 }, (_, i) => i + 1);
  }
  async getMatches(r: number, s: number) {
    return mockMatches(r, s);
  }
  async getResults(m: Match[]) {
    return m.map((x) => ({
      ...x,
      status: 'finished' as const,
      homeGoals: hash(x.id) % 4,
      awayGoals: hash(x.id + 'a') % 3,
    }));
  }
  async getStatistics(p: Player[], r: number) {
    return p.map((x) => mockScore(x, r));
  }
  async getScores(p: Player[], r: number) {
    return this.getStatistics(p, r);
  }
  async getMarketValue(p: Player) {
    return p.value;
  }
  async getValueHistory(p: Player) {
    return p.valueHistory;
  }
  async getCoaches() {
    return COACHES;
  }
  async syncRoster() {
    return { version: SPORTS_VERSION, updatedAt: '2026-10-25' };
  }
  async getLastUpdated() {
    return '2026-10-25';
  }
}
export const ImportSchema = z
  .object({
    version: z.string().min(1),
    players: z
      .array(
        z.object({
          id: z.string().min(1),
          name: z.string().min(2).max(100),
          realClubId: z.enum(REAL_CLUBS.map((c) => c.id) as [string, ...string[]]),
          position: z.enum(['POR', 'DEF', 'MED', 'DEL']),
          value: z.number().int().positive().max(100_000_000_000),
          simulated: z.boolean(),
          source: z.url().optional(),
          verifiedAt: z.string().optional(),
          fullName: z.string().min(2).max(150).optional(),
          season: z.string().optional(),
          externalIds: z.record(z.string(), z.string()).optional(),
        }),
      )
      .max(5000),
  })
  .superRefine((v, c) => {
    const seen = new Set<string>();
    for (const p of v.players) {
      if (seen.has(p.id))
        c.addIssue({ code: 'custom', message: `Identificador duplicado: ${p.id}` });
      seen.add(p.id);
      if (!p.simulated && !p.source)
        c.addIssue({ code: 'custom', message: `Falta fuente: ${p.name}` });
    }
  });
export function normalizeImport(input: unknown, at = Date.now()) {
  const data = ImportSchema.parse(input);
  return {
    version: data.version,
    players: data.players.map((p) => ({
      ...p,
      name: p.name.trim().normalize('NFC'),
      status: 'available' as const,
      valueHistory: [{ at, value: p.value }],
    })),
  };
}
export class ImportSportsProvider extends MockSportsProvider {
  constructor(private input: unknown) {
    super();
  }
  override async getPlayers() {
    return normalizeImport(this.input).players;
  }
  static fromCSV(csv: string) {
    const lines = csv.trim().split(/\r?\n/);
    const headers = lines.shift()!.split(',');
    invariantCSV(headers.join(',') === 'id,name,realClubId,position,value,simulated,source');
    const players = lines.map((l) => {
      const cols =
        l
          .match(/("(?:[^"]|"")*"|[^,]*)(,|$)/g)
          ?.map((x) => x.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')) || [];
      const row = Object.fromEntries(headers.map((h, i) => [h, cols[i]]));
      return {
        ...row,
        value: Number(row.value),
        simulated: row.simulated === 'true',
        source: row.source || undefined,
      };
    });
    return new ImportSportsProvider({ version: 'csv-1', players });
  }
}
function invariantCSV(ok: boolean) {
  if (!ok) throw Error('Cabecera CSV inválida. Consulta docs/SPORTS_DATA.md.');
}
export abstract class ExternalSportsProvider implements SportsProvider {
  abstract getSeason: SportsProvider['getSeason'];
  abstract getClubs: SportsProvider['getClubs'];
  abstract getPlayers: SportsProvider['getPlayers'];
  abstract getCalendar: SportsProvider['getCalendar'];
  abstract getMatchdays: SportsProvider['getMatchdays'];
  abstract getMatches: SportsProvider['getMatches'];
  abstract getResults: SportsProvider['getResults'];
  abstract getStatistics: SportsProvider['getStatistics'];
  abstract getScores: SportsProvider['getScores'];
  abstract getMarketValue: SportsProvider['getMarketValue'];
  abstract getValueHistory: SportsProvider['getValueHistory'];
  abstract getCoaches: SportsProvider['getCoaches'];
  abstract syncRoster: SportsProvider['syncRoster'];
  abstract getLastUpdated: SportsProvider['getLastUpdated'];
}
