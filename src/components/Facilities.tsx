import { AtlasSprite } from './AtlasSprite';
import { useState } from 'react';
import { Hammer, LockKeyhole, X } from 'lucide-react';
import { FACILITIES } from '../../shared/config';
import { facilityLimit, jobQuote } from '../../shared/engine';
import { shortMoney } from '../../shared/math';
import { useGame } from '../lib/api';
import { Badge, Button, Countdown } from './ui';
export function FacilityArt({ index }: { index: number; level?: number }) {
  return (
    <AtlasSprite
      atlas="facilities"
      row={Math.floor(index / 4)}
      column={index % 4}
      width={130}
      height={95}
      className="facility-illustration"
      label={`Ilustración de ${FACILITIES[index].name}`}
    />
  );
}
export function Facilities() {
  const { club, state, act } = useGame(),
    [selected, setSelected] = useState<number | null>(null),
    f = selected === null ? null : FACILITIES[selected];
  const level = f ? club.facilities[f.id] || 0 : 0,
    job = f
      ? state.jobs.find((j) => j.clubId === club.id && j.kind === 'facility' && j.target === f.id)
      : undefined;
  let q: ReturnType<typeof jobQuote> | undefined,
    why = '';
  if (f)
    try {
      q = jobQuote(club, 'facility', f.id);
    } catch (e) {
      why = (e as Error).message;
    }
  return (
    <>
      <div className="facility-selector">
        {FACILITIES.map((f, i) => (
          <button className="facility-tile" key={f.id} onClick={() => setSelected(i)}>
            <FacilityArt index={i} level={club.facilities[f.id] || 0} />
            <span>{f.name}</span>
            <small>
              Nv. {club.facilities[f.id] || 0}/{f.max}
              {state.jobs.some((j) => j.clubId === club.id && j.target === f.id)
                ? ' · EN OBRA'
                : ''}
            </small>
          </button>
        ))}
      </div>
      {f && selected !== null && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section
            className="modal facility-detail"
            role="dialog"
            aria-modal="true"
            aria-label={f.name}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Cerrar instalación"
              onClick={() => setSelected(null)}
            >
              <X size={20} />
            </button>
            <Badge kind="gold">ESTADIO · INSTALACIONES</Badge>
            <h2>{f.name}</h2>
            <FacilityArt index={selected} level={level} />
            <p>{f.description}</p>
            <div className="mini-metrics">
              <span>
                <b>
                  {level}/{f.max}
                </b>
                Nivel actual
              </span>
              <span>
                <b>{facilityLimit(club, f.id)}</b>Límite por estadio
              </span>
            </div>
            <p className="hint">
              Las mejoras y sus requisitos se calculan en el motor existente. El siguiente nivel
              incorpora el beneficio de esta instalación.
            </p>
            {job ? (
              <Countdown to={job.endsAt} now={state.now} />
            ) : q ? (
              <>
                <div className="resource-quote">
                  <span>
                    <b>{shortMoney(q.money)}</b>Coste
                    <small> · tienes {shortMoney(club.resources.money)}</small>
                  </span>
                  <span>
                    <b>{(q.duration / 3600000).toFixed(1)} h</b>Duración
                  </span>
                </div>
                <Button
                  onClick={() =>
                    void act({ type: 'facility', target: f.id }, 'Mejora de instalación iniciada.')
                  }
                >
                  <Hammer size={16} />
                  Mejorar a nivel {q.level}
                </Button>
              </>
            ) : (
              <div className="locked-reason">
                <LockKeyhole size={16} />
                {why}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
