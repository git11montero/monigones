import { AttentionBadge } from '../components/Attention';
import { Link } from 'react-router-dom';
import { ChevronRight, Flag, Gift, Hammer, Newspaper, Trophy, X } from 'lucide-react';
import { useState } from 'react';
import { useGame } from '../lib/api';
import { CityMap, WorkQueue } from '../components/City';
import { Countdown } from '../components/ui';
import { cityEnvironment } from '../lib/visuals';
export default function CityPage() {
  const { state, club } = useGame(),
    [jobs, setJobs] = useState(false);
  const { round, live } = cityEnvironment(state, club);
  const count = state.jobs.filter((j) => j.clubId === club.id).length;
  return (
    <div className="city-page">
      <div className="city-command">
        <div>
          <span className="eyebrow">TU CIUDAD DEPORTIVA</span>
          <h1>Tu club. Tu afición.</h1>
        </div>
        <Link to="/league" className="season-seal">
          <Trophy size={18} />
          <b>T{String(state.season).padStart(2, '0')}</b>
        </Link>
      </div>
      <CityMap />
      <div className="city-shortcuts">
        <Link to="/daily" aria-label="Actividades y recompensas">
          <Gift />
          <AttentionBadge to="/daily" />
          <span>
            Actividades<small>{club.dailyDone.length}/3</small>
          </span>
        </Link>
        <Link to="/events" aria-label="Eventos de liga">
          <Trophy />
          <span>Eventos</span>
          <AttentionBadge to="/events" />
        </Link>
        <Link to="/newspaper" aria-label="Leer el periódico">
          <Newspaper />
          <AttentionBadge to="/newspaper" />
          <span>El Balonazo</span>
        </Link>
        <button onClick={() => setJobs(!jobs)} aria-expanded={jobs}>
          <Hammer />
          <span>
            Obras<small>{count} en curso</small>
          </span>
        </button>
      </div>
      <Link to="/matchday" className={`city-match-dock ${live ? 'is-live' : ''}`}>
        <span className="round-icon">
          <Flag size={20} />
        </span>
        <span>
          <small>
            JORNADA {round?.number || state.currentRound} · {live ? 'EN JUEGO' : 'PREVIA'}
          </small>
          <b>{live ? 'Tu estadio está vibrando' : 'El próximo partido empieza contigo'}</b>
        </span>
        {round && <Countdown to={round.locksAt} now={state.now} />}
        <ChevronRight size={18} />
      </Link>
      {jobs && (
        <div className="city-jobs-panel">
          <div className="row spread">
            <h2>Tu club está creciendo</h2>
            <button aria-label="Cerrar construcciones" onClick={() => setJobs(false)}>
              <X />
            </button>
          </div>
          <WorkQueue />
        </div>
      )}
    </div>
  );
}
