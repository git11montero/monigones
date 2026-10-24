import type { Club, GameState } from '../../shared/types';
export const BUILDING_VISUALS: Record<
  string,
  { atlas: string; row: number; x: number; y: number; width: number; theme: string }
> = {
  hq: { atlas: 'core', row: 0, x: 715, y: 420, width: 275, theme: 'club' },
  offices: { atlas: 'commerce', row: 0, x: 950, y: 442, width: 210, theme: 'club' },
  finance: { atlas: 'relations', row: 0, x: 265, y: 418, width: 210, theme: 'business' },
  marketing: { atlas: 'training', row: 0, x: 480, y: 435, width: 200, theme: 'business' },
  research: { atlas: 'core', row: 2, x: 1190, y: 440, width: 340, theme: 'science' },
  stadium: { atlas: 'core', row: 1, x: 790, y: 960, width: 700, theme: 'sport' },
  training: { atlas: 'training', row: 2, x: 1440, y: 1020, width: 250, theme: 'sport' },
  shop: { atlas: 'commerce', row: 2, x: 320, y: 1260, width: 205, theme: 'retail' },
  social: { atlas: 'relations', row: 1, x: 535, y: 1280, width: 210, theme: 'fans' },
  sport: { atlas: 'commerce', row: 1, x: 800, y: 1260, width: 310, theme: 'sport' },
  academy: { atlas: 'training', row: 1, x: 1205, y: 1290, width: 400, theme: 'academy' },
  press: { atlas: 'culture', row: 0, x: 255, y: 1740, width: 210, theme: 'press' },
  institution: { atlas: 'relations', row: 2, x: 480, y: 1770, width: 210, theme: 'club' },
  museum: { atlas: 'culture', row: 1, x: 800, y: 1800, width: 340, theme: 'club' },
  competition: { atlas: 'culture', row: 2, x: 1260, y: 1790, width: 370, theme: 'sport' },
};
export const WORLD = { width: 1600, height: 2400 };
export type Camera = { x: number; y: number; zoom: number };
export function clampCamera(c: Camera, width: number, height: number): Camera {
  const zoom = Math.max(
    Math.min(1.15, Math.max(0.27, width / WORLD.width, height / WORLD.height)),
    Math.min(1.15, c.zoom),
  );
  const constrain = (value: number, viewport: number, world: number) =>
    world * zoom <= viewport
      ? (viewport - world * zoom) / 2
      : Math.min(0, Math.max(viewport - world * zoom, value));
  return { zoom, x: constrain(c.x, width, WORLD.width), y: constrain(c.y, height, WORLD.height) };
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
  'Club de barrio: instalaciones compactas y primer equipo de trabajo.',
  'El club crece: segunda planta, nuevos accesos y equipamiento.',
  'Etapa profesional: alas adicionales, cristal y zonas especializadas.',
  'Referencia nacional: grandes volúmenes, cubiertas y servicios avanzados.',
  'Campus de referencia: edificios amplios, terrazas y equipamiento avanzado.',
];
