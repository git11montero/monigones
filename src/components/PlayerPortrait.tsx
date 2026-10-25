import { useState, type CSSProperties } from 'react';
import type { Player } from '../../shared/types';
import { clubById } from '../../shared/sports';
import {
  playerAsset,
  clubAsset,
  legacyClubAsset,
  PLAYER_FALLBACK,
  CLUB_FALLBACK,
} from '../../shared/football-assets';
import { useFootballMedia, useFootballCatalog } from '../lib/football-media';
export function LocalFootballImage({
  path,
  fallback,
  alt,
  className,
}: {
  path: string;
  fallback: string | string[];
  alt: string;
  className?: string;
}) {
  const query = useFootballCatalog(),
    [failures, setFailures] = useState<string[]>([]);
  const paths = [path, ...(typeof fallback === 'string' ? [fallback] : fallback)];
  const versioned = paths.map((p) => (query.data?.[p] ? `${p}?v=${query.data[p].version}` : p));
  const index = versioned.findIndex((p) => !failures.includes(p));
  const src =
    index >= 0
      ? versioned[index]
      : 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" rx="12" fill="%233b4550"/%3E%3C/svg%3E';
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      data-asset-state={index === 0 ? query.data?.[path]?.kind || 'local' : 'fallback'}
      onError={() => {
        if (index >= 0) setFailures((old) => [...old, src]);
      }}
    />
  );
}

export function ClubBadge({ clubId, size = 26 }: { clubId: string; size?: number }) {
  const club = clubById(clubId);
  return (
    <span
      className="real-club-badge"
      role="img"
      aria-label={`${club.name}, escudo del catálogo local`}
      style={{ width: size, height: size, '--club-color': club.color } as CSSProperties}
    >
      <LocalFootballImage
        path={clubAsset(clubId)}
        fallback={[legacyClubAsset(clubId), CLUB_FALLBACK]}
        alt={`Escudo de ${club.name}`}
      />
    </span>
  );
}
export function PlayerPortrait({ player, size = 58 }: { player: Player; size?: number }) {
  const asset = playerAsset(player),
    media = useFootballMedia(asset.photo);
  return (
    <span
      className="portrait player-avatar has-photo"
      style={{ width: size, height: size * 1.2 }}
      data-player-id={player.id}
      data-media={media.kind === 'licensed' ? 'photo' : 'local'}
    >
      <LocalFootballImage
        path={asset.photo}
        fallback={PLAYER_FALLBACK}
        alt={`Imagen de ${player.name}`}
      />
    </span>
  );
}
