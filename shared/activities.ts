import { DAILY_ACTIONS, HOUR, euro } from './config';
import { dailyKey, hash } from './math';
import type { GameState, Resource } from './types';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export interface ActivityDef {
  id: string;
  name: string;
  story: string;
  cost: number;
  resource: Resource;
  reward: number;
  rarity: Rarity;
  duration: number;
  building: string;
  minimumHQ: number;
  extra?: Partial<Record<Resource, number>>;
}
export interface ActivityRun {
  id: string;
  offerDay: string;
  definition: ActivityDef;
  startedAt: number;
  endsAt: number;
  claimedAt?: number;
}
export const RARITIES: Record<Rarity, { label: string; minutes: number; weight: number }> = {
  common: { label: 'Común', minutes: 30, weight: 55 },
  uncommon: { label: 'Poco común', minutes: 90, weight: 27 },
  rare: { label: 'Rara', minutes: 180, weight: 13 },
  epic: { label: 'Épica', minutes: 300, weight: 4 },
  legendary: { label: 'Legendaria', minutes: 480, weight: 1 },
};
export const ACTIVITY_CATALOG: ActivityDef[] = DAILY_ACTIONS.map((a, i) => ({
  ...a,
  rarity: i % 3 === 1 ? 'uncommon' : 'common',
  duration: (i % 3 === 1 ? 90 : i % 2 ? 45 : 30) * 60000,
  building: ['press', 'social', 'academy'][i % 3],
  minimumHQ: 1,
}));
ACTIVITY_CATALOG.push(
  {
    id: 'historic',
    name: 'Visita a una peña histórica',
    story: 'Tres generaciones de socios abren su archivo de viajes, bufandas y recuerdos.',
    rarity: 'rare',
    duration: 3 * HOUR,
    cost: euro(25000),
    resource: 'fans',
    reward: 6,
    extra: { development: 80 },
    building: 'social',
    minimumHQ: 1,
  },
  {
    id: 'gala',
    name: 'Gala benéfica del club',
    story: 'El vestuario se reúne con las asociaciones que sostienen el barrio.',
    rarity: 'epic',
    duration: 5 * HOUR,
    cost: euro(150000),
    resource: 'prestige',
    reward: 5,
    extra: { fame: 4 },
    building: 'institution',
    minimumHQ: 1,
  },
  {
    id: 'world',
    name: 'Presentación mundial del proyecto',
    story: 'La cantera y el primer equipo comparten su ambición ante aficionados de todo el mundo.',
    rarity: 'legendary',
    duration: 8 * HOUR,
    cost: euro(350000),
    resource: 'prestige',
    reward: 8,
    extra: { development: 200, fame: 5 },
    building: 'marketing',
    minimumHQ: 1,
  },
  {
    id: 'archive',
    name: 'La memoria de la grada',
    story: 'Ordena las fotografías del archivo junto a los socios más veteranos.',
    rarity: 'rare',
    duration: 2 * HOUR,
    cost: 0,
    resource: 'development',
    reward: 100,
    building: 'museum',
    minimumHQ: 1,
  },
  {
    id: 'festival',
    name: 'Festival de fútbol del barrio',
    story: 'La ciudad deportiva recibe equipos escolares y a sus familias.',
    rarity: 'epic',
    duration: 4 * HOUR,
    cost: euro(100000),
    resource: 'fans',
    reward: 8,
    extra: { prestige: 3 },
    building: 'academy',
    minimumHQ: 1,
  },
  {
    id: 'partners',
    name: 'Encuentro de colaboradores',
    story: 'Las empresas locales preparan un fin de semana de fútbol en las calles.',
    rarity: 'rare',
    duration: 4 * HOUR,
    cost: euro(50000),
    resource: 'money',
    reward: euro(120000),
    extra: { fame: 2 },
    building: 'marketing',
    minimumHQ: 1,
  },
  {
    id: 'autograph-day',
    name: 'Firma de autógrafos',
    story: 'Los pequeños aficionados esperan con sus camisetas y una pregunta para cada jugador.',
    rarity: 'common',
    duration: 30 * 60000,
    cost: 0,
    resource: 'fans',
    reward: 2,
    extra: { development: 25 },
    building: 'shop',
    minimumHQ: 1,
  },
  {
    id: 'sponsor-photos',
    name: 'Fotos con patrocinadores',
    story: 'La nueva campaña se retrata al borde del campo con quienes apoyan al club.',
    rarity: 'uncommon',
    duration: 90 * 60000,
    cost: euro(15000),
    resource: 'money',
    reward: euro(40000),
    extra: { fame: 1 },
    building: 'marketing',
    minimumHQ: 1,
  },
);
/** Stable, weighted proposals. Rarity never changes with a reload or a client clock. */
export function activityOffers(s: GameState): ActivityDef[] {
  const day = dailyKey(s.now),
    selected: ActivityDef[] = [];
  for (let slot = 0; slot < 3; slot++) {
    const roll = hash(`${s.id}:${day}:rarity:${slot}`) % 100;
    let cumulative = 0,
      rarity: Rarity = 'common';
    for (const [key, value] of Object.entries(RARITIES)) {
      cumulative += value.weight;
      if (roll < cumulative) {
        rarity = key as Rarity;
        break;
      }
    }
    const pool = ACTIVITY_CATALOG.filter(
      (a) => a.rarity === rarity && !selected.some((x) => x.id === a.id),
    );
    const fallback = ACTIVITY_CATALOG.filter((a) => !selected.some((x) => x.id === a.id));
    const choices = pool.length ? pool : fallback;
    selected.push(choices[hash(`${s.id}:${day}:offer:${slot}`) % choices.length]);
  }
  return selected;
}
