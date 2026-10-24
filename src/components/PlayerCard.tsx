import type { Player } from '../../shared/types';
import { clubById } from '../../shared/sports';
import { shortMoney } from '../../shared/math';
import { PlayerPortrait, ClubBadge } from './PlayerPortrait';
export function PlayerCard({
  player,
  size = 'standard',
  points,
  quality,
  happiness,
}: {
  player: Player;
  size?: 'compact' | 'standard' | 'large' | 'draft' | 'market' | 'squad';
  points?: number;
  quality?: number;
  happiness?: number;
}) {
  return (
    <article
      className={`sports-card ${size}`}
      data-player-id={player.id}
      aria-label={`Carta de ${player.name}`}
    >
      <div className="sports-card-top">
        <span className={`position ${player.position}`}>{player.position}</span>
        <ClubBadge clubId={player.realClubId} size={30} />
        <b>{points === undefined ? '—' : (points / 100).toFixed(2)}</b>
      </div>
      <div className="sports-card-portrait">
        <PlayerPortrait player={player} size={130} />
      </div>
      <h2>{player.name}</h2>
      <p className="sports-card-club">{clubById(player.realClubId).name}</p>
      <div className="sports-card-info">
        <span>
          <b>{shortMoney(player.value)}</b>
          <small>VALOR DE MERCADO</small>
        </span>
        <span>
          <b>
            {happiness === undefined
              ? points === undefined
                ? '—'
                : (points / 100).toFixed(2)
              : `${happiness}%`}
          </b>
          <small>{happiness === undefined ? 'PUNTOS' : 'FELICIDAD'}</small>
        </span>
      </div>
      <div className="sports-card-status">
        {player.simulated ? 'IDENTIDAD FICTICIA' : 'IDENTIDAD VERIFICADA'} ·{' '}
        {player.status === 'injured'
          ? 'LESIONADO'
          : player.status === 'doubtful'
            ? 'DUDA'
            : 'DISPONIBLE'}
      </div>
      {quality !== undefined && (
        <div className={`sports-card-slot slot-quality-${quality}`}>
          CASILLA {['BÁSICO', 'BRONCE', 'PLATA', 'ORO'][quality]} · +{[0, 5, 12, 25][quality]}%
        </div>
      )}
    </article>
  );
}
