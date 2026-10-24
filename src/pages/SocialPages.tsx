import { UnsavedChanges } from '../components/UnsavedChanges';
import { AttentionBadge, ReadAttention } from '../components/Attention';
import { GameSelect } from '../components/GameSelect';
import { BRAND } from '../../shared/brand';
import { PlayerCard } from '../components/PlayerCard';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Gavel,
  Gift,
  MessageCircle,
  Send,
  Star,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { euro } from '../../shared/config';
import { dayKey, shortMoney } from '../../shared/math';
import { useGame } from '../lib/api';
import {
  Badge,
  Button,
  Countdown,
  Crest,
  Empty,
  PageTitle,
  Progress,
  PlayerRow,
  Section,
  Confirm,
} from '../components/ui';
export function NewspaperPage() {
  const { state } = useGame();
  const [chatOpen, setChatOpen] = useState(false);
  const editions = [...new Set(state.news.map((n) => dayKey(n.at)))].sort().reverse();
  const [edition, setEdition] = useState(editions[0]),
    [category, setCategory] = useState('Todo'),
    [articleId, setArticleId] = useState<string | null>(null);
  const article = state.news.find((n) => n.id === articleId);
  const stories = state.news
    .filter((n) => dayKey(n.at) === edition && (category === 'Todo' || n.category === category))
    .toReversed();
  const lead = stories[0];
  return (
    <div className="newspaper">
      {!chatOpen && <ReadAttention to="/newspaper" only={stories.map((n) => `news:${n.id}`)} />}
      <button
        className="newspaper-chat-toggle"
        onClick={() => setChatOpen(true)}
        aria-label="Abrir chat de la liga"
      >
        <MessageCircle size={20} /> Vestuario <AttentionBadge to="/chat" />
      </button>
      <div className="newspaper-date">
        <span>LA VOZ DE TU LIGA</span>
        <span>EDICIÓN {editions.length}</span>
      </div>
      <header className="newspaper-masthead">
        <span>INDEPENDIENTE. IMPREDECIBLE. INDISPENSABLE.</span>
        <h1>
          El Balonazo<span>®</span>
        </h1>
        <p>Mucho fútbol. Poco filtro.</p>
      </header>
      <div className="newspaper-toolbar">
        <GameSelect
          aria-label="Edición del periódico"
          value={edition}
          onChange={(e) => setEdition(e.target.value)}
        >
          {editions.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </GameSelect>
        <GameSelect
          aria-label="Sección del periódico"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option>Todo</option>
          {[...new Set(state.news.map((n) => n.category))].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </GameSelect>
      </div>
      {lead ? (
        <>
          <article className="lead-story">
            <span className="news-category">{lead.category.toUpperCase()} / LA PORTADA</span>
            <h2>
              <button className="article-title" onClick={() => setArticleId(lead.id)}>
                {lead.title}
              </button>
            </h2>
            <p className="lead-subtitle">{lead.subtitle}</p>
            <div className="editorial-illustration">
              <img
                src="/art/v03/ground.webp"
                alt="Ilustración original de la ciudad deportiva y su estadio al atardecer"
                loading="lazy"
              />
              <span>EL FÚTBOL SE VIVE. LA HISTORIA SE CUENTA.</span>
            </div>
            {lead.clubId && (
              <Link to={`/museum/${lead.clubId}`} className="text-link">
                Ver el club protagonista <ArrowRight size={14} />
              </Link>
            )}
          </article>
          <div className="newspaper-rule">
            <Star size={12} />
            <span>EL RESTO DE LA JORNADA</span>
            <Star size={12} />
          </div>
          {stories.slice(1).map((n) => (
            <article className="newspaper-story" key={n.id}>
              <span className="news-category">{n.category}</span>
              <h3>
                <button className="article-title" onClick={() => setArticleId(n.id)}>
                  {n.title}
                </button>
              </h3>
              <p>{n.subtitle}</p>
              <small>
                {new Date(n.at).toLocaleTimeString('es-ES', {
                  timeZone: 'Europe/Madrid',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {n.clubId && (
                  <>
                    {' '}
                    · <Link to={`/museum/${n.clubId}`}>Ver club</Link>
                  </>
                )}
              </small>
            </article>
          ))}
        </>
      ) : (
        <Empty title="Esta sección aún no tiene noticias" />
      )}
      <aside className="editorial-opinion">
        <svg
          viewBox="0 0 768 341.333"
          role="img"
          aria-label="Redacción ilustrada de El Balonazo con periodistas ficticios"
        >
          <image
            href="/art/interiors-atlas.webp"
            x="0"
            y={-2 * 341.333}
            width="1536"
            height="1024"
          />
        </svg>
        <div>
          <span className="news-category">OPINIÓN SATÍRICA · LA REDACCIÓN</span>
          <h3>El proyecto a largo plazo</h3>
          <p>
            En el fútbol, un proyecto a largo plazo dura exactamente hasta el próximo cierre de
            mercado. Lo demás son ruedas de prensa.
          </p>
          <small>Columna de ficción. No representa un acontecimiento de la partida.</small>
        </div>
      </aside>
      {article && (
        <div className="modal-backdrop" onClick={() => setArticleId(null)}>
          <article
            className="modal newspaper-article"
            role="dialog"
            aria-modal="true"
            aria-label={article.title}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Cerrar artículo"
              onClick={() => setArticleId(null)}
            >
              <X size={20} />
            </button>
            <Badge kind="gold">{article.category}</Badge>
            <h2>{article.title}</h2>
            <p>{article.subtitle}</p>
            {article.playerId && state.players.some((p) => p.id === article.playerId) && (
              <PlayerRow player={state.players.find((p) => p.id === article.playerId)!} />
            )}
            <p className="hint">
              La Redacción ·{' '}
              {new Date(article.at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}
            </p>
            {article.clubId && (
              <Link
                className="button secondary"
                to={`/museum/${article.clubId}`}
                onClick={() => setArticleId(null)}
              >
                El club protagonista →
              </Link>
            )}
            <p className="source-note">
              Esta noticia procede del registro de acontecimientos de tu liga. Las identidades
              institucionales y la prensa del juego son de ficción.
            </p>
          </article>
        </div>
      )}
      {chatOpen && (
        <div className="modal-backdrop newspaper-chat-backdrop" onClick={() => setChatOpen(false)}>
          <section
            className="modal newspaper-chat-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Chat de la liga"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Cerrar chat"
              onClick={() => setChatOpen(false)}
            >
              <X />
            </button>
            <h2>El vestuario</h2>
            <ChatPanel embedded />
          </section>
        </div>
      )}
      <footer className="newspaper-bottom">
        Todos los artículos nacen del registro de esta partida.
        <br />
        {BRAND.name} · Prensa deportiva de ficción
      </footer>
    </div>
  );
}
export function ChatPage() {
  return <ChatPanel />;
}
function ChatPanel({ embedded = false }: { embedded?: boolean }) {
  const { state, club, act, admin } = useGame();
  const draftKey = `monigones-chat-draft:${state.id}:${club.id}`;
  const [message, setMessage] = useState(() => sessionStorage.getItem(draftKey) || '');
  useEffect(() => {
    if (message) sessionStorage.setItem(draftKey, message);
    else sessionStorage.removeItem(draftKey);
  }, [message, draftKey]);
  const end = useRef<HTMLDivElement>(null),
    list = useRef<HTMLDivElement>(null),
    nearBottom = useRef(true);
  const [reading, setReading] = useState(true);
  useEffect(() => {
    if (nearBottom.current) {
      const el = list.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [state.chat.length]);
  return (
    <section className={`chat-shell ${embedded ? 'embedded-chat' : 'full-chat'}`}>
      <UnsavedChanges dirty={!!message.trim()} label="Mensaje sin enviar" />
      {reading && <ReadAttention to="/chat" />}
      {!embedded && (
        <PageTitle
          back
          eyebrow="LO QUE PASA EN LA LIGA…"
          title="El vestuario"
          subtitle={`${state.name} · Chat privado de ${state.clubs.length} clubes`}
        />
      )}
      <div className="chat-intro">
        <MessageCircle size={17} />
        El buen pique se juega con respeto.
      </div>
      <div
        className="chat-messages"
        ref={list}
        onScroll={() => {
          const el = list.current!;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
          setReading(nearBottom.current);
        }}
      >
        {state.chat.map((m) => {
          const author = state.clubs.find((c) => c.id === m.clubId);
          return (
            <div key={m.id} className={`chat-message ${m.clubId === club.id ? 'own' : ''}`}>
              <Crest size={25} color={author?.color} />
              <div>
                <span className="chat-author">
                  {author?.presidentName || 'Presidente'} · {author?.name}
                </span>
                <p>{m.text}</p>
                <span className="chat-time">
                  {new Date(m.at).toLocaleTimeString('es-ES', {
                    timeZone: 'Europe/Madrid',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {admin && (
                  <button
                    className="chat-moderate"
                    aria-label="Eliminar mensaje"
                    onClick={() =>
                      void act(
                        { type: 'deleteMessage', id: m.id },
                        'Mensaje eliminado por moderación.',
                      )
                    }
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      {!reading && (
        <button
          className="text-link"
          onClick={() => {
            list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' });
          }}
        >
          Ver mensajes recientes ↓
        </button>
      )}
      <form
        className="chat-compose"
        onSubmit={(e) => {
          e.preventDefault();
          if (message.trim()) {
            void act({ type: 'chat', text: message }, 'Mensaje enviado.').then((ok) => {
              if (ok) setMessage('');
            });
          }
        }}
      >
        <textarea
          rows={1}
          aria-label="Mensaje a la liga"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            e.currentTarget.style.height = 'auto';
            e.currentTarget.style.height = Math.min(112, e.currentTarget.scrollHeight) + 'px';
          }}
          placeholder="Un mensaje para tu liga…"
          maxLength={500}
          required
        />
        <Button type="submit" className="send-button">
          <Send size={20} />
          <span className="sr-only">Enviar mensaje</span>
        </Button>
      </form>
    </section>
  );
}
export function EventsPage() {
  const { state, club, act, eventProgress, admin } = useGame();
  const events = state.events.filter((e) => e.endsAt > state.now);
  return (
    <>
      <PageTitle
        eyebrow="OBJETIVOS DE LA LIGA"
        title="Un paso más allá"
        subtitle="Objetivos activos, progreso y recompensas de la liga."
      />
      <Link to="/draft" className="event-feature">
        <span className="icon-badge gold">
          <Gavel size={25} />
        </span>
        <div>
          <Badge kind="gold">SUBASTA ESPECIAL</Badge>
          <h2>El último en creer, gana.</h2>
          <p>Cada puja cerca del cierre añade 30 segundos.</p>
        </div>
        <ArrowRight size={22} />
      </Link>
      {admin && (
        <div className="padded">
          <Button
            variant="secondary"
            onClick={() =>
              void act({ type: 'specialAuction' }, 'Subasta especial abierta para toda la liga.')
            }
          >
            Abrir subasta especial
          </Button>
        </div>
      )}
      <Section title="Tu próxima recompensa">
        {events.map((e) => {
          const progress = eventProgress[e.id] || 0;
          const claimed = club.eventClaims.includes(e.id);
          return (
            <div className="card event-card" key={e.id}>
              <div className="row spread">
                <span className="icon-badge gold">
                  <Gift size={21} />
                </span>
                <Countdown to={e.endsAt} now={state.now} />
              </div>
              <h2>{e.title}</h2>
              <p>{e.description}</p>
              <Progress value={progress} max={e.goal} />
              <div className="row spread">
                <small>
                  {e.type === 'sport'
                    ? (Math.min(progress, e.goal) / 100).toFixed(2)
                    : Math.min(progress, e.goal)}{' '}
                  / {e.type === 'sport' ? e.goal / 100 : e.goal}
                </small>
                <span className="event-rewards">
                  {shortMoney(e.reward.money)} · {e.reward.development} PD · {e.reward.medals}{' '}
                  medallas
                </span>
              </div>
              <Button
                disabled={claimed || progress < e.goal}
                variant={progress < e.goal ? 'secondary' : ''}
                onClick={() =>
                  void act(
                    { type: 'eventClaim', id: e.id },
                    'Recompensa recibida y registrada en tu museo.',
                  )
                }
              >
                {claimed ? (
                  <>
                    <Check size={16} />
                    Recompensa recibida
                  </>
                ) : progress >= e.goal ? (
                  'Recoger recompensa'
                ) : (
                  'Objetivo en progreso'
                )}
              </Button>
            </div>
          );
        })}
      </Section>
    </>
  );
}
export function DraftPage() {
  const { state, club, act, admin } = useGame();
  const [amount, setAmount] = useState(''),
    [pick, setPick] = useState('');
  const auctions = state.auctions.filter((a) => a.status === 'open');
  const draftActive = state.draft.active;
  return (
    <>
      <PageTitle
        back
        eyebrow="PRESUPUESTO, PULSO Y UN PLAN"
        title={draftActive ? 'La primera gran decisión' : 'Sala de subastas'}
        subtitle={
          draftActive
            ? 'Draft inicial · 100 M€ por club · 12 plazas de plantilla'
            : 'Pujas públicas y adjudicación al finalizar el contador.'
        }
      />
      <div className="draft-budget">
        <span>TU PRESUPUESTO</span>
        <strong>{shortMoney(club.resources.money)}</strong>
        <small>
          {state.contracts.filter((ct) => ct.clubId === club.id).length} / {capacityFor(club)}{' '}
          plazas ocupadas
        </small>
      </div>
      {auctions.length ? (
        auctions.map((a) => {
          const p = state.players.find((p) => p.id === a.playerId)!;
          const minimum = Math.max(p.value, a.highest + euro(100000));
          return (
            <div className="auction-card" key={a.id}>
              <div className="auction-header">
                <Badge kind="gold">
                  {a.kind === 'draft' ? 'DRAFT EN DIRECTO' : 'SUBASTA ESPECIAL'}
                </Badge>
                <Countdown to={a.endsAt} now={state.now} />
              </div>
              <PlayerCard player={p} size="draft" />
              <h2>{p.name}</h2>
              <span>
                {p.position} · VM {shortMoney(p.value)}
              </span>
              <div className="auction-highest">
                <span>
                  {a.clubId
                    ? state.clubs.find((c) => c.id === a.clubId)?.name
                    : 'SIN PUJAS TODAVÍA'}
                </span>
                <strong>{a.highest ? shortMoney(a.highest) : 'Abre la puja'}</strong>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(
                    {
                      type: 'auctionBid',
                      id: a.id,
                      amount: Math.round(Number(amount || minimum / 100) * 100),
                    },
                    'Puja pública aceptada.',
                  );
                  setAmount('');
                }}
              >
                <label>
                  Tu puja (€)
                  <input
                    type="number"
                    min={minimum / 100}
                    step="1000"
                    value={amount || minimum / 100}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </label>
                <Button type="submit">
                  Pujar <Gavel size={18} />
                </Button>
              </form>
              <div className="auction-history">
                {a.bids
                  .toReversed()
                  .slice(0, 10)
                  .map((b, i) => (
                    <div className="definition-row" key={i}>
                      <span>{state.clubs.find((c) => c.id === b.clubId)?.name}</span>
                      <b>{shortMoney(b.amount)}</b>
                    </div>
                  ))}
              </div>
            </div>
          );
        })
      ) : (
        <Empty
          title={draftActive ? 'El escenario está preparado' : 'No hay subastas abiertas'}
          icon={Gavel}
        >
          {draftActive
            ? 'El administrador presenta al próximo futbolista.'
            : 'El administrador puede abrir una subasta especial desde Eventos.'}
        </Empty>
      )}
      {admin && draftActive && (
        <Section title="Mesa del administrador">
          <div className="card">
            <label>
              Orden de presentación
              <GameSelect value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">Siguiente del orden inicial</option>
                {state.draft.queue.slice(0, 100).map((id) => (
                  <option value={id} key={id}>
                    {state.players.find((p) => p.id === id)?.name}
                  </option>
                ))}
              </GameSelect>
            </label>
            <Button
              disabled={auctions.some((a) => a.kind === 'draft')}
              onClick={() =>
                void act(
                  { type: 'nextAuction', playerId: pick || undefined },
                  'Nuevo futbolista presentado. La subasta dura 60 segundos.',
                )
              }
            >
              Presentar futbolista
            </Button>
            <Button
              variant="secondary"
              disabled={auctions.some((a) => a.kind === 'draft')}
              onClick={() =>
                void act(
                  { type: 'finishDraft' },
                  'Draft terminado. Cada club recibe 20 M€ adicionales.',
                )
              }
            >
              Finalizar draft y repartir 20 M€
            </Button>
          </div>
        </Section>
      )}
      <Section title="Presupuestos de la sala">
        <div className="card">
          {state.clubs.map((c) => (
            <div className="definition-row" key={c.id}>
              <span>
                {c.name}
                <small>
                  {state.contracts.filter((ct) => ct.clubId === c.id).length} jugadores
                  {state.contracts.filter((ct) => ct.clubId === c.id).length < 11
                    ? ' · Once incompleto'
                    : ''}
                </small>
              </span>
              <b>{shortMoney(c.resources.money)}</b>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Adjudicaciones">
        <div className="card">
          {state.auctions
            .filter((a) => a.status === 'closed')
            .toReversed()
            .slice(0, 20)
            .map((a) => (
              <div className="definition-row" key={a.id}>
                <span>
                  {state.players.find((p) => p.id === a.playerId)?.name}
                  <small>
                    {a.clubId ? state.clubs.find((c) => c.id === a.clubId)?.name : 'Sin adjudicar'}
                  </small>
                </span>
                <b>{shortMoney(a.highest)}</b>
              </div>
            ))}
        </div>
      </Section>
    </>
  );
}
function capacityFor(c: { facilities: Record<string, number> }) {
  return Math.min(30, 12 + (c.facilities.locker || 0));
}
export function TradesPage() {
  const { state, club, act } = useGame();
  const [counter, setCounter] = useState<Record<string, string>>({});
  const trades = state.negotiations;
  const [reject, setReject] = useState<string | null>(null);
  return (
    <>
      {reject && (
        <Confirm
          title="¿Rechazar esta negociación?"
          confirmLabel="Sí, rechazar propuesta"
          cancelLabel="Seguir negociando"
          onClose={() => setReject(null)}
          onConfirm={() =>
            void act({ type: 'respondTrade', id: reject, accept: false }, 'Propuesta rechazada.')
          }
        >
          <p>
            La propuesta quedará cerrada y no podrás aceptarla después. No pierdes ni recuperas
            dinero: no se había cobrado ningún importe.
          </p>
        </Confirm>
      )}
      <PageTitle
        back
        eyebrow="UN APRETÓN DE MANOS PUEDE CAMBIARLO TODO"
        title="La mesa de negociación"
        subtitle="Traspasos, intercambios, contraofertas y cesiones."
      />
      {trades.length ? (
        <div className="padded">
          {trades.toReversed().map((n) => {
            const incoming = n.to === club.id;
            return (
              <div className="card trade-card" key={n.id}>
                <div className="row spread">
                  <Badge kind="gold">{incoming ? 'RECIBIDA' : 'ENVIADA'}</Badge>
                  <Badge>
                    {
                      {
                        open: 'Abierta',
                        countered: 'Contraoferta',
                        accepted: 'Aceptada',
                        rejected: 'Rechazada',
                      }[n.status]
                    }
                  </Badge>
                </div>
                <h2>{state.players.find((p) => p.id === n.playerId)?.name}</h2>
                <p>
                  {state.clubs.find((c) => c.id === n.from)?.name} →{' '}
                  {state.clubs.find((c) => c.id === n.to)?.name}
                </p>
                <strong>{shortMoney(n.amount)}</strong>
                {n.offeredPlayerId && (
                  <p>
                    + {state.players.find((p) => p.id === n.offeredPlayerId)?.name} en intercambio
                  </p>
                )}
                {n.loanRounds && <p>Cesión de {n.loanRounds} jornadas</p>}
                {incoming && n.status === 'open' && (
                  <>
                    <div className="button-row">
                      <Button variant="secondary" onClick={() => setReject(n.id)}>
                        Rechazar
                      </Button>
                      <Button
                        onClick={() =>
                          void act(
                            { type: 'respondTrade', id: n.id, accept: true },
                            'Acuerdo ejecutado de forma atómica.',
                          )
                        }
                      >
                        Aceptar
                      </Button>
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void act(
                          {
                            type: 'counterTrade',
                            id: n.id,
                            amount: Math.round(Number(counter[n.id]) * 100),
                          },
                          'Contraoferta enviada.',
                        );
                      }}
                    >
                      <label>
                        Contraoferta en euros
                        <input
                          type="number"
                          value={counter[n.id] || ''}
                          min="0"
                          required
                          onChange={(e) => setCounter({ ...counter, [n.id]: e.target.value })}
                        />
                      </label>
                      <Button type="submit" variant="secondary">
                        Proponer importe
                      </Button>
                    </form>
                  </>
                )}
                {!incoming && n.status === 'countered' && (
                  <Button
                    onClick={() =>
                      void act(
                        { type: 'acceptCounter', id: n.id },
                        'Contraoferta aceptada y operación ejecutada.',
                      )
                    }
                  >
                    Aceptar contraoferta
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <Empty title="Un buen acuerdo empieza por una idea" icon={Users}>
          Busca un futbolista rival en el ojeador y envía una propuesta a su presidente.
        </Empty>
      )}
      <div className="padded">
        <Link to="/market" className="button secondary">
          Explorar futbolistas <ArrowRight size={16} />
        </Link>
      </div>
    </>
  );
}
