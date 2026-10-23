import { BRAND } from '../../shared/brand';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, CirclePlus, Crown, Grip, Shield, Users, X } from 'lucide-react';
import { FORMATIONS, RULES } from '../../shared/config';
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
  const [tab, setTab] = useState('lineup'),
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
  const counts = ['DEL', 'MED', 'DEF', 'POR'].map((pos) =>
    sel.starters.map((s, i) => ({ ...s, index: i })).filter((s) => s.position === pos),
  );
  const currentFormation =
    Object.entries(FORMATIONS).find(
      ([, positions]) => positions.join(',') === sel.starters.map((x) => x.position).join(','),
    )?.[0] || '4-4-2';
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
            <label>
              FORMACIÓN
              <select
                aria-label="Formación"
                value={currentFormation}
                onChange={(e) =>
                  void act(
                    { type: 'formation', formation: e.target.value },
                    'Formación actualizada. Vuelve a asignar tu once.',
                  )
                }
                disabled={sel.locked}
              >
                {Object.keys(FORMATIONS)
                  .slice(0, 1 + (club.facilities.pitch || 0))
                  .map((f) => (
                    <option key={f}>{f}</option>
                  ))}
              </select>
            </label>
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
          <div className="football-pitch">
            <div className="pitch-lines">
              <i className="center-circle" />
              <i className="center-line" />
              <i className="box-top" />
              <i className="box-bottom" />
            </div>
            {counts.map((row, ri) => (
              <div className={`pitch-row pitch-row-${ri}`} key={ri}>
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
              {sel.locked ? 'CONGELADA' : 'GUARDADO EN SERVIDOR'}
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
        <Section title="Siempre preparados">
          <div className="card">
            <div className="mini-metrics">
              <span>
                <b>{RULES.bench[Math.min(7, club.facilities.bench || 0)][0]}</b>Suplentes
                disponibles
              </span>
              <span>
                <b>{RULES.bench[Math.min(7, club.facilities.bench || 0)][1]}</b>Entradas automáticas
              </span>
            </div>
            <p>
              Un suplente por demarcación. Todos cobran convocatoria. La entrada automática espera
              al final del partido del suplente.
            </p>
            <Link className="text-link" to="/building/stadium">
              Ampliar banquillo <ArrowRight size={15} />
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
                      disabled={sel.locked}
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
              Mejorar calidad de la casilla <Crown size={14} />
            </Link>
          </section>
        </div>
      )}
    </>
  );
}
