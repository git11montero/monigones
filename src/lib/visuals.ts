import type { Club, GameState } from '../../shared/types';
export const BUILDING_VISUALS: Record<
  string,
  { atlas: string; row: number; x: number; y: number; width: number; theme: string }
> = {
  hq: { atlas: 'core', row: 0, x: 660, y: 290, width: 270, theme: 'royal' },
  stadium: { atlas: 'core', row: 1, x: 655, y: 625, width: 380, theme: 'sport' },
  research: { atlas: 'core', row: 2, x: 1040, y: 430, width: 265, theme: 'science' },
  marketing: { atlas: 'training', row: 0, x: 270, y: 670, width: 250, theme: 'coral' },
  academy: { atlas: 'training', row: 1, x: 1110, y: 740, width: 280, theme: 'academy' },
  training: { atlas: 'training', row: 2, x: 1040, y: 1050, width: 300, theme: 'sport' },
  offices: { atlas: 'commerce', row: 0, x: 300, y: 390, width: 250, theme: 'royal' },
  sport: { atlas: 'commerce', row: 1, x: 650, y: 965, width: 250, theme: 'sport' },
  shop: { atlas: 'commerce', row: 2, x: 300, y: 980, width: 240, theme: 'coral' },
  finance: { atlas: 'relations', row: 0, x: 700, y: 1270, width: 250, theme: 'gold' },
  social: { atlas: 'relations', row: 1, x: 310, y: 1260, width: 250, theme: 'festival' },
  institution: { atlas: 'relations', row: 2, x: 1110, y: 1360, width: 260, theme: 'crimson' },
  press: { atlas: 'culture', row: 0, x: 310, y: 1550, width: 250, theme: 'press' },
  museum: { atlas: 'culture', row: 1, x: 700, y: 1570, width: 260, theme: 'gold' },
  competition: { atlas: 'culture', row: 2, x: 1080, y: 1650, width: 255, theme: 'festival' },
};
export const WORLD = { width: 1420, height: 1920 };
export type Camera = { x: number; y: number; zoom: number };
export function clampCamera(c: Camera, width: number, height: number): Camera {
  const zoom = Math.max(0.27, Math.min(1.15, c.zoom));
  const margin = 70;
  return {
    zoom,
    x: Math.max(width - WORLD.width * zoom - margin, Math.min(margin, c.x)),
    y: Math.max(height - WORLD.height * zoom - margin, Math.min(margin, c.y)),
  };
}
export function zoomCamera(c: Camera, zoom: number, anchor: { x: number; y: number }): Camera {
  const z = Math.max(0.27, Math.min(1.15, zoom));
  return {
    zoom: z,
    x: anchor.x - ((anchor.x - c.x) / c.zoom) * z,
    y: anchor.y - ((anchor.y - c.y) / c.zoom) * z,
  };
}
export function cityEnvironment(
  state: Pick<GameState, 'rounds' | 'currentRound' | 'now' | 'concerts'>,
  club: Pick<Club, 'id'>,
) {
  const round = state.rounds.find((r) => r.number === state.currentRound);
  const live = round?.status === 'live' && round.matches.some((m) => m.status === 'live');
  const concert = state.concerts.some(
    (c) => c.clubId === club.id && c.startsAt <= state.now && c.endsAt > state.now,
  );
  return { mode: live ? 'matchday' : concert ? 'concert' : 'normal', live, concert, round };
}
export const LEVEL_DESCRIPTIONS = [
  'Club de barrio: ladrillo, tejados y un primer equipo de trabajo.',
  'El club crece: segunda planta, nuevos accesos y equipamiento.',
  'Etapa profesional: alas adicionales, cristal y zonas especializadas.',
  'Referencia nacional: grandes volúmenes, cubiertas y servicios avanzados.',
  'Capital del fútbol: arquitectura monumental, jardines y acabados de lujo.',
];
