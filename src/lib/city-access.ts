import { BUILDINGS } from '../../shared/config';
import type { Club, GameState } from '../../shared/types';
export const CITY_GROUPS = [
  { name: 'Club e instituciones', ids: ['hq', 'offices', 'institution', 'competition'] },
  { name: 'Instalaciones deportivas', ids: ['stadium', 'academy', 'training', 'sport'] },
  { name: 'Economía y desarrollo', ids: ['finance', 'research', 'marketing', 'shop'] },
  { name: 'Comunidad', ids: ['social', 'press', 'museum'] },
];
export const buildingDestination = (id: string) => `/building/${id}`;
export function buildingAccess(state: GameState, club: Club, id: string) {
  const building = BUILDINGS.find((b) => b.id === id)!;
  return {
    building,
    to: buildingDestination(id),
    level: club.buildings[id] || 1,
    job: state.jobs.find((j) => j.clubId === club.id && j.kind === 'building' && j.target === id),
  };
}
export const CITY_VIEW_KEY = 'monigones-city-view';
export function readCityView(): 'map' | 'sections' {
  try {
    return localStorage.getItem(CITY_VIEW_KEY) === 'sections' ? 'sections' : 'map';
  } catch {
    return 'map';
  }
}
