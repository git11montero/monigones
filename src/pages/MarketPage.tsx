import { PlayerCard } from '../components/PlayerCard';
import { PhotoCredit } from '../components/PlayerPortrait';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Heart, Info, ShieldCheck, Star } from 'lucide-react';
import { shortMoney } from '../../shared/math';
import { clubById } from '../../shared/sports';
import { useGame } from '../lib/api';
import {
  Badge,
  Button,
  Confirm,
  Countdown,
  Empty,
  PageTitle,
  PlayerRow,
  Progress,
  Section,
} from '../components/ui';
export default function MarketPage() {
  const { state, club, act, available } = useGame();
  const [tab, setTab] = useState('agents'),
    [position, setPosition] = useState('Todos'),
    [search, setSearch] = useState('');
  const bids = state.bids.filter((b) => b.clubId === club.id);
  const ids = tab === 'agents' ? state.marketPlayers : state.players.map((p) => p.id);
  const players = state.players.filter(
    (p) =>
      ids.includes(p.id) &&
      (position === 'Todos' || p.position === position) &&
      p.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        eyebrow="EL TALENTO NO ESPERA"
        title="La próxima gran firma"
        subtitle={`Un mercado. ${state.clubs.length - 1} rivales. Tu mejor movimiento.`}
      />
      <div className="market-deadline">
        <div>
          <span className="eyebrow">CIERRE DEL MERCADO · 06:00 MADRID</span>
          <Countdown to={state.nextMarketAt} now={state.now} />
        </div>
        <span className="market-stamp">
          {state.marketPlayers.length}
          <small>
            AGENTES
            <br />
            LIBRES
          </small>
        </span>
      </div>
      <div className="market-budget">
        <span>Disponible para pujar</span>
        <strong>{shortMoney(available)}</strong>
        <span className="muted">Reservado: {shortMoney(club.resources.money - available)}</span>
      </div>
      <div className="segmented padded-segment">
        {[
          ['agents', 'Agentes libres'],
          ['bids', 'Mis ofertas'],
          ['catalog', 'Ojeador'],
        ].map(([id, t]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {t}
          </button>
        ))}
      </div>
      {tab !== 'bids' ? (
        <>
          <div className="market-filters">
            <input
              aria-label="Buscar futbolista"
              placeholder="Buscar tu próximo fichaje…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="filter-pills">
              {['Todos', 'POR', 'DEF', 'MED', 'DEL'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPosition(p)}
                  className={position === p ? 'active' : ''}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="padded">
            {players.length ? (
              players.slice(0, 120).map((p) => {
                const mine = state.bids.find(
                  (b) => b.clubId === club.id && b.playerId === p.id && b.status === 'open',
                );
                const ct = state.contracts.find((c) => c.playerId === p.id);
                return tab === 'agents' ? (
                  <Link to={`/player/${p.id}`} className="market-card" key={p.id}>
                    <PlayerCard
                      player={p}
                      size="market"
                      points={
                        state.rounds.find((r) => r.number === state.currentRound)?.scores[p.id]
                          ?.points
                      }
                      happiness={ct?.clubId === club.id ? ct.happiness : undefined}
                    />
                    <div className="market-card-bottom">
                      <span>
                        {mine
                          ? `Tu puja: ${shortMoney(mine.amount)}`
                          : 'Tu próximo capítulo empieza con una oferta.'}
                      </span>
                      <span className="bid-arrow">
                        <ArrowRight size={18} />
                      </span>
                    </div>
                  </Link>
                ) : (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    aside={
                      <>
                        <strong>{shortMoney(p.value)}</strong>
                        <span className="muted">
                          {ct ? state.clubs.find((c) => c.id === ct.clubId)?.name : 'Libre'}
                        </span>
                      </>
                    }
                  />
                );
              })
            ) : (
              <Empty title="No hay resultados">Prueba otra búsqueda o demarcación.</Empty>
            )}
            {players.length > 120 && (
              <p className="hint">Se muestran 120 resultados. Afina la búsqueda para ver más.</p>
            )}
          </div>
        </>
      ) : (
        <div className="padded">
          {bids.length ? (
            bids.toReversed().map((b) => {
              const p = state.players.find((p) => p.id === b.playerId)!;
              return (
                <div className="card" key={b.id}>
                  <PlayerRow
                    player={p}
                    aside={
                      <>
                        <strong>{shortMoney(b.amount)}</strong>
                        <Badge kind={b.status === 'won' ? 'green' : ''}>
                          {
                            {
                              open: 'Abierta',
                              won: 'Adjudicada',
                              rejected: 'Rechazada por el jugador',
                              lost: 'No ganadora',
                              withdrawn: 'Retirada',
                            }[b.status]
                          }
                        </Badge>
                      </>
                    }
                  />
                  <p className="hint">
                    Salario: {b.salaryBps / 100} % por convocatoria
                    {b.roll !== undefined
                      ? ` · Sorteo auditado ${b.roll.toFixed(2)} / rechazo ${b.rejection?.toFixed(2)} %`
                      : ''}
                  </p>
                  {b.status === 'open' && (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        void act(
                          { type: 'withdrawBid', id: b.id },
                          'Oferta retirada y reserva liberada.',
                        )
                      }
                    >
                      Retirar oferta
                    </Button>
                  )}
                </div>
              );
            })
          ) : (
            <Empty title="Tu libreta está abierta" icon={Star}>
              Envía una oferta a uno de los cinco agentes del día.
            </Empty>
          )}
        </div>
      )}
      <div className="info-note">
        <Info size={16} />
        <p>
          Ofertas secretas hasta el cierre. El jugador puede rechazarlas; el atractivo combina
          dinero, salario y fama. Los valores de mercado son simulados.
        </p>
      </div>
    </>
  );
}
export function PlayerPage() {
  const { id } = useParams();
  const { state, club, act, effects } = useGame();
  const p = state.players.find((p) => p.id === id);
  const [offer, setOffer] = useState(''),
    [salary, setSalary] = useState(
      () =>
        state.bids.find((b) => b.playerId === id && b.clubId === club.id && b.status === 'open')
          ?.salaryBps ?? 200,
    ),
    [confirm, setConfirm] = useState(false),
    [trade, setTrade] = useState(false),
    [offered, setOffered] = useState(''),
    [loan, setLoan] = useState(0);
  if (!p) return <Empty title="Futbolista no encontrado" />;
  const ct = state.contracts.find((c) => c.playerId === id),
    owner = state.clubs.find((c) => c.id === ct?.clubId);
  const mine = ct?.clubId === club.id;
  const free = state.marketPlayers.includes(p.id) && !ct;
  const bid = state.bids.find(
    (b) => b.playerId === p.id && b.clubId === club.id && b.status === 'open',
  );
  const amount = offer ? Math.round(Number(offer) * 100) : bid?.amount || p.value;
  const history = p.valueHistory.slice(-15),
    min = Math.min(...history.map((x) => x.value)) * 0.96,
    max = Math.max(...history.map((x) => x.value)) * 1.04;
  return (
    <>
      <PageTitle
        back
        eyebrow={`${p.position} · ${clubById(p.realClubId).name}`}
        title="Ficha de futbolista"
      />
      <div className="player-hero">
        <div className="player-hero-pattern" />
        <PlayerCard
          player={p}
          size="large"
          happiness={ct?.happiness}
          points={state.rounds.find((r) => r.number === state.currentRound)?.scores[p.id]?.points}
        />
        <PhotoCredit player={p} />
        <h1>{p.name}</h1>
        <p>
          {clubById(p.realClubId).name} · {p.position}
        </p>
        <Badge kind="gold">
          {p.simulated ? 'FUTBOLISTA FICTICIO' : 'IDENTIDAD CON FUENTE'} · VM SIMULADO
        </Badge>
        <div className="player-hero-stats">
          <span>
            <strong>{shortMoney(p.value)}</strong>Valor de mercado
          </span>
          <span>
            <strong>{ct ? `${ct.happiness}%` : '—'}</strong>Felicidad
          </span>
          <span>
            <strong>{ct ? `${ct.salaryBps / 100}%` : '2%'}</strong>Salario
          </span>
        </div>
      </div>
      <Section title="Evolución del valor">
        <div className="card">
          <svg
            viewBox="0 0 340 90"
            className="value-chart"
            role="img"
            aria-label="Evolución simulada del valor de mercado"
          >
            <path
              d={`M0 86 ${history.map((h, i) => `L${history.length === 1 ? 170 : (i / (history.length - 1)) * 340} ${86 - ((h.value - min) / (max - min)) * 76}`).join(' ')} L340 90 L0 90Z`}
              fill="#e3eee3"
            />
            <polyline
              points={history
                .map(
                  (h, i) =>
                    `${history.length === 1 ? 170 : (i / (history.length - 1)) * 340},${86 - ((h.value - min) / (max - min)) * 76}`,
                )
                .join(' ')}
              stroke="#397d5e"
              strokeWidth="2.5"
              fill="none"
            />
            {history.length === 1 && <circle cx="170" cy="48" r="4" fill="#397d5e" />}
          </svg>
          <div className="row spread muted">
            <span>
              {new Date(history[0].at).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })}
            </span>
            <span>{shortMoney(p.value)}</span>
          </div>
        </div>
      </Section>
      {free && (
        <Section
          eyebrow="HAZ TU MOVIMIENTO"
          title={bid ? 'Modificar oferta secreta' : 'Oferta de fichaje'}
        >
          <form
            className="card"
            onSubmit={(e) => {
              e.preventDefault();
              void act(
                { type: 'bid', playerId: p.id, amount, salaryBps: salary },
                'Oferta secreta guardada. El importe queda reservado.',
              );
            }}
          >
            <label>
              Importe de la puja (€)
              <input
                type="number"
                min={p.value / 100}
                step="1000"
                value={offer || amount / 100}
                onChange={(e) => setOffer(e.target.value)}
                required
              />
            </label>
            <label>
              Salario por convocatoria <b>{salary / 100} %</b>
              <input
                type="range"
                min="200"
                max="1000"
                step="25"
                value={salary}
                onChange={(e) => setSalary(Number(e.target.value))}
              />
            </label>
            <p className="hint">
              Mínimo {shortMoney(p.value)} · El salario solo se paga al convocarlo. El club puede
              reservar dinero para varias ofertas.
            </p>
            <Button type="submit">
              {bid ? 'Guardar cambios' : 'Enviar oferta secreta'}
              <ArrowUpRight size={17} />
            </Button>
          </form>
        </Section>
      )}
      {mine && ct && (
        <Section title="Tu contrato">
          <div className="card">
            <div className="row spread">
              <span>Felicidad</span>
              <b>{ct.happiness}/100</b>
            </div>
            <Progress value={ct.happiness} />
            <div className="definition-row">
              <span>Cláusula de rescisión</span>
              <strong>{shortMoney(ct.clause)}</strong>
            </div>
            <div className="definition-row">
              <span>Blindaje</span>
              <strong>
                {ct.shieldUntil > state.now ? (
                  <Countdown to={ct.shieldUntil} now={state.now} />
                ) : (
                  'Sin blindaje'
                )}
              </strong>
            </div>
            <div className="definition-row">
              <span>Final del contrato</span>
              <strong>
                {new Date(ct.endsAt).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })}
              </strong>
            </div>
            <Button
              variant="secondary"
              onClick={() =>
                void act({ type: 'shield', playerId: p.id }, 'Blindaje activado durante 15 días.')
              }
              disabled={!club.modules.includes('shield') || ct.shieldUntil > state.now}
            >
              <ShieldCheck size={16} />
              Blindar · {shortMoney(Math.round(p.value / 2))}
            </Button>
            {club.modules.includes('renegotiate') && ct.salaryBps > 50 && (
              <Button
                variant="secondary"
                onClick={() =>
                  void act(
                    {
                      type: 'renegotiate',
                      playerId: p.id,
                      salaryBps: Math.max(50, ct.salaryBps - 50),
                    },
                    'Salario renegociado.',
                  )
                }
              >
                Reducir salario 0,5 pp · {shortMoney(Math.round(p.value * 0.3))}
              </Button>
            )}
            <Button variant="danger-button" onClick={() => setConfirm(true)}>
              Vender · {shortMoney(Math.round(p.value * (0.85 + effects.sale / 10000)))}
            </Button>
          </div>
        </Section>
      )}
      {owner && !mine && (
        <Section title={`En ${owner.name}`}>
          <div className="card">
            <p>
              Envía una propuesta con dinero, un futbolista de intercambio o una cesión si la tienes
              desbloqueada.
            </p>
            <Button onClick={() => setTrade(!trade)}>
              Negociar fichaje <ArrowRight size={17} />
            </Button>
            {trade && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(
                    {
                      type: 'negotiate',
                      playerId: p.id,
                      amount,
                      offeredPlayerId: offered || undefined,
                      loanRounds: loan || undefined,
                    },
                    'Propuesta enviada al presidente rival.',
                  );
                  setTrade(false);
                }}
              >
                <label>
                  Dinero ofrecido (€)
                  <input
                    type="number"
                    min="0"
                    value={offer}
                    placeholder={String(p.value / 100)}
                    onChange={(e) => setOffer(e.target.value)}
                  />
                </label>
                <label>
                  Futbolista de intercambio
                  <select value={offered} onChange={(e) => setOffered(e.target.value)}>
                    <option value="">Sin intercambio</option>
                    {state.contracts
                      .filter((ct) => ct.clubId === club.id)
                      .map((ct) => (
                        <option key={ct.playerId} value={ct.playerId}>
                          {state.players.find((p) => p.id === ct.playerId)?.name}
                        </option>
                      ))}
                  </select>
                </label>
                {club.modules.includes('loans') && (
                  <label>
                    Modalidad
                    <select value={loan} onChange={(e) => setLoan(Number(e.target.value))}>
                      <option value="0">Traspaso</option>
                      <option value="1">Cesión 1 jornada</option>
                      <option value="2">Cesión 2 jornadas</option>
                      <option value="3">Cesión 3 jornadas</option>
                    </select>
                  </label>
                )}
                <Button type="submit">Enviar propuesta</Button>
              </form>
            )}
            <Button
              variant="secondary"
              onClick={() => void act({ type: 'clause', playerId: p.id }, 'Cláusula ejecutada.')}
            >
              Pagar cláusula · {shortMoney(ct!.clause)}
            </Button>
          </div>
        </Section>
      )}
      {!mine && (
        <div className="padded">
          <Button
            variant="secondary"
            onClick={() =>
              void act(
                { type: 'wish', playerId: p.id },
                club.wish.includes(p.id)
                  ? 'Retirado de deseados.'
                  : 'Añadido a la lista de deseados.',
              )
            }
          >
            <Heart size={16} />
            {club.wish.includes(p.id) ? 'Quitar de deseados' : 'Marcar como deseado'} ·{' '}
            {club.wish.length}/{effects.wish}
          </Button>
        </div>
      )}
      <Section title="Historial deportivo">
        <div className="card">
          {state.rounds.filter((r) => r.scores[p.id]).length ? (
            state.rounds
              .filter((r) => r.scores[p.id])
              .map((r) => (
                <div className="definition-row" key={r.number}>
                  <span>
                    Jornada {r.number} · {r.scores[p.id].minutes} minutos
                  </span>
                  <strong>{(r.scores[p.id].points / 100).toFixed(2)} pts</strong>
                </div>
              ))
          ) : (
            <p>El historial se completará cuando termine su primer encuentro simulado.</p>
          )}
        </div>
      </Section>
      <Section title="Historial de operaciones">
        <div className="card">
          {state.transfers
            .filter((t) => t.playerId === p.id)
            .map((t) => (
              <div key={t.id} className="definition-row">
                <span>{t.kind}</span>
                <b>{shortMoney(t.amount)}</b>
              </div>
            ))}
        </div>
      </Section>
      {p.source && (
        <p className="source-note">
          Identidad y pertenencia:{' '}
          <a href={p.source} target="_blank" rel="noreferrer">
            fuente consultada
          </a>{' '}
          · {p.verifiedAt}. Posición fantasy adaptada. Estados, contratos, puntos y VM simulados.
        </p>
      )}
      {confirm && (
        <Confirm
          title={`Vender a ${p.name}`}
          onClose={() => setConfirm(false)}
          onConfirm={() =>
            void act({ type: 'sell', playerId: p.id }, 'Futbolista vendido al mercado.')
          }
        >
          <p>
            Recibirás {shortMoney(Math.round(p.value * (0.85 + effects.sale / 10000)))}. La
            operación elimina al jugador de tu próxima alineación.
          </p>
        </Confirm>
      )}
    </>
  );
}
