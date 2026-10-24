import atlasBounds from '../lib/v03-atlas-bounds.json';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, Hammer } from 'lucide-react';
import { useState } from 'react';
import { BUILDINGS, FACILITIES, RESEARCH } from '../../shared/config';
import type { BuildingDef } from '../../shared/types';
import { useGame } from '../lib/api';
import { BUILDING_VISUALS } from '../lib/visuals';
import { shortMoney } from '../../shared/math';
import type { Job } from '../../shared/types';
import { Confirm, Countdown, Progress } from './ui';
export function BuildingArt({
  building,
  level = 1,
  constructing = false,
}: {
  building: BuildingDef;
  level?: number;
  constructing?: boolean;
}) {
  const v = BUILDING_VISUALS[building.id],
    actual = building.max ? Math.max(1, Math.min(5, level)) : 3;
  const bounds = atlasBounds[v.atlas as keyof typeof atlasBounds][v.row][actual - 1];
  return (
    <span
      className={`building-art-wrap ${constructing ? 'constructing' : ''}`}
      data-building={building.id}
      data-level={actual}
    >
      <svg viewBox="0 0 390 380" className="building-art" aria-hidden="true">
        <svg
          x={(390 - bounds.width) / 2}
          y={370 - bounds.height}
          width={bounds.width}
          height={bounds.height}
          viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
          overflow="hidden"
        >
          <image href={`/art/v03/${v.atlas}.webp`} width="1536" height="1024" />
        </svg>
      </svg>
      {constructing && (
        <span className="construction-overlay" aria-hidden="true">
          <i className="crane" />
          <i className="construction-sparks" />
          <span className="work-barricade" />
          <Hammer size={24} />
        </span>
      )}
    </span>
  );
}
export { CanvasCity as CityMap } from './CanvasCity';
export function WorkQueue() {
  const { state, club, act } = useGame();
  const [cancel, setCancel] = useState<Job | null>(null);
  const jobs = state.jobs.filter((j) => j.clubId === club.id);
  return (
    <div className="work-list">
      {cancel && (
        <Confirm
          title="¿Cancelar este proyecto?"
          confirmLabel="Sí, cancelar proyecto"
          cancelLabel="Continuar proyecto"
          onClose={() => setCancel(null)}
          onConfirm={() =>
            void act(
              { type: 'cancelJob', id: cancel.id },
              'Proyecto cancelado. Devolución del 50 %.',
            )
          }
        >
          <h3>
            {BUILDINGS.find((b) => b.id === cancel.target)?.name ||
              FACILITIES.find((f) => f.id === cancel.target)?.name ||
              'Cantera'}{' '}
            · nivel {cancel.level}
          </h3>
          <p>
            Lleva {Math.floor((state.now - cancel.startedAt) / 60000)} minutos en curso. Recuperarás{' '}
            {shortMoney(Math.floor(cancel.money / 2))} y {Math.floor(cancel.development / 2)} PD.
          </p>
          <p>
            Perderás {shortMoney(cancel.money - Math.floor(cancel.money / 2))} y{' '}
            {cancel.development - Math.floor(cancel.development / 2)} PD. El progreso se pierde y
            esta cancelación es irreversible.
          </p>
        </Confirm>
      )}

      {jobs.length ? (
        jobs.map((j) => (
          <div className="card work-card" key={j.id}>
            <div className="row">
              <span className="icon-badge gold">
                <Hammer size={20} />
              </span>
              <div className="grow">
                <b>
                  {BUILDINGS.find((b) => b.id === j.target)?.name ||
                    FACILITIES.find((f) => f.id === j.target)?.name ||
                    RESEARCH.find((r) => r.id === j.target)?.name ||
                    'Proyecto de cantera'}
                </b>
                <p>
                  Nivel {j.level} · <Countdown to={j.endsAt} now={state.now} />
                </p>
              </div>
            </div>
            <Progress value={state.now - j.startedAt} max={j.endsAt - j.startedAt} />
            {j.kind !== 'research' && (
              <button className="text-link danger" onClick={() => setCancel(j)}>
                Cancelar · recuperar el 50 %
              </button>
            )}
          </div>
        ))
      ) : (
        <div className="queue-empty">
          <Check size={18} />
          <div>
            <b>Todo listo para crecer</b>
            <p>No tienes obras en curso.</p>
          </div>
          <Link to="/building/hq">
            <ChevronRight size={20} />
          </Link>
        </div>
      )}
    </div>
  );
}
