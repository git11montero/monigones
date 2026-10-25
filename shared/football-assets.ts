import legacy from '../data/sports/football-assets-v05.json' with { type: 'json' };
import catalog from './football-assets.json' with { type: 'json' };
/** Stable resource identities. Fantasy ownership never participates in this resolver. */
export const CLUB_SLUGS: Record<string, string> = {
  athletic: 'athletic',
  atletico: 'atletico',
  osasuna: 'osasuna',
  celta: 'celta',
  alaves: 'alaves',
  elche: 'elche',
  barcelona: 'barcelona',
  getafe: 'getafe',
  levante: 'levante',
  malaga: 'malaga',
  racing: 'racing',
  deportivo: 'deportivo',
  espanyol: 'espanyol',
  betis: 'betis',
  madrid: 'realmadrid',
  sociedad: 'realsociedad',
  sevilla: 'sevilla',
  valencia: 'valencia',
  villarreal: 'villarreal',
  rayo: 'rayo',
};
export const FOOTBALL_ASSETS = catalog;
export const ALL_FOOTBALL_ASSETS = [
  ...catalog,
  ...legacy.filter((e) => !catalog.some((c) => c.playerId === e.playerId)),
];
export const PLAYER_FALLBACK = '/assets/futbol/fallback/jugador.png';
export const CLUB_FALLBACK = '/assets/futbol/fallback/escudo.png';
export function playerAsset(player: { id: string; realClubId: string }) {
  const entry = ALL_FOOTBALL_ASSETS.find((x) => x.playerId === player.id);
  const clubSlug = CLUB_SLUGS[player.realClubId];
  return {
    entry,
    photo:
      entry && clubSlug
        ? `/assets/futbol/jugadores/${clubSlug}-${entry.resourceId}.png`
        : PLAYER_FALLBACK,
    crest: clubSlug ? `/assets/futbol/escudos/${clubSlug}.webp` : CLUB_FALLBACK,
  };
}
export const clubAsset = (id: string) =>
  CLUB_SLUGS[id] ? `/assets/futbol/escudos/${CLUB_SLUGS[id]}.webp` : CLUB_FALLBACK;

export const legacyClubAsset = (id: string) =>
  CLUB_SLUGS[id] ? `/assets/futbol/escudos/${CLUB_SLUGS[id]}.png` : CLUB_FALLBACK;
