import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  ALL_FOOTBALL_ASSETS,
  CLUB_SLUGS,
  PLAYER_FALLBACK,
  CLUB_FALLBACK,
} from '../shared/football-assets';
export type MediaStatus = {
  version: string;
  kind: 'placeholder' | 'licensed' | 'provided' | 'missing';
};
const paths = [
  ...ALL_FOOTBALL_ASSETS.map((x) => x.photo),
  ...Object.values(CLUB_SLUGS).map((s) => `/assets/futbol/escudos/${s}.png`),
  ...Object.values(CLUB_SLUGS).map((s) => `/assets/futbol/escudos/${s}.webp`),
  PLAYER_FALLBACK,
  CLUB_FALLBACK,
];
const allowed = new Set(paths),
  playerFiles = new Set(
    ALL_FOOTBALL_ASSETS.flatMap((e) =>
      Object.values(CLUB_SLUGS).map(
        (club) => `/assets/futbol/jugadores/${club}-${e.resourceId}.png`,
      ),
    ),
  ),
  cache = new Map<string, { stamp: string; value: MediaStatus }>();
export function mediaStatus(): Record<string, MediaStatus> {
  const result: Record<string, MediaStatus> = {};
  const hash = (path: string) =>
    existsSync('public' + path)
      ? createHash('sha256')
          .update(readFileSync('public' + path))
          .digest('hex')
      : '';
  const playerHash = hash(PLAYER_FALLBACK),
    clubHash = hash(CLUB_FALLBACK);
  // Real transfers keep the resource identity. Accept the new club prefix without a rebuild.
  const additional = (
    existsSync('public/assets/futbol/jugadores')
      ? readdirSync('public/assets/futbol/jugadores')
      : []
  )
    .map((file) => `/assets/futbol/jugadores/${file}`)
    .filter((path) => playerFiles.has(path) && !allowed.has(path));
  for (const path of [...paths, ...additional]) {
    if (!existsSync('public' + path)) {
      result[path] = { version: 'missing', kind: 'missing' };
      continue;
    }
    const stat = statSync('public' + path),
      stamp = `${stat.mtimeMs}:${stat.ctimeMs}:${stat.ino}:${stat.size}:${playerHash}:${clubHash}`;
    let item = cache.get(path);
    if (!item || item.stamp !== stamp) {
      const sha = hash(path),
        entry = ALL_FOOTBALL_ASSETS.find((x) => x.photo === path),
        known = entry ? `assets-source/futbol/authorized-${entry.playerId}.sha256` : '';
      item = {
        stamp,
        value: {
          version: sha.slice(0, 20),
          kind:
            sha === playerHash || sha === clubHash
              ? 'placeholder'
              : known && existsSync(known) && sha === readFileSync(known, 'utf8').trim()
                ? 'licensed'
                : 'provided',
        },
      };
      cache.set(path, item);
    }
    result[path] = item.value;
  }
  return result;
}
export function publicFootballPath(path: string) {
  return allowed.has(path) || playerFiles.has(path) ? 'public' + path : undefined;
}
