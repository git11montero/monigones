import builtinPhotos from './builtin-sports-photos.json';
import { IMPORTED_PHOTOS } from './imported-sports-assets';
import type { Player } from './types';
import { REAL_CLUBS } from './sports';
import { BRAND } from './brand';
export type AuthorizedPhoto = {
  playerId: string;
  identity: string;
  season: string;
  externalId?: string;
  file: string;
  source: string;
  author: string;
  license: 'CC0' | 'CC-BY-2.0' | 'CC-BY-4.0' | 'CC-BY-SA-4.0' | 'CC-BY-SA-3.0';
  licenseUrl: string;
  verifiedAt: string;
  width: number;
  height: number;
  modified: boolean;
  originalFile?: string;
};
export const AUTHORIZED_PHOTOS: AuthorizedPhoto[] = Array.from(
  new Map(
    [...(builtinPhotos as AuthorizedPhoto[]), ...IMPORTED_PHOTOS].map((p) => [p.playerId, p]),
  ).values(),
);
export const CLUB_ASSETS = REAL_CLUBS.map((c) => ({
  clubId: c.id,
  name: c.name,
  season: BRAND.season,
  status: 'pending-permission' as const,
  official: false,
  source: c.source,
  license: null,
  verifiedAt: '2026-10-23',
  fallback: `original-emblem:${c.id}`,
}));
/** Sólo IDs estables. El club se resuelve desde el registro deportivo actual, nunca desde la foto. */
export function sportsAsset(player: Player) {
  const photo = player.simulated
    ? undefined
    : AUTHORIZED_PHOTOS.find((p) => p.playerId === player.id);
  return {
    playerId: player.id,
    name: player.name,
    clubId: player.realClubId,
    season: BRAND.season,
    externalIds: player.externalIds || {},
    photo,
    availability: photo
      ? 'authorized-photo'
      : player.simulated
        ? 'fictional-portrait'
        : 'pending-photo',
    fallback: `original-portrait:${player.id}`,
    crest: CLUB_ASSETS.find((c) => c.clubId === player.realClubId),
  };
}
