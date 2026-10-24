import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, X } from 'lucide-react';
import { matchdaySummary } from '../../shared/matchday-summary';
import { shortMoney } from '../../shared/math';
import { useGame } from '../lib/api';
import { remainingTime, useServerNow } from './GameClock';
import { ResourceAmount } from './ResourceVisibility';
export function CityMatchday() {
  const { state, club } = useGame(),
    now = useServerNow(state.now);
  const summary = matchdaySummary(state, club);
  const [open, setOpen] = useState(false),
    root = useRef<HTMLDivElement>(null),
    button = useRef<HTMLButtonElement>(null),
    id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  if (!summary) return null;
  const { round, status, event, report } = summary;
  return (
    <div className="city-matchday" ref={root}>
      <button
        ref={button}
        className={`matchday-toggle ${round.status === 'live' ? 'is-live' : ''}`}
        aria-label={`Jornada ${round.number} · ${status}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <b>
          J{round.number} · {status}
        </b>
        <span title={event?.label}>{event ? remainingTime(event.at, now) : '—'}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <section
          id={id}
          className="city-round-panel"
          role="region"
          aria-label={`Detalle de jornada ${round.number}`}
        >
          <div className="row spread">
            <h2>
              Jornada {round.number} · {status}
            </h2>
            <button aria-label="Cerrar detalle de jornada" onClick={() => setOpen(false)}>
              <X size={18} />
            </button>
          </div>
          {event && (
            <p className="round-next-event">
              {event.label}: <b>{remainingTime(event.at, now)}</b>
            </p>
          )}
          {status === 'Previa' && (
            <>
              <p>
                Inicio:{' '}
                {new Date(round.startsAt).toLocaleString('es-ES', {
                  timeZone: 'Europe/Madrid',
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}{' '}
                · Madrid
              </p>
              <dl className="round-facts">
                <div>
                  <dt>Convocatoria</dt>
                  <dd>
                    {club.selection.locked
                      ? club.selection.valid
                        ? 'Cerrada y válida'
                        : 'Cerrada · inválida'
                      : 'En preparación'}
                  </dd>
                </div>
                <div>
                  <dt>Futbolistas</dt>
                  <dd>
                    {summary.starters}/11 titulares · {summary.bench} suplentes
                  </dd>
                </div>
                <div>
                  <dt>{club.selection.locked ? 'Coste cobrado' : 'Coste previsto'}</dt>
                  <dd>
                    {summary.cost !== undefined ? (
                      <ResourceAmount>{shortMoney(summary.cost)}</ResourceAmount>
                    ) : (
                      summary.costError
                    )}
                  </dd>
                </div>
              </dl>
              <Link className="button secondary" to="/squad">
                Preparar alineación
              </Link>
            </>
          )}
          {status === 'En curso' && (
            <>
              <p>
                {round.matches.filter((m) => m.status === 'finished').length}/{round.matches.length}{' '}
                partidos finalizados · {round.matches.filter((m) => m.status === 'live').length} en
                juego
              </p>
              <dl className="round-facts">
                <div>
                  <dt>Puntos base provisionales</dt>
                  <dd>{((summary.points || 0) / 100).toFixed(2)}</dd>
                </div>
                <div>
                  <dt>Convocados</dt>
                  <dd>
                    {summary.starters} titulares · {summary.bench} suplentes
                  </dd>
                </div>
                <div>
                  <dt>Pendientes de finalizar</dt>
                  <dd>{summary.pending} titulares</dd>
                </div>
                <div>
                  <dt>Cambios restantes</dt>
                  <dd>
                    {summary.manual} manuales · {summary.auto} automáticos
                  </dd>
                </div>
              </dl>
            </>
          )}
          {status === 'Finalizada' && (
            <>
              {report ? (
                <>
                  <dl className="round-facts">
                    <div>
                      <dt>Resultado fantasy</dt>
                      <dd>
                        {(report.points / 100).toFixed(2)} puntos · {summary.rank}º de{' '}
                        {state.clubs.length}
                      </dd>
                    </div>
                    <div>
                      <dt>Convocatoria</dt>
                      <dd>{report.invalid ? 'Invalidada' : 'Liquidada'}</dd>
                    </div>
                  </dl>
                  <div className="round-settlement">
                    {[
                      ['Convocatoria', -report.salary],
                      ['Taquilla', report.stadium],
                      ['Conciertos', report.concerts],
                      ['Patrocinios', report.sponsors],
                      ['Tienda', report.merchandising],
                      ['Televisión', report.television],
                      ['Mantenimiento', -report.maintenance],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <b>
                          <ResourceAmount>{shortMoney(Number(value))}</ResourceAmount>
                        </b>
                      </div>
                    ))}
                  </div>
                  {club.trophies
                    .filter(
                      (t) =>
                        t.season === state.season &&
                        t.title === `Ganador de la jornada ${round.number}`,
                    )
                    .map((t) => (
                      <p key={t.id}>🏆 {t.title}</p>
                    ))}
                </>
              ) : (
                <p>Informe todavía no disponible.</p>
              )}
            </>
          )}
          <Link className="text-link" to={`/matchday?round=${round.number}`}>
            {round.settled ? 'Abrir informe' : 'Seguimiento completo'} →
          </Link>
        </section>
      )}
    </div>
  );
}
