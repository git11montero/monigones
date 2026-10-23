import { BuildingBenefits } from '../components/BuildingBenefits';
import { Facilities } from '../components/Facilities';
import { LEVEL_DESCRIPTIONS } from '../lib/visuals';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Check, Hammer, LockKeyhole, Users } from 'lucide-react';
import { BUILDINGS, MODULES, RESEARCH } from '../../shared/config';
import { jobQuote } from '../../shared/engine';
import { capacity, seasonDay, shortMoney } from '../../shared/math';
import { useGame } from '../lib/api';
import { BuildingArt, WorkQueue } from '../components/City';
import { Badge, Button, Countdown, Empty, PageTitle, Progress, Section } from '../components/ui';
export default function BuildingsPage() {
  const { id } = useParams();
  const { state, club, act } = useGame();
  const b = BUILDINGS.find((b) => b.id === id);
  if (!b) return <Empty title="Edificio no encontrado" />;
  const job = state.jobs.find(
    (j) => j.clubId === club.id && j.kind === 'building' && j.target === b.id,
  );
  let quote: ReturnType<typeof jobQuote> | undefined,
    reason = '';
  try {
    quote = jobQuote(club, 'building', b.id);
  } catch (e) {
    reason = (e as Error).message;
  }
  const routes: Record<string, [string, string][]> = {
    research: [['/research', 'Abrir árboles de investigación']],
    marketing: [['/marketing', 'Gestionar patrocinios']],
    academy: [['/academy', 'Abrir cantera']],
    sport: [
      ['/market', 'Explorar mercado'],
      ['/squad', 'Gestionar plantilla'],
    ],
    training: [['/training', 'Mejorar casillas']],
    shop: [['/finance', 'Consultar ingresos de tienda']],
    finance: [
      ['/finance', 'Finanzas del club'],
      ['/institution', 'Solicitar financiación'],
    ],
    social: [
      ['/fans', 'Consultar afición'],
      ['/daily', 'Actividades diarias'],
    ],
    institution: [['/institution', 'Decisiones institucionales']],
    press: [['/newspaper', 'Leer El Balonazo']],
    museum: [['/museum', 'Entrar al museo']],
    competition: [
      ['/league', 'Ver clasificación'],
      ['/draft', 'Sala de draft'],
      ['/events', 'Eventos de la liga'],
    ],
  };
  return (
    <>
      <PageTitle back eyebrow="CIUDAD DEPORTIVA" title={b.name} subtitle={b.description} />
      <div className="building-showcase">
        <BuildingArt building={b} level={club.buildings[b.id] || 1} constructing={!!job} />
        {b.max > 0 ? (
          <Badge kind="gold">
            NIVEL {club.buildings[b.id]} / {b.max}
          </Badge>
        ) : (
          <Badge>ACCESO INSTITUCIONAL</Badge>
        )}
      </div>
      {b.max > 0 && (
        <Section title="El siguiente paso">
          {job ? (
            <div className="card">
              <div className="row">
                <Hammer size={20} />
                <b>Ampliación en curso</b>
                <Countdown to={job.endsAt} now={state.now} />
              </div>
              <Progress value={state.now - job.startedAt} max={job.endsAt - job.startedAt} />
            </div>
          ) : (
            <div className="card">
              <h3>{quote ? `Evolucionar a nivel ${quote.level}` : 'Desarrollo del edificio'}</h3>
              <p>
                {quote
                  ? 'Cada mejora cambia el edificio de tu ciudad y amplía sus posibilidades.'
                  : reason}
              </p>
              {quote && (
                <>
                  <div className="building-comparison">
                    <div>
                      <span>ACTUAL · NIVEL {club.buildings[b.id]}</span>
                      <BuildingArt building={b} level={club.buildings[b.id]} />
                    </div>
                    <div>
                      <span>SIGUIENTE · NIVEL {quote.level}</span>
                      <BuildingArt building={b} level={quote.level} />
                    </div>
                  </div>
                  <p className="visual-difference">{LEVEL_DESCRIPTIONS[quote.level - 1]}</p>
                  <BuildingBenefits id={b.id} club={club} next={quote.level} />
                  <div className="resource-quote">
                    <span>
                      <b>{shortMoney(quote.money)}</b>Necesarios
                      <small> · tienes {shortMoney(club.resources.money)}</small>
                    </span>
                    <span>
                      <b>{quote.development} PD</b>Necesarios
                      <small> · tienes {club.resources.development}</small>
                    </span>
                    <span>
                      <b>{(quote.duration / 3600000).toFixed(1)} h</b>Duración
                    </span>
                    <span>
                      <b>{b.id === 'hq' ? 'Sede central' : `Sede Nv. ${quote.level}`}</b>Requisito
                    </span>
                  </div>
                  <div className="quote">
                    <b>{shortMoney(quote.money)}</b>
                    <span>{quote.duration / 3600000} horas</span>
                  </div>
                  <Button
                    onClick={() =>
                      void act(
                        { type: 'build', target: b.id },
                        'Construcción iniciada. Se completará en el servidor.',
                      )
                    }
                  >
                    <Hammer size={16} />
                    Comenzar ampliación
                  </Button>
                </>
              )}
            </div>
          )}
        </Section>
      )}
      {b.id === 'hq' && (
        <Section title="Una ciudad con futuro">
          <div className="card">
            <h3>La sede marca el camino</h3>
            <p>
              Los edificios principales pueden alcanzar el nivel {club.buildings.hq}. Mejora la sede
              para abrir la siguiente etapa.
            </p>
            <div className="mini-metrics">
              <span>
                <b>{Object.values(club.buildings).reduce((a, b) => a + b, 0)}</b>Niveles construidos
              </span>
              <span>
                <b>{capacity(club)}</b>Plazas de plantilla
              </span>
            </div>
          </div>
        </Section>
      )}
      {b.id === 'stadium' && (
        <>
          <Section eyebrow="TU ESTADIO POR DENTRO" title="Cada detalle suma">
            <div className="stadium-capacity">
              <Users size={26} />
              <div>
                <strong>
                  {(12000 + (club.facilities.stands || 0) * 8000).toLocaleString('es-ES')}
                </strong>
                <span>Aforo del estadio</span>
              </div>
              <Link to="/matchday">
                Entradas <ArrowRight size={17} />
              </Link>
            </div>
            <Facilities />
          </Section>
        </>
      )}
      {b.id === 'offices' && (
        <Section eyebrow="MÓDULOS INDEPENDIENTES" title="El club, bien gestionado">
          {MODULES.map((m) => {
            const open = club.modules.includes(m.id);
            return (
              <div className="card module-card" key={m.id}>
                <div className="row">
                  <span className={`icon-badge ${open ? '' : 'gray'}`}>
                    {open ? <Check size={20} /> : <LockKeyhole size={19} />}
                  </span>
                  <div className="grow">
                    <h3>{m.name}</h3>
                    <p>
                      {open
                        ? 'Módulo operativo'
                        : m.day > seasonDay(state)
                          ? `Disponible el día ${m.day}`
                          : m.research && !club.research[m.research]
                            ? `Requiere ${RESEARCH.find((r) => r.id === m.research)?.name}`
                            : shortMoney(m.cost)}
                    </p>
                  </div>
                </div>
                {!open && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void act({ type: 'unlockModule', id: m.id }, 'Módulo desbloqueado.')
                    }
                    disabled={
                      seasonDay(state) < m.day || !!(m.research && !club.research[m.research])
                    }
                  >
                    Desbloquear
                  </Button>
                )}
              </div>
            );
          })}
          <div className="link-grid">
            <Link to="/squad">
              Contratos <ArrowRight size={16} />
            </Link>
            <Link to="/trades">
              Negociaciones <ArrowRight size={16} />
            </Link>
            <Link to="/concerts">
              Conciertos <ArrowRight size={16} />
            </Link>
            <Link to="/finance">
              Movimientos <ArrowRight size={16} />
            </Link>
          </div>
        </Section>
      )}
      {(routes[b.id] || []).map(([to, label]) => (
        <div className="padded" key={to}>
          <Link className="card access-link" to={to}>
            <span>{label}</span>
            <ArrowRight size={20} />
          </Link>
        </div>
      ))}
      <div className="padded">
        <WorkQueue />
      </div>
    </>
  );
}
