import { useState, type CSSProperties } from 'react';
import type { Player } from '../../shared/types';
import { clubById } from '../../shared/sports';
import { sportsAsset } from '../../shared/sports-assets';
import {
  playerAsset,
  clubAsset,
  PLAYER_FALLBACK,
  CLUB_FALLBACK,
} from '../../shared/football-assets';
import { useFootballMedia } from '../lib/football-media';
export function LocalFootballImage({
  path,
  fallback,
  alt,
  className,
}: {
  path: string;
  fallback: string;
  alt: string;
  className?: string;
}) {
  const { src, kind } = useFootballMedia(path),
    [failed, setFailed] = useState('');
  return (
    <img
      className={className}
      src={failed === src ? fallback : src}
      alt={alt}
      loading="lazy"
      decoding="async"
      data-asset-state={failed === src ? 'fallback' : kind || 'local'}
      onError={(e) => {
        if (failed !== src) setFailed(src);
        else e.currentTarget.style.visibility = 'hidden';
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
        fallback={CLUB_FALLBACK}
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
export function PhotoCredit({ player }: { player: Player }) {
  const media = useFootballMedia(playerAsset(player).photo),
    photo = sportsAsset(player).photo;
  if (media.kind === 'licensed' && photo)
    return (
      <p className="photo-credit">
        Foto:{' '}
        <a href={photo.source} target="_blank" rel="noreferrer">
          {photo.author}
        </a>{' '}
        ·{' '}
        <a href={photo.licenseUrl} target="_blank" rel="noreferrer">
          {photo.license}
        </a>{' '}
        · Copia PNG adaptada; licencia del original.
      </p>
    );
  return (
    <p className="photo-credit">
      {media.kind === 'provided'
        ? 'Imagen aportada por el usuario.'
        : 'Imagen provisional del catálogo local.'}{' '}
      Los PNG se pueden sustituir conservando su nombre.
    </p>
  );
}
