import { z } from 'zod';
import { euro } from './config';
import { hash, random } from './math';
import type { Player, PlayerScore, Position, RealClub, Match } from './types';
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
export const SPORTS_VERSION = '2026-10-23.2';
// Exclusivamente altas verificadas en las páginas citadas. Los valores y estados son del simulador.
const verified: Record<string, Record<Position, string[]>> = {
  barcelona: {
    POR: ['Joan García', 'Szczesny', 'Dominik Livakovic'],
    DEF: [
      'Pau Cubarsí',
      'Gerard Martín',
      'Christensen',
      'Eric García',
      'Jules Koundé',
      'João Cancelo',
      'Alejandro Balde',
    ],
    MED: ['Pedri', 'Rodri', 'Frenkie de Jong', 'Dani Olmo', 'Fermín López', 'Marc Bernal', 'Gavi'],
    DEL: ['Lamine Yamal', 'Raphinha', 'Anthony Gordon', 'Karim Adeyemi', 'Gabriel Jesús'],
  },
  madrid: {
    POR: ['Thibaut Courtois'],
    DEF: [
      'Trent Alexander-Arnold',
      'Dean Huijsen',
      'Álvaro Carreras',
      'Denzel Dumfries',
      'Ibrahima Konaté',
      'Marc Cucurella',
      'Éder Militão',
    ],
    MED: [
      'Jude Bellingham',
      'Federico Valverde',
      'Aurélien Tchouaméni',
      'Bernardo Silva',
      'Eduardo Camavinga',
    ],
    DEL: ['Kylian Mbappé', 'Vinícius Júnior', 'Yan Diomande', 'Carlos Espí', 'Endrick'],
  },
  atletico: {
    POR: ['Jan Oblak', 'Juan Musso'],
    DEF: ['Alejandro Grimaldo', 'Marc Pubill', 'Dávid Hancko', 'Cuti Romero', 'Marcos Llorente'],
    MED: [
      'Morten Hjulmand',
      'Pablo Barrios',
      'Koke',
      'Johnny Cardoso',
      'Álex Baena',
      'Rodrigo Mendoza',
      'Obed Vargas',
      'Kang-In Lee',
    ],
    DEL: ['Julián Álvarez', 'Ademola Lookman', 'Alexander Sørloth', 'Jonathan David'],
  },
  villarreal: {
    POR: ['Luiz Júnior', 'Péter Gulácsi'],
    DEF: [
      'Juan Foyth',
      'Logan Costa',
      'Santiago Mouriño',
      'Renato Veiga',
      'Carlos Romero',
      'Pau Navarro',
      'Sergi Cardona',
    ],
    MED: [
      'Pape Gueye',
      'Santi Comesaña',
      'Alberto Moleiro',
      'Nicolas Pépé',
      'Tajon Buchanan',
      'Ilias Akhomach',
      'Nathan Saliba',
    ],
    DEL: ['Gerard Moreno', 'Georges Mikautadze', 'Ayoze Pérez', 'Tani Oluwaseyi'],
  },
};
Object.assign(verified, {
  betis: {
    POR: ['Álvaro Valles', 'Diego Conde', 'Manu González'],
    DEF: ['Fran García', 'Bellerín', 'Bartra', 'Diego Llorente', 'Natan', 'Ortiz', 'Aitor Ruibal'],
    MED: ['Facundo Bernal', 'Dani Ceballos', 'Pablo Fornals', 'Isco', 'Marc Roca'],
    DEL: ['Troy Parrott', 'Cucho Hernández', 'Antony', 'Abde', 'Rodrigo Riquelme'],
  },
  celta: {
    POR: ['Radu', 'Altay Bayindir', 'Iván Villar'],
    DEF: [
      'Javi Rodríguez',
      'Starfelt',
      'Marcos Alonso',
      'Faye',
      'Sebastián Cáceres',
      'Yoel Lago',
      'Álvaro Núñez',
    ],
    MED: ['Miguel Román', 'Ilaix Moriba', 'Aleix Febas', 'Javi Galán', 'Sergio Carreira'],
    DEL: [
      'Iago Aspas',
      'Borja Iglesias',
      'Swedberg',
      'Ferran Jutglà',
      'Pablo Durán',
      'Couhaib Driouech',
    ],
  },
  getafe: {
    POR: ['David Soria'],
    DEF: [
      'Djené',
      'Saba Sazonov',
      'Zaid Romero',
      'Andrés García',
      'Johan Mojica',
      'Sebastián Boselli',
    ],
    MED: ['Mario Martín', 'Nemanja Gudelj', 'Orel Mangala', 'Ramón Terrats', 'Francho Serrano'],
    DEL: ['Martín Satriano', 'Enes Ünal', 'Iván Azón', 'Borja Mayoral', 'Christantus Uche'],
  },
  rayo: {
    POR: ['Batalla', 'Cárdenas', 'Adri Molina', 'Emil Audero'],
    DEF: ['Luiz Felipe', 'Marash Kumbulla', 'Mujaid Sadick', 'Adrià Pedrosa', 'Ratiu', 'Lejeune'],
    MED: [
      'Unai López',
      'Pedro Díaz',
      'Óscar Valentín',
      'Pathé Ciss',
      'Gnangoro Bouaré',
      'Isi Palazón',
    ],
    DEL: [
      'De Frutos',
      'Álvaro García',
      'Fran Pérez',
      'Nteka',
      'Alemão',
      'Sergio Camello',
      'Giorgi Tsitaishvili',
    ],
  },
  valencia: {
    POR: ['Stole Dimitrievski'],
    DEF: [
      'Pablo Maffeo',
      'Arnau Martínez',
      'Gayà',
      'Jesús Vázquez',
      'Copete',
      'De Haas',
      'Diakhaby',
      'César Tárrega',
    ],
    MED: [
      'Guido Rodríguez',
      'Dieng',
      'Pepelu',
      'Ugrinic',
      'Javi Guerra',
      'Luis Rioja',
      'Diego López',
      'Elliott',
    ],
    DEL: ['Danjuma', 'Umar Sadiq', 'Hugo Duro'],
  },
  sociedad: {
    POR: ['Álex Remiro', 'Unai Marrero'],
    DEF: ['Sergio Gómez', 'Jon Martín', 'Jon Aramburu', 'Igor Zubeldía', 'Sarr', 'Héctor Fort'],
    MED: [
      'Jon Gorrotxategi',
      'Beñat Turrientes',
      'Carlos Soler',
      'Luka Sucic',
      'Yangel Herrera',
      'Goti',
      'Arsen Zakharyan',
    ],
    DEL: [
      'Mikel Oyarzabal',
      'Óskarsson',
      'Gonçalo Guedes',
      'Take Kubo',
      'Ander Barrenetxea',
      'Ochieng',
      'Carrera',
    ],
  },
  espanyol: {
    POR: ['Dmitrovic', 'Fortuño'],
    DEF: ['Unai Núñez', 'Drkusic', 'Gorosabel', 'El Hilali', 'Hartman', 'Hinojo'],
    MED: ['Calatrava', 'Edu Expósito', 'Urko', 'Pol Lozano', 'Moscardo', 'Bryan Zaragoza'],
    DEL: ['Puado', 'Kike García', 'Marcos Fernández', 'Roberto Fernández', 'Pere Milla'],
  },
  athletic: {
    POR: ['Unai Simón', 'Álex Padilla'],
    DEF: ['Jesús Areso', 'Rincón', 'Aymeric Laporte', 'Dani Vivian', 'Yeray', 'Yuri'],
    MED: [
      'Ruiz de Galarreta',
      'Beñat Prados',
      'Jauregizar',
      'Gerenabarrena',
      'Oihan Sancet',
      'Canales',
    ],
    DEL: ['Nico Williams', 'Álvaro Djaló', 'Maroan Sannadi', 'Gorka Guruzeta'],
  },
  sevilla: {
    POR: ['Vlachodimos', 'Fran González'],
    DEF: ['Juan Iglesias', 'Julio Díaz', 'Suazo', 'Sangante', 'Kike Salas'],
    MED: ['Kochorashvili', 'Nico Guillén', 'Fofana', 'Agoumé'],
    DEL: ['Isaac Romero', 'Ure', 'Peque', 'Vargas', 'Alfon', 'Stassin', 'Correia'],
  },
  alaves: {
    POR: ['Antonio Sivera', 'Adrián', 'Swiderski'],
    DEF: ['Koski', 'Valentini', 'Garcés', 'Xanet', 'Álvaro'],
    MED: [
      'Antonio Blanco',
      'Pablo Ibáñez',
      'Denis Suárez',
      'Guevara',
      'Protesoni',
      'Mikel Rodríguez',
      'Aleñá',
    ],
    DEL: ['Lucas Boyé', 'Toni Martínez', 'Mañas', 'Mariano'],
  },
  elche: {
    POR: ['Matías Dituro', 'Iturbe'],
    DEF: [
      'Víctor Chust',
      'Pedro Bigas',
      'Buba Sangaré',
      'Tete Morente',
      'Germán Valera',
      'Revivo',
      'Lomónaco',
    ],
    MED: ['Gonzalo Villar', 'Javier Morcillo', 'Buonanotte', 'Thomas Lemar'],
    DEL: ['Fer Niño', 'Eze Ponce'],
  },
  levante: {
    POR: ['Mathew Ryan'],
    DEF: ['Aïssa Mandi', 'Tape', 'Toljan', 'Dela', 'Manu Sánchez'],
    MED: ['Hugo Sotelo', 'Jon Olasagasti', 'Enzo Bardeli', 'Dani Requena'],
    DEL: ['Musuayi', 'Etta Eyong', 'Iván Romero', 'Brugué', 'Thiago Fernández', 'Ratkov'],
  },
  osasuna: {
    POR: ['Sergio Herrera', 'Aitor Fernández'],
    DEF: ['Rosier', 'Abel Bretones', 'Diego Rico', 'Catena', 'Boyomo', 'Herrando'],
    MED: [
      'Lucas Torró',
      'Jon Moncayola',
      'Iker Muñoz',
      'Rubén García',
      'Kike Barja',
      'Moi Gómez',
      'Aimar Oroz',
    ],
    DEL: ['Ante Budimir', 'Raúl García de Haro', 'Dubasin', 'Moro', 'Del Castillo'],
  },
  racing: {
    POR: ['Julen Agirrezabala', 'Simon Eriksson'],
    DEF: ['Jorge Salinas', 'Aarón Martín', 'Facu González', 'Belocian', 'Pedro Felipe'],
    MED: ['Sergio Canales', 'Iván Martín', 'Prati'],
    DEL: [
      'Iñigo Vicente',
      'Andrés Martín',
      'Juan Carlos Arana',
      'Asier Villalibre',
      'Zabiri',
      'Iker Luque',
      'Pablo García',
    ],
  },
  deportivo: {
    POR: ['Leo Román', 'Germán Parreño', 'Álvaro Ferllo'],
    DEF: [
      'Angeliño',
      'Quagliata',
      'Ximo',
      'Altimira',
      'Bright Ede',
      'José María Giménez',
      'Loureiro',
      'Noubi',
    ],
    MED: [
      'Diego Villares',
      'Mario Soriano',
      'Teun Gijselhart',
      'Lorenzo Amatucci',
      'Asp Jensen',
      'Marc Casadó',
    ],
    DEL: [
      'Luismi Cruz',
      'David Mella',
      'Yeremay',
      'Aubameyang',
      'Nsongo',
      'Eddahchouri',
      'Adama Traoré',
    ],
  },
  malaga: {
    POR: ['Alfonso Herrero', 'Carlos López', 'Andrés Céspedes'],
    DEF: ['Galilea', 'Ángel Recio', 'Puga', 'Salinas', 'Adam Aznou', 'Berrocal', 'Rafita'],
    MED: ['Dani Lorenzo', 'Izan Merino', 'Carlos Dotor', 'Pablo Martínez', 'Jens Cajuste'],
    DEL: [
      'Chupe',
      'Adrián Niño',
      'Larrubia',
      'Joaquín Muñoz',
      'Aarón Ochoa',
      'Juan Cruz',
      'Jauregi',
    ],
  },
});
const sourceSlug: Record<string, string> = {
  barcelona: 'fc-barcelona',
  madrid: 'real-madrid',
  atletico: 'atletico-de-madrid',
  villarreal: 'villarreal',
  betis: 'real-betis',
  celta: 'celta-de-vigo',
  getafe: 'getafe-fc',
  rayo: 'rayo-vallecano',
  valencia: 'valencia',
  sociedad: 'real-sociedad',
  espanyol: 'espanyol',
  athletic: 'athletic-club',
  sevilla: 'sevilla',
  alaves: 'alaves',
  elche: 'elche',
  levante: 'levante',
  osasuna: 'osasuna',
  racing: 'racing-de-santander',
  deportivo: 'deportivo-de-a-coruna',
  malaga: 'malaga-cf',
};
export function roster(now: number): Player[] {
  const players: Player[] = [];
  const first = [
    'Nicolás',
    'Mateo',
    'Lucas',
    'Daniel',
    'Álvaro',
    'Hugo',
    'Bruno',
    'Pablo',
    'Sergio',
    'Adrián',
    'Iván',
    'Mario',
    'Leo',
    'Martín',
    'Diego',
    'Rafael',
    'Enzo',
    'Gael',
    'Saúl',
    'Javier',
    'Óscar',
    'Andrés',
    'Marcos',
    'Jaime',
    'Samuel',
  ];
  const last = [
    'Robles',
    'Sierra',
    'Valdés',
    'Oliva',
    'Crespo',
    'Vega',
    'Soler',
    'Reina',
    'Molina',
    'Cano',
    'Navas',
    'Roca',
    'León',
    'Ríos',
    'Salas',
    'Vidal',
    'Luna',
    'Paz',
    'Lago',
    'Ramos',
    'Duarte',
    'Soto',
    'Prado',
    'Gil',
    'Mora',
  ];
  for (const [ci, club] of REAL_CLUBS.entries()) {
    let count = 0;
    const positions: Position[] = ['POR', 'DEF', 'MED', 'DEL'];
    for (const position of positions) {
      for (const name of verified[club.id]?.[position] || []) {
        const id = `${club.id}-${count++}`;
        const value = euro(1_500_000 + (hash(name) % 18_000_000));
        players.push({
          id,
          name,
          realClubId: club.id,
          position,
          value,
          valueHistory: [{ at: now, value }],
          simulated: false,
          source: `https://as.com/futbol/primera/${sourceSlug[club.id]}-en-laliga-ea-sports-202627-plantilla-fichajes-bajas-figuras-y-claves-de-la-temporada-f202608-n/`,
          verifiedAt: '2026-10-23',
          status: 'available',
        });
      }
    }
    while (count < 25) {
      const i = count++;
      const counts = Object.fromEntries(
        positions.map((pos) => [
          pos,
          players.filter((p) => p.realClubId === club.id && p.position === pos).length,
        ]),
      );
      const targets = { POR: 3, DEF: 8, MED: 8, DEL: 6 };
      const position = positions.find((pos) => counts[pos] < targets[pos]) || 'DEL';
      const id = `${club.id}-${i}`;
      const value = euro(350000 + (hash(id) % 2_500_000));
      players.push({
        id,
        name: `${first[(ci + i) % 25]} ${last[(ci * 3 + i * 7) % 25]} ${String.fromCharCode(65 + ci)}`,
        realClubId: club.id,
        position,
        value,
        valueHistory: [{ at: now, value }],
        simulated: true,
        status: 'available',
      });
    }
  }
  return players;
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
    return { version: SPORTS_VERSION, updatedAt: '2026-10-23' };
  }
  async getLastUpdated() {
    return '2026-10-23';
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
