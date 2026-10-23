import { BUILDINGS } from '../../shared/config';
import { BuildingArt } from '../components/City';
import { BRAND } from '../../shared/brand';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Clock3,
  Heart,
  HeartHandshake,
  LockKeyhole,
  Music2,
  Shield,
  Sparkles,
  Sprout,
  Zap,
} from 'lucide-react';
import {
  AD_SLOTS,
  ARTISTS,
  DAY,
  INSTITUTIONS,
  RESEARCH,
  RULES,
  SPONSORS,
} from '../../shared/config';
import { effects } from '../../shared/engine';
import { capacity, shortMoney } from '../../shared/math';
import { COACHES, clubById } from '../../shared/sports';
import { useGame } from '../lib/api';
import { Badge, Button, Confirm, Countdown, PageTitle, Progress, Section } from '../components/ui';
import { effectText } from './ResearchPage';
export function DailyPage() {
  const { daily, club, act, state } = useGame();
  return (
    <>
      <PageTitle
        back
        eyebrow="EL CLUB NUNCA DUERME"
        title="Hoy dejas huella"
        subtitle="Tres historias. Tres oportunidades. Un club más fuerte."
      />
      <div className="daily-progress">
        <span className="icon-badge gold">
          <Zap size={22} />
        </span>
        <div>
          <b>{club.dailyDone.length} de 3 actividades realizadas</b>
          <Progress value={club.dailyDone.length} max={3} />
        </div>
      </div>
      {daily.map((a, i) => (
        <div className="daily-card" key={a.id}>
          <div className={`daily-art daily-art-${i}`}>
            <span className="daily-number">0{i + 1}</span>
            <BuildingArt
              building={BUILDINGS.find((b) => b.id === ['press', 'social', 'academy'][i])!}
              level={club.buildings[['press', 'social', 'academy'][i]] || 1}
            />
            <span className="daily-art-tag">EL FÚTBOL TAMBIÉN ES ESTO</span>
          </div>
          <div className="daily-card-body">
            <Badge kind="gold">ACCIÓN INMEDIATA</Badge>
            <h2>{a.name}</h2>
            <p>{a.story}</p>
            <div className="daily-reward">
              <Sparkles size={16} />
              <b>
                +{a.resource === 'money' ? shortMoney(a.reward) : a.reward}{' '}
                {a.resource === 'fame'
                  ? 'fama'
                  : a.resource === 'fans'
                    ? 'satisfacción'
                    : a.resource === 'development'
                      ? 'PD'
                      : a.resource === 'prestige'
                        ? 'prestigio'
                        : ''}
              </b>
              <span>{a.cost ? shortMoney(a.cost) : 'Sin coste'}</span>
            </div>
            <Button
              disabled={club.dailyDone.includes(a.id)}
              onClick={() =>
                void act(
                  { type: 'daily', id: a.id },
                  'Actividad completada. Tu club sigue creciendo.',
                )
              }
            >
              {club.dailyDone.includes(a.id) ? (
                <>
                  <Check size={17} />
                  Ya forma parte de tu historia
                </>
              ) : (
                'Realizar actividad'
              )}
            </Button>
          </div>
        </div>
      ))}
      <div className="info-note">
        <Clock3 size={16} />
        <p>
          Nuevas decisiones a las 06:00 de Madrid. Dejar actividades pendientes reduce la fama al
          día siguiente. Cada actividad solo puede completarse una vez.
        </p>
      </div>
    </>
  );
}
export function MarketingPage() {
  const { state, club, act } = useGame();
  const [slot, setSlot] = useState('Pecho'),
    [days, setDays] = useState(7);
  return (
    <>
      <PageTitle
        back
        eyebrow="MARCAS QUE CREEN EN TU CLUB"
        title="Juntos, más lejos"
        subtitle="Elige tus socios. Haz crecer tu identidad."
      />
      <div className="sponsor-shirt">
        <svg viewBox="0 0 200 160" aria-hidden="true">
          <path
            d="M55 18L79 9Q100 30 121 9L145 18 185 52 159 78 143 62V152H57V62L41 78 15 52Z"
            fill={club.color}
          />
          <path d="M79 9Q100 39 121 9" stroke="#eee7cb" strokeWidth="7" fill="none" />
          <path d="M92 14V152" stroke="#fff6ce" strokeWidth="3" opacity=".2" />
          <text x="100" y="94" textAnchor="middle" fontSize="20" fontWeight="bold" fill="#fff5d7">
            {SPONSORS.find(
              (s) =>
                s.id ===
                state.sponsors.find(
                  (d) => d.clubId === club.id && d.slot === 'Pecho' && d.endsAt > state.now,
                )?.sponsorId,
            )?.name || 'TU HISTORIA'}
          </text>
          <path d="M75 46l4 4 5 -7 5 7 5 -4 -2 13H77Z" fill="#efe1ab" />
        </svg>
        <Badge kind="gold">
          FAMA {club.resources.fame} / {Math.min(100, 10 + effects(club).fameCap)}
        </Badge>
      </div>
      <Section title="Tus espacios comerciales">
        <div className="card">
          <label>
            Espacio publicitario
            <select value={slot} onChange={(e) => setSlot(e.target.value)}>
              {AD_SLOTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Duración del contrato
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value="7">7 días</option>
              <option value="14">14 días</option>
              <option value="30">30 días</option>
            </select>
          </label>
        </div>
      </Section>
      <Section title="Propuestas sobre la mesa">
        {SPONSORS.map((s) => (
          <div className="card sponsor-card" key={s.id}>
            <div className="sponsor-wordmark" style={{ color: s.color }}>
              {s.name}
            </div>
            <p>{s.tag}</p>
            <div className="mini-metrics">
              <span>
                <b>{shortMoney(s.daily)}</b>Ingresos diarios
              </span>
              <span>
                <b>{shortMoney(s.cost)}</b>Coste de activación
              </span>
            </div>
            <Button
              variant={club.resources.fame < s.fame ? 'secondary' : ''}
              disabled={club.resources.fame < s.fame}
              onClick={() =>
                void act(
                  { type: 'sponsor', id: s.id, slot, days },
                  'Contrato publicitario firmado. Primer pago al próximo cierre diario.',
                )
              }
            >
              {club.resources.fame < s.fame ? (
                <>
                  <LockKeyhole size={15} />
                  Requiere fama {s.fame}
                </>
              ) : (
                'Firmar acuerdo'
              )}
            </Button>
          </div>
        ))}
      </Section>
      <Section title="Acuerdos activos">
        <div className="card">
          {state.sponsors
            .filter((s) => s.clubId === club.id && s.endsAt > state.now)
            .map((s) => (
              <div key={s.id} className="definition-row">
                <span>
                  <b>{SPONSORS.find((x) => x.id === s.sponsorId)?.name}</b>
                  <small>{s.slot}</small>
                </span>
                <Countdown to={s.endsAt} now={state.now} />
              </div>
            ))}
          {!state.sponsors.some((s) => s.clubId === club.id && s.endsAt > state.now) && (
            <p>Tu próxima alianza está por firmar.</p>
          )}
        </div>
      </Section>
    </>
  );
}
export function ConcertsPage() {
  const { state, club, act, concertOffers } = useGame();
  const active = state.concerts.filter((c) => c.clubId === club.id && c.endsAt > state.now);
  return (
    <>
      <PageTitle
        back
        eyebrow="CUANDO EL ESTADIO CAMBIA DE RITMO"
        title="Noches para recordar"
        subtitle="Tres propuestas cada semana. Tu estadio, una noche inolvidable."
      />
      {!club.modules.includes('concerts') && (
        <div className="info-note">
          <LockKeyhole size={18} />
          <p>
            Investiga Promotor de espectáculos y desbloquea el módulo de Conciertos en{' '}
            <Link to="/building/offices">las oficinas</Link>.
          </p>
        </div>
      )}
      <Section title="Esta semana en cartel">
        {concertOffers.map((a, i) => (
          <div className={`concert-card concert-${i}`} key={a.id}>
            <div className="concert-topline">
              {BRAND.name} LIVE <Music2 size={18} />
            </div>
            <div className="concert-decoration">
              <i />
              <i />
              <i />
            </div>
            <span className="concert-kicker">UNA NOCHE. TODO TU ESTADIO.</span>
            <h2>{a.name}</h2>
            <div className="concert-meta">
              <span>ESTADIO NV. {a.level}</span>
              <span>CONTRATO 14 DÍAS</span>
            </div>
            <div className="concert-info">
              <div>
                <b>{shortMoney(a.income)}</b>
                <span>por jornada</span>
              </div>
              <div>
                <b>{shortMoney(a.cost)}</b>
                <span>organización</span>
              </div>
              <div>
                <b>+{a.fans}</b>
                <span>afición</span>
              </div>
            </div>
            <Button
              disabled={
                !club.modules.includes('concerts') ||
                club.buildings.stadium < a.level ||
                active.length > 0
              }
              onClick={() =>
                void act(
                  { type: 'concert', id: a.id },
                  'Concierto contratado. Generará ingresos en las jornadas liquidadas durante su vigencia.',
                )
              }
            >
              Cerrar la fecha <ArrowRight size={17} />
            </Button>
          </div>
        ))}
      </Section>
      <Section title="Tu programación">
        {state.concerts
          .filter((c) => c.clubId === club.id)
          .map((c) => (
            <div className="card" key={c.id}>
              <h3>{ARTISTS.find((a) => a.id === c.artistId)?.name}</h3>
              <p>{shortMoney(c.perRound)} por jornada</p>
              {c.endsAt > state.now ? (
                <Countdown to={c.endsAt} now={state.now} />
              ) : (
                <Badge>Contrato finalizado</Badge>
              )}
            </div>
          ))}
      </Section>
    </>
  );
}
export function InstitutionPage() {
  const { club, state, act } = useGame();
  const [selected, setSelected] = useState<string | null>(null);
  const cooldown = club.lastInstitution + 2 * DAY;
  const action = INSTITUTIONS.find((a) => a.id === selected);
  return (
    <>
      <PageTitle
        back
        eyebrow="EN EL PALCO TAMBIÉN HAY PARTIDO"
        title="Poder, pactos y palancas"
        subtitle="Sátira de ficción: todos los políticos, medios e intermediarios son inventados."
      />
      <div className="institution-banner">
        <span className="icon-badge gold">
          <Shield size={23} />
        </span>
        <div>
          <b>Prestigio {club.resources.prestige}</b>
          <p>
            {cooldown > state.now ? (
              <Countdown to={cooldown} now={state.now} />
            ) : (
              'Tu próxima decisión está disponible'
            )}
          </p>
        </div>
        <Badge>1 CADA 48 H</Badge>
      </div>
      {INSTITUTIONS.map((a) => (
        <div className="institution-card" key={a.id}>
          <div className="row spread">
            <Badge kind={a.risk > 40 ? 'red' : 'green'}>
              {a.risk ? `${a.risk}% RIESGO DE ESCÁNDALO` : 'ACUERDO LEGAL'}
            </Badge>
            {a.money > 0 && <b className="positive">+{shortMoney(a.money)}</b>}
          </div>
          <h2>{a.name}</h2>
          <p>{a.story}</p>
          <div className="institution-effects">
            <span>{a.cost ? `Coste ${shortMoney(a.cost)}` : 'Sin desembolso inicial'}</span>
            <span>
              {a.fame >= 0 ? '+' : ''}
              {a.fame} fama
            </span>
            <span>
              {a.prestige >= 0 ? '+' : ''}
              {a.prestige} prestigio
            </span>
          </div>
          <Button
            variant={a.risk > 40 ? 'secondary' : ''}
            disabled={cooldown > state.now}
            onClick={() => setSelected(a.id)}
          >
            Tomar decisión <ArrowRight size={16} />
          </Button>
        </div>
      ))}
      {action && (
        <Confirm
          title={action.name}
          onClose={() => setSelected(null)}
          onConfirm={() =>
            void act(
              { type: 'institution', id: action.id },
              'Decisión institucional resuelta. Consulta los movimientos y el periódico.',
            )
          }
        >
          <p>{action.story}</p>
          <p>
            {action.risk > 0
              ? `El escándalo tiene una probabilidad del ${action.risk} %. Puede causar multa y pérdida de reputación.`
              : 'El acuerdo y sus condiciones se registrarán en las finanzas del club.'}
          </p>
        </Confirm>
      )}
    </>
  );
}
export function AcademyPage() {
  const { state, club, act } = useGame();
  const job = state.jobs.find((j) => j.clubId === club.id && j.kind === 'academy');
  return (
    <>
      <PageTitle
        back
        eyebrow="EL FUTURO SE ENTRENA AQUÍ"
        title="Talento con raíces"
        subtitle="Un proyecto por semana. Futbolistas ficticios del catálogo local."
      />
      <div className="academy-hero">
        <Sprout size={62} />
        <h2>
          La próxima ilusión
          <br />
          puede nacer en casa.
        </h2>
        <p>Un día de observación para descubrir un jugador joven disponible.</p>
      </div>
      <Section title="Proyecto de formación">
        <div className="card">
          <div className="mini-metrics">
            <span>
              <b>50.000 €</b>Coste de observación
            </span>
            <span>
              <b>24 h</b>Tiempo de trabajo
            </span>
          </div>
          <p>
            Al terminar, el club incorpora un jugador ficticio disponible si tiene plaza y dinero
            para abonar su VM. La observación no garantiza una plaza ni descuenta el fichaje.
          </p>
          <p className="hint">
            Capacidad actual: {state.contracts.filter((ct) => ct.clubId === club.id).length}/
            {capacity(club)}. Formar talento no permite vender por encima del coste de compra.
          </p>
          {job ? (
            <>
              <Badge kind="gold">OJEADORES TRABAJANDO</Badge>
              <p>
                <Countdown to={job.endsAt} now={state.now} />
              </p>
            </>
          ) : (
            <Button onClick={() => void act({ type: 'academy' }, 'Proyecto de cantera iniciado.')}>
              Abrir proyecto <Sprout size={17} />
            </Button>
          )}
        </div>
      </Section>
    </>
  );
}
export function TrainingPage() {
  const { club, act } = useGame();
  return (
    <>
      <PageTitle
        back
        eyebrow="MEJORAR EL EQUIPO EMPIEZA POR EL CAMPO"
        title="Cada casilla, más fuerte"
        subtitle="La calidad pertenece a la posición, y permanece cuando cambias de futbolista."
      />
      <div className="quality-legend">
        {['Básico', 'Bronce', 'Plata', 'Oro'].map((q, i) => (
          <div key={q} className={`quality-badge q-${i}`}>
            <Shield size={24} />
            <b>{q}</b>
            <span>+{RULES.qualityBonus[i] / 100}%</span>
          </div>
        ))}
      </div>
      <div className="padded">
        {club.selection.starters.map((s, i) => (
          <div className="card" key={i}>
            <div className="row spread">
              <h3>
                Casilla {i + 1} · {s.position}
              </h3>
              <Badge kind="gold">{['Básico', 'Bronce', 'Plata', 'Oro'][s.quality]}</Badge>
            </div>
            <p className="hint">
              Desbloqueado: {['Básico', 'Bronce', 'Plata', 'Oro'][s.unlockedQuality]} ·
              Entrenamiento Nv. {club.buildings.training}
            </p>
            <div className="quality-controls">
              {[0, 1, 2, 3].map((level) => (
                <Button
                  key={level}
                  variant={s.quality === level ? 'small' : 'small secondary'}
                  disabled={
                    s.quality === level || club.selection.locked || level > s.unlockedQuality + 1
                  }
                  onClick={() =>
                    void act({ type: 'quality', slot: i, level }, 'Calidad de casilla actualizada.')
                  }
                >
                  {['Base', 'Bronce', 'Plata', 'Oro'][level]}
                </Button>
              ))}
            </div>
            {s.unlockedQuality < 3 && (
              <p className="hint">
                Siguiente nivel: {(s.unlockedQuality + 1) * 2} medallas y{' '}
                {shortMoney((s.unlockedQuality + 1) * 10000000)}. Requiere investigación y edificio.
              </p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
export function FansPage() {
  const { club, state } = useGame();
  return (
    <>
      <PageTitle
        back
        eyebrow="EL ALMA DE TU CLUB"
        title="Nadie juega solo"
        subtitle={`Tu afición apoya al ${clubById(club.favorite).name}.`}
      />
      <div className="fans-hero">
        <Heart size={53} />
        <strong>
          {club.resources.fans}
          <small>%</small>
        </strong>
        <h2>La grada está contigo.</h2>
        <p>Cada fichaje, cada actividad y cada decisión deja huella.</p>
        <Progress value={club.resources.fans} />
      </div>
      <Section title="Cuatro formas de crecer">
        <div className="card">
          {[
            ['Fama', club.resources.fame, 'Influye en fichajes, ocupación y patrocinadores.'],
            [
              'Prestigio',
              club.resources.prestige,
              'Abre relaciones institucionales a partir de 20.',
            ],
            ['Suerte', club.resources.luck, 'Un apoyo pequeño fuera del marcador.'],
            [
              'Satisfacción',
              club.resources.fans,
              'Mejora asistencia y merchandising, sin dar fama.',
            ],
          ].map(([label, value, text]) => (
            <div className="attribute-row" key={label}>
              <div>
                <b>{label}</b>
                <strong>{value}/100</strong>
              </div>
              <Progress value={Number(value)} />
              <p>{text}</p>
            </div>
          ))}
        </div>
        <Link to="/daily" className="button">
          Encuentra a tu afición <HeartHandshake size={18} />
        </Link>
      </Section>
    </>
  );
}
export function BonusesPage() {
  const { club, effects: ef } = useGame();
  return (
    <>
      <PageTitle
        back
        eyebrow="NINGUNA VENTAJA SIN EXPLICACIÓN"
        title="Tu club, al detalle"
        subtitle="Auditoría de efectos activos y límites globales."
      />
      <div className="bonus-summary">
        <b>+{ef.sport / 100}%</b>
        <span>Bonificación deportiva adicional</span>
        <Progress value={ef.sport} max={2500} />
        <small>Límite adicional: 25 % · Calidad de casilla: hasta 25 % · Total: 50 %</small>
      </div>
      <Section title="Origen de las ventajas">
        <div className="card">
          <div className="definition-row">
            <span>Entrenador · {COACHES.find((c) => c.id === club.coach)?.name}</span>
            <b>+{(COACHES.find((c) => c.id === club.coach)?.sportBonus || 0) / 100}%</b>
          </div>
          {RESEARCH.filter((r) => club.research[r.id]).map((r) => (
            <div className="bonus-source" key={r.id}>
              <h3>
                {r.name} · Nv. {club.research[r.id]}
              </h3>
              {Object.entries(r.effects).map(([k, v]) => (
                <p key={k}>
                  {effectText[k]}: <b>+{Number(v) * club.research[r.id]}</b>
                </p>
              ))}
              <Badge>Vigente hasta fin de temporada</Badge>
            </div>
          ))}
          {!Object.keys(club.research).length && (
            <p>
              Aún no hay tecnologías completadas. Tu próxima ventaja empieza en el centro de
              investigación.
            </p>
          )}
        </div>
      </Section>
      <Section title="Límites aplicados">
        <div className="card">
          {[
            ['Reducción salarial', `${ef.salary / 100} / 1,5 pp`],
            ['Venta al mercado', `${85 + ef.sale / 100} / 100 % VM`],
            ['Cambios manuales', `${ef.manual} / 2`],
            ['Lista de deseados', `${ef.wish} / 5`],
            ['Descuento deseados', `${ef.wishDiscount / 100} / 2,5 % VM`],
            ['Colas de construcción', ef.secondQueue ? 2 : 1],
            ['Pérdida de tiempo de obra', `${ef.construction / 100} / 30 %`],
          ].map(([k, v]) => (
            <div className="definition-row" key={k}>
              <span>{k}</span>
              <b>{v}</b>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
export function CoachesPage() {
  const { club, act } = useGame();
  return (
    <>
      <PageTitle
        back
        eyebrow="UNA IDEA, UN LÍDER"
        title="Desde la banda"
        subtitle="Los entrenadores se obtienen mediante objetivos de eventos. Sin rarezas ni categorías."
      />
      {COACHES.map((c) => (
        <div className="card coach-card" key={c.id}>
          <div className="coach-portrait">
            <svg width="110" height="120" viewBox="0 0 110 120" aria-hidden="true">
              <path d="M8 120V94Q10 72 39 69H71Q101 72 102 94V120" fill="#294e40" />
              <path d="M44 65V76L55 91 66 76V65" fill="#d6ab86" />
              <rect x="33" y="21" width="44" height="50" rx="20" fill="#d6ab86" />
              <path d="M31 41V24Q33 8 55 10Q79 10 79 28V41L72 30 39 27Z" fill="#667067" />
              <path d="M44 77L55 91 48 105 35 78M66 77L55 91 62 105 75 78" fill="#f2efd9" />
              <path d="M55 91V120" stroke="#173d30" strokeWidth="2" />
              <circle cx="44" cy="44" r="2" fill="#3c4033" />
              <circle cx="65" cy="44" r="2" fill="#3c4033" />
              <path d="M47 58Q55 61 63 58" stroke="#7a6751" fill="none" />
            </svg>
          </div>
          <Badge kind={club.coach === c.id ? 'gold' : ''}>
            {club.coach === c.id
              ? 'TU ENTRENADOR'
              : c.id === 'generic'
                ? 'INICIAL'
                : 'RECOMPENSA DE EVENTO'}
          </Badge>
          <h2>{c.name}</h2>
          <p>{c.clubId ? clubById(c.clubId).name : `Entrenador original de ${BRAND.name}`}</p>
          <strong>+{c.sportBonus / 100}% deportivo simulado</strong>
          {(club.coachInventory || ['generic', club.coach]).includes(c.id) && (
            <Button
              variant="secondary"
              disabled={club.coach === c.id}
              onClick={() => void act({ type: 'coach', id: c.id }, 'Entrenador seleccionado.')}
            >
              {club.coach === c.id ? 'Dirigiendo al equipo' : 'Elegir entrenador'}
            </Button>
          )}
          {c.source && (
            <a href={c.source} target="_blank" rel="noreferrer" className="text-link">
              Fuente de identidad
            </a>
          )}
        </div>
      ))}
    </>
  );
}
