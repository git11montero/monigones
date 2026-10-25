import { FormationPicker } from '../components/FormationPicker';
import { FORMATION_CATALOG, selectionFormation, formationRows } from '../../shared/formations';
import { BRAND } from '../../shared/brand';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, CirclePlus, Grip, Shield, Users, X } from 'lucide-react';
import { RULES } from '../../shared/config';
import { callCost } from '../../shared/engine';
import { capacity, shortMoney } from '../../shared/math';
import { useGame } from '../lib/api';
import {
  Badge,
  Button,
  Empty,
  PageTitle,
  PlayerAvatar,
  PlayerRow,
  Section,
} from '../components/ui';
export default function SquadPage() {
  const { state, club, act } = useGame();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(() =>
      ['roster', 'bench'].includes(params.get('tab') || '') ? params.get('tab')! : 'lineup',
    ),
    [slot, setSlot] = useState<number | null>(null);
  const roster = state.contracts
    .filter((ct) => ct.clubId === club.id)
    .map((ct) => state.players.find((p) => p.id === ct.playerId)!);
  const sel = club.selection;
  let cost = 0;
  try {
    cost = callCost(state, club).cost;
  } catch {
    /* Errores específicos al confirmar operaciones. */
  }
  const currentFormation = selectionFormation(sel) || FORMATION_CATALOG[0];
  const counts = formationRows(currentFormation).map((row) =>
    row.map((index) => ({ ...sel.starters[index], index })),
  );
  const [benchMax, autoMax] = RULES.bench[Math.min(7, club.facilities.bench || 0)];
  return (
    <>
      <PageTitle
        eyebrow="ONCE NOMBRES. UNA IDENTIDAD."
        title="Tu equipo, tu idea"
        subtitle={`${roster.length}/${capacity(club)} futbolistas · ${sel.locked ? 'Convocatoria cerrada' : 'Preparando jornada ' + state.currentRound}`}
      />
      <div className="segmented padded-segment">
        <button className={tab === 'lineup' ? 'active' : ''} onClick={() => setTab('lineup')}>
          Alineación
        </button>
        <button className={tab === 'roster' ? 'active' : ''} onClick={() => setTab('roster')}>
          Plantilla
        </button>
        <button className={tab === 'bench' ? 'active' : ''} onClick={() => setTab('bench')}>
          Banquillo
        </button>
      </div>
      {tab === 'lineup' && (
        <>
          <div className="pitch-top">
            <FormationPicker
              current={currentFormation}
              disabled={sel.locked}
              onApply={(formation) =>
                act(
                  { type: 'formation', formation },
                  'Táctica guardada. Revisa las plazas disponibles.',
                )
              }
            />
            <button
              className="text-link"
              disabled={sel.locked}
              onClick={() =>
                void act({ type: 'autoLineup' }, 'Once organizado por demarcación y valor.')
              }
            >
              Once automático <Grip size={14} />
            </button>
          </div>
          <div className="football-pitch" data-formation={currentFormation.id}>
            <div className="pitch-lines">
              <i className="center-circle" />
              <i className="center-line" />
              <i className="box-top" />
              <i className="box-bottom" />
            </div>
            {counts.map((row, ri) => (
              <div
                className={`pitch-row pitch-row-${ri}`}
                style={{ gridTemplateColumns: `repeat(${row.length},minmax(0,1fr))` }}
                key={ri}
              >
                {row.map((s) => {
                  const p = state.players.find((p) => p.id === s.playerId);
                  return (
                    <button
                      key={s.index}
                      className={`pitch-player quality-${s.quality}`}
                      onClick={() => setSlot(s.index)}
                      aria-label={`${s.position}: ${p?.name || 'Posición vacía'}`}
                    >
                      <span className="pitch-shirt">
                        {p ? <PlayerAvatar player={p} size={43} /> : <CirclePlus size={26} />}
                      </span>
                      <span className="pitch-player-name">
                        {p ? p.name.split(' ').slice(-2).join(' ') : 'Sin asignar'}
                      </span>
                      <span className="pitch-position">
                        {s.position}
                        <i
                          title={
                            ['Casilla Básico', 'Casilla Bronce', 'Casilla Plata', 'Casilla Oro'][
                              s.quality
                            ]
                          }
                        >
                          {['Bás', 'Br', 'Pl', 'Or'][s.quality]}
                        </i>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
            <span className="pitch-watermark">{BRAND.name}</span>
          </div>
          <div className="lineup-cost">
            <div>
              <span>{sel.locked ? 'CONVOCATORIA COBRADA' : 'COSTE PREVISTO DE CONVOCATORIA'}</span>
              <strong>{shortMoney(sel.locked ? sel.cost : cost)}</strong>
            </div>
            <Badge kind={sel.locked ? 'gold' : 'green'}>
              {sel.locked ? 'CONGELADA' : 'ONCE GUARDADO'}
            </Badge>
          </div>
          <div className="info-note">
            <Shield size={18} />
            <p>
              Se cobra automáticamente una hora antes del primer partido. Cada casilla vacía resta 5
              puntos. Un convocado sin minutos puntúa 0.
            </p>
          </div>
          <div className="padded">
            <Link to="/matchday" className="card access-link">
              Política de entradas y jornada <ArrowRight size={19} />
            </Link>
          </div>
        </>
      )}
      {tab === 'roster' && (
        <div className="padded">
          {roster.length ? (
            roster.map((p) => (
              <PlayerRow
                key={p.id}
                player={p}
                aside={
                  <>
                    <b>{shortMoney(p.value)}</b>
                    <span className="muted">
                      Felicidad {state.contracts.find((ct) => ct.playerId === p.id)?.happiness}%
                    </span>
                  </>
                }
              />
            ))
          ) : (
            <Empty title="Un vestuario por construir" icon={Users}>
              Participa en el draft para fichar a tus primeros futbolistas.
            </Empty>
          )}
          <Link className="button secondary" to="/market">
            Buscar talento <ArrowRight size={17} />
          </Link>
        </div>
      )}
      {tab === 'bench' && (
        <div className="bench-area">
          <Section title="Siempre preparados">
            <div className="bench-summary">
              <div className="bench-capacity">
                <span>
                  <b>
                    {sel.bench.length}/{benchMax}
                  </b>
                  Suplentes convocados
                </span>
                <span>
                  <b>{autoMax}</b>Entradas automáticas
                </span>
              </div>
              {benchMax === 0 ? (
                <p>
                  Amplía Banquillo a nivel 1 en el estadio: un suplente y una entrada automática.
                </p>
              ) : (
                <p>
                  Un suplente por demarcación. Todos cobran convocatoria; las entradas automáticas
                  esperan al final de su partido.
                </p>
              )}
              <Link className="text-link" to="/building/stadium">
                {benchMax ? 'Ampliar banquillo' : 'Desbloquear banquillo'} <ArrowRight size={16} />
              </Link>
            </div>
            {roster
              .filter((p) => !sel.starters.some((s) => s.playerId === p.id))
              .map((p) => (
                <div className="bench-player" key={p.id}>
                  <PlayerRow
                    player={p}
                    aside={
                      <Button
                        variant="small secondary"
                        aria-label={`${sel.bench.includes(p.id) ? 'Quitar' : 'Añadir'} ${p.name} ${sel.bench.includes(p.id) ? 'del' : 'al'} banquillo`}
                        disabled={
                          sel.locked ||
                          (!sel.bench.includes(p.id) &&
                            (sel.bench.length >= benchMax ||
                              sel.bench.some(
                                (id) =>
                                  state.players.find((player) => player.id === id)?.position ===
                                  p.position,
                              )))
                        }
                        onClick={() =>
                          void act({ type: 'bench', playerId: p.id }, 'Banquillo actualizado.')
                        }
                      >
                        {sel.bench.includes(p.id) ? <Check size={16} /> : <CirclePlus size={16} />}
                      </Button>
                    }
                  />
                </div>
              ))}
            {!roster.filter((p) => !sel.starters.some((s) => s.playerId === p.id)).length && (
              <Empty title="Todos están en el once">
                Ficha más jugadores y amplía tu banquillo para tener alternativas.
              </Empty>
            )}
          </Section>
        </div>
      )}
      {slot !== null && (
        <div className="modal-backdrop" onClick={() => setSlot(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Seleccionar jugador"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="modal-handle" />
            <button className="modal-close" onClick={() => setSlot(null)} aria-label="Cerrar">
              <X size={20} />
            </button>
            <Badge kind="gold">
              CASILLA {slot + 1} · {sel.starters[slot].position}
            </Badge>
            <h2>{sel.locked ? 'Cambio durante la jornada' : 'Elige a tu titular'}</h2>
            {(sel.locked ? roster.filter((p) => sel.bench.includes(p.id)) : roster)
              .filter((p) => p.position === sel.starters[slot].position)
              .map((p) => (
                <div key={p.id} className="selection-option">
                  <PlayerRow
                    player={p}
                    aside={
                      <Button
                        variant="small secondary"
                        aria-label={`${sel.locked ? 'Cambiar por' : 'Alinear'} ${p.name}`}
                        onClick={() => {
                          void act(
                            { type: sel.locked ? 'manualSub' : 'lineup', slot, playerId: p.id },
                            sel.locked ? 'Cambio manual realizado.' : 'Alineación guardada.',
                          );
                          setSlot(null);
                        }}
                      >
                        {p.id === sel.starters[slot!].playerId ? (
                          <Check size={16} />
                        ) : (
                          <ArrowRight size={16} />
                        )}
                      </Button>
                    }
                  />
                </div>
              ))}
            {!sel.locked && (
              <Button
                variant="secondary"
                onClick={() => {
                  void act({ type: 'lineup', slot, playerId: null }, 'Casilla vaciada.');
                  setSlot(null);
                }}
              >
                Dejar posición vacía
              </Button>
            )}
            <Link to="/training" onClick={() => setSlot(null)} className="text-link">
              Mejorar calidad de la casilla <Shield size={14} />
            </Link>
          </section>
        </div>
      )}
    </>
  );
}
