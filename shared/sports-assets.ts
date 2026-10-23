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
};
export const AUTHORIZED_PHOTOS: AuthorizedPhoto[] = [
  {
    playerId: 'madrid-13',
    identity: 'Kylian Mbappé',
    season: BRAND.season,
    file: '/sports/madrid-13-mbappe.jpg',
    source:
      'https://commons.wikimedia.org/wiki/File:Kylian_Mbappe_-_France_v_Senegal_-_16_June_2026.jpg',
    author: 'Bryan Berlin / WikiPortraits',
    license: 'CC-BY-SA-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    verifiedAt: '2026-10-23',
    width: 748,
    height: 1129,
    modified: false,
  },
];
AUTHORIZED_PHOTOS.push(
  {
    playerId: 'athletic-0',
    identity: 'Unai Simón',
    season: BRAND.season,
    file: '/sports/athletic-0-simon.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Unai_Simon_France_v_Spain_7.24.26-066.jpg',
    author: 'Bryan Berlin / WikiPortraits',
    license: 'CC-BY-SA-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    verifiedAt: '2026-10-23',
    width: 3333,
    height: 5000,
    modified: false,
  },
  {
    playerId: 'athletic-4',
    identity: 'Aymeric Laporte',
    season: BRAND.season,
    file: '/sports/athletic-4-laporte.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Aymeric_Laporte(cropped).jpg',
    author: 'Lluis Fernandez Salas',
    license: 'CC-BY-2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
    verifiedAt: '2026-10-23',
    width: 290,
    height: 434,
    modified: false,
  },
  {
    playerId: 'barcelona-17',
    identity: 'Lamine Yamal',
    season: BRAND.season,
    file: '/sports/barcelona-17-yamal.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Lamine_Yamal_in_2025_(cropped).jpg',
    author: 'Biso',
    license: 'CC-BY-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    verifiedAt: '2026-10-23',
    width: 558,
    height: 783,
    modified: false,
  },
  {
    playerId: 'madrid-8',
    identity: 'Jude Bellingham',
    season: BRAND.season,
    file: '/sports/madrid-8-bellingham.jpg',
    source:
      'https://commons.wikimedia.org/wiki/File:Jude_Bellingham_England_v_Panama_27_June_26-160.jpg',
    author: 'Bryan Berlin / WikiPortraits',
    license: 'CC-BY-SA-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    verifiedAt: '2026-10-23',
    width: 3333,
    height: 5000,
    modified: false,
  },
  {
    playerId: 'madrid-14',
    identity: 'Vinícius Júnior',
    season: BRAND.season,
    file: '/sports/madrid-14-vinicius.jpg',
    source:
      'https://commons.wikimedia.org/wiki/File:Vinicius_Junior_Brazil_V_Morocco_13_June_2026-94_(cropped).jpg',
    author: 'Bryan Berlin / WikiPortraits',
    license: 'CC-BY-SA-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    verifiedAt: '2026-10-23',
    width: 1546,
    height: 2223,
    modified: false,
  },
);
AUTHORIZED_PHOTOS.push(
  ...IMPORTED_PHOTOS.filter((p) => !AUTHORIZED_PHOTOS.some((a) => a.playerId === p.playerId)),
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
    : [...IMPORTED_PHOTOS, ...AUTHORIZED_PHOTOS].find((p) => p.playerId === player.id);
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
