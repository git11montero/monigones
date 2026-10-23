import { useId, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Player } from '../../shared/types';
import { clubById } from '../../shared/sports';
import { sportsAsset } from '../../shared/sports-assets';
export function ClubBadge({ clubId, size = 26 }: { clubId: string; size?: number }) {
  const club = clubById(clubId);
  return (
    <span
      className="real-club-badge"
      title={`${club.name} · emblema alternativo original; escudo oficial pendiente`}
      style={{ width: size, height: size * 1.15, '--club-color': club.color } as CSSProperties}
      role="img"
      aria-label={`${club.name}, emblema alternativo`}
    >
      <svg viewBox="0 0 50 58" aria-hidden="true">
        <path d="M5 6L25 2 45 6V32Q45 46 25 55Q5 46 5 32Z" fill="#f6e1ac" />
        <path d="M9 10L25 7 41 10V31Q41 43 25 50Q9 43 9 31Z" fill={club.color} />
        <path d="M11 16L39 39M12 9L41 31" stroke="#fff" strokeWidth="4" opacity=".6" />
        <path d="M13 21H37V35H13Z" fill="#142f4d" />
        <text x="25" y="31" textAnchor="middle" fill="#fff2ce" fontSize="10" fontWeight="900">
          {club.short}
        </text>
        <text x="25" y="43" textAnchor="middle" fill="#fff" fontSize="5" fontWeight="700">
          ALT
        </text>
      </svg>
    </span>
  );
}
export function PlayerPortrait({ player, size = 58 }: { player: Player; size?: number }) {
  const asset = sportsAsset(player),
    [broken, setBroken] = useState(false),
    uid = useId().replaceAll(':', ''),
    c = clubById(player.realClubId);
  const n = [...player.id].reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) >>> 0, 0),
    skin = ['#f1c299', '#dca278', '#bc805b', '#925b41', '#774935'][n % 5],
    hair = ['#241d28', '#4a2e24', '#a67a45', '#27232b'][n % 4];
  return (
    <span
      className={`portrait player-avatar ${asset.photo && !broken ? 'has-photo' : 'illustrated'}`}
      style={{ width: size, height: size * 1.2, '--club-color': c.color } as CSSProperties}
      data-player-id={player.id}
      data-media={
        asset.photo && !broken
          ? 'photo'
          : asset.availability === 'fictional-portrait'
            ? 'fictional'
            : 'fallback'
      }
    >
      {asset.photo && !broken ? (
        <img
          src={asset.photo.file}
          alt={`Fotografía de ${player.name}`}
          width={asset.photo.width}
          height={asset.photo.height}
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
          title={`${asset.photo.author} · ${asset.photo.license}`}
        />
      ) : (
        <svg
          viewBox="0 0 100 120"
          role="img"
          aria-label={`${player.name} · retrato ilustrado ${player.simulated ? 'ficticio' : 'alternativo; fotografía pendiente'}`}
        >
          <defs>
            <linearGradient id={`kit-${uid}`} x2="1" y2="1">
              <stop stopColor={c.color} />
              <stop offset="1" stopColor="#122b47" />
            </linearGradient>
            <linearGradient id={`face-${uid}`}>
              <stop stopColor={skin} />
              <stop offset="1" stopColor={skin} />
            </linearGradient>
          </defs>
          <path d="M0 120V92Q5 75 34 70H66Q95 75 100 92V120" fill={`url(#kit-${uid})`} />
          <path d="M4 99L26 83M96 99L74 83" stroke="#f1db9b" strokeWidth="5" />
          <path d="M35 61V77Q50 91 65 77V61" fill={skin} />
          <path d="M29 75L40 88 50 81 60 88 71 75" fill="#fff3da" />
          <ellipse cx="50" cy="42" rx={22 + (n % 3)} ry="30" fill={`url(#face-${uid})`} />
          <ellipse cx="27" cy="46" rx="5" ry="8" fill={skin} />
          <ellipse cx="73" cy="46" rx="5" ry="8" fill={skin} />
          <path
            d={
              n % 3 === 0
                ? 'M26 37L24 24Q26 4 48 6Q76 0 76 34L69 29 64 19 39 24 31 40Z'
                : n % 3 === 1
                  ? 'M26 38L25 21Q34 6 50 9Q71 8 75 28L70 36 65 23 34 26 31 39Z'
                  : 'M26 37Q18 23 30 12Q43 0 58 9Q80 8 75 36L67 29 61 22 35 24 31 39Z'
            }
            fill={hair}
          />
          <path
            d="M33 40Q39 37 44 40M56 40Q62 37 68 40"
            stroke={hair}
            strokeWidth="2.6"
            fill="none"
          />
          <ellipse cx="39" cy="45" rx="2" ry="2.5" fill="#253044" />
          <ellipse cx="61" cy="45" rx="2" ry="2.5" fill="#253044" />
          <path d="M50 46L47 54 52 55" stroke="#9e674f" fill="none" strokeWidth="1.4" />
          <path d="M41 62Q50 67 60 61" stroke="#9b5c4b" strokeWidth="2" fill="none" />
          {n % 4 === 0 && (
            <path d="M31 53Q31 76 50 77Q70 75 70 53L63 61Q50 70 37 61Z" fill={hair} opacity=".65" />
          )}
          <path d="M48 89V120" stroke="#fff" opacity=".15" strokeWidth="13" />
          <path d="M71 92L78 90 83 92V101L77 105 71 101Z" fill="#ecd79a" />
          <text x="50" y="113" textAnchor="middle" fill="#fff3d8" fontSize="10" fontWeight="800">
            {c.short}
          </text>
        </svg>
      )}
    </span>
  );
}
export function PhotoCredit({ player }: { player: Player }) {
  const { photo } = sportsAsset(player);
  return photo ? (
    <p className="photo-credit">
      Foto:{' '}
      <a href={photo.source} target="_blank" rel="noreferrer">
        {photo.author}
      </a>{' '}
      ·{' '}
      <a href={photo.licenseUrl} target="_blank" rel="noreferrer">
        {photo.license}
      </a>{' '}
      · Archivo sin modificar; encuadre de presentación.
    </p>
  ) : (
    <p className="photo-credit">
      {player.simulated
        ? 'Identidad ficticia · retrato original consistente.'
        : 'Retrato original alternativo · fotografía autorizada pendiente.'}{' '}
      Emblema de club alternativo, escudo oficial pendiente.
    </p>
  );
}
