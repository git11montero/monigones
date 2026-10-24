import { Link } from 'react-router-dom';
import { Gift, Hammer, Newspaper, Trophy } from 'lucide-react';
import { AttentionBadge } from './Attention';
import { useGame } from '../lib/api';
/** Mounted once in the city shell; switching the view never resets these accesses. */
export function CityShortcuts({
  jobsOpen,
  toggleJobs,
}: {
  jobsOpen: boolean;
  toggleJobs: () => void;
}) {
  const { state, club } = useGame(),
    count = state.jobs.filter((j) => j.clubId === club.id).length;
  return (
    <nav className="city-shortcuts" aria-label="Accesos rápidos de Ciudad">
      <Link to="/daily" aria-label="Actividades y recompensas">
        <Gift />
        <AttentionBadge to="/daily" />
        <span>
          Actividades<small>{club.dailyDone.length}/3</small>
        </span>
      </Link>
      <Link to="/events" aria-label="Eventos de liga">
        <Trophy />
        <AttentionBadge to="/events" />
        <span>Eventos</span>
      </Link>
      <Link to="/newspaper" aria-label="Leer el periódico">
        <Newspaper />
        <AttentionBadge to="/newspaper" />
        <span>El Balonazo</span>
      </Link>
      <button onClick={toggleJobs} aria-expanded={jobsOpen} aria-controls="city-jobs">
        <Hammer />
        <span>
          Obras<small>{count} en curso</small>
        </span>
      </button>
    </nav>
  );
}
