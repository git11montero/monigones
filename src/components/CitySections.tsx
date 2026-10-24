import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { CITY_GROUPS, buildingAccess } from '../lib/city-access';
import { useGame } from '../lib/api';
import { BuildingArt } from './City';
import { AttentionBadge } from './Attention';
import { Countdown } from './ui';
export function CitySections() {
  const { state, club } = useGame();
  return (
    <div className="city-sections" aria-label="Instalaciones de la ciudad">
      {CITY_GROUPS.map((group) => (
        <section key={group.name}>
          <h2>{group.name}</h2>
          {group.ids.map((id) => {
            const { building, level, to, job } = buildingAccess(state, club, id);
            return (
              <Link key={id} to={to} className="city-section-access" data-building={id}>
                <BuildingArt building={building} level={level} constructing={!!job} />
                <span className="grow">
                  <span className="section-building-name">
                    <b>{building.name}</b>
                    <AttentionBadge to={to} />
                  </span>
                  <small>
                    {building.max > 0 ? `Nivel ${level} · ` : ''}
                    {job ? 'En obras · ' : 'Disponible'}
                    {job && <Countdown to={job.endsAt} now={state.now} />}
                  </small>
                </span>
                <ChevronRight size={17} />
              </Link>
            );
          })}
        </section>
      ))}
    </div>
  );
}
