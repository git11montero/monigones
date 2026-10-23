import { BuildingArt } from '../components/City';
import { useState } from 'react';
import { Check, FlaskConical, LockKeyhole, X } from 'lucide-react';
import { RESEARCH, BUILDINGS } from '../../shared/config';
import { jobQuote } from '../../shared/engine';
import { shortMoney } from '../../shared/math';
import type { ResearchDef, Tree } from '../../shared/types';
import { useGame } from '../lib/api';
import { Badge, Button, Countdown, PageTitle } from '../components/ui';
const branches: Record<Tree, string[]> = {
  Finanzas: ['Tesorería', 'Negocios', 'Infraestructura'],
  Competición: ['Rendimiento', 'Plantilla', 'Preparación'],
  Relaciones: ['Comunicación', 'Afición', 'Influencia'],
};
const effectText: Record<string, string> = {
  salary: 'Reducción salarial (puntos básicos)',
  sale: 'Mejora venta (puntos básicos)',
  sport: 'Bonificación deportiva (puntos básicos)',
  sponsor: 'Rendimiento comercial (puntos básicos)',
  construction: 'Reducción de tiempo (puntos básicos)',
  secondQueue: 'Segunda cola de construcción',
  manual: 'Cambios manuales',
  quality: 'Nivel de calidad',
  fameCap: 'Ampliación de límite de fama',
  prestigeCap: 'Ampliación de límite de prestigio',
  luck: 'Suerte',
  fans: 'Satisfacción',
  happiness: 'Felicidad adicional',
  maintenance: 'Ahorro operativo (puntos básicos)',
  wish: 'Plazas de deseados',
  wishDiscount: 'Devolución de VM (puntos básicos)',
  concerts: 'Acceso a módulo de conciertos',
  custom: 'Personalización del escudo',
  kits: 'Equipaciones especiales',
};
export default function ResearchPage() {
  const { club, state, act } = useGame();
  const [tree, setTree] = useState<Tree>('Finanzas'),
    [branch, setBranch] = useState(0),
    [selected, setSelected] = useState<ResearchDef | null>(null);
  const active = state.jobs.find((j) => j.clubId === club.id && j.kind === 'research'),
    done = RESEARCH.filter((r) => club.research[r.id] > 0).length;
  let quote: ReturnType<typeof jobQuote> | undefined,
    error = '';
  if (selected)
    try {
      quote = jobQuote(club, 'research', selected.id);
    } catch (e) {
      error = (e as Error).message;
    }
  const depend = (id: string) => {
    const r = RESEARCH.find((r) => r.id === id)!;
    setTree(r.tree);
    setBranch(r.branch);
    setSelected(r);
  };
  return (
    <>
      <PageTitle
        eyebrow="CONOCIMIENTO QUE DA VICTORIAS"
        title="La ventaja se investiga"
        subtitle={`${done} de ${RESEARCH.length} tecnologías desarrolladas. Una investigación simultánea.`}
      />
      <div className="research-summary">
        <span className="icon-badge gold">
          <FlaskConical size={24} />
        </span>
        <div>
          <b>
            {active ? RESEARCH.find((r) => r.id === active.target)?.name : 'Tu próxima gran idea'}
          </b>
          <p>
            {active ? (
              <Countdown to={active.endsAt} now={state.now} />
            ) : (
              `${club.resources.development} PD · Centro Nv. ${club.buildings.research}`
            )}
          </p>
        </div>
      </div>
      <div className="segmented padded-segment">
        {(['Finanzas', 'Competición', 'Relaciones'] as Tree[]).map((t) => (
          <button
            key={t}
            className={tree === t ? 'active' : ''}
            onClick={() => {
              setTree(t);
              setBranch(0);
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="research-branch-head" aria-label="Ramas de investigación">
        {branches[tree].map((b, i) => (
          <button key={b} className={branch === i ? 'active' : ''} onClick={() => setBranch(i)}>
            {b}
          </button>
        ))}
      </div>
      <div className="research-tree">
        <div className="research-chapter">
          CAPÍTULO {branch + 1} · {branches[tree][branch].toUpperCase()}
        </div>
        <div className="research-branch">
          {RESEARCH.filter((r) => r.tree === tree && r.branch === branch).map((r) => {
            const level = club.research[r.id] || 0,
              isActive = active?.target === r.id,
              available =
                r.requires.every((id) => club.research[id] > 0) &&
                club.buildings.research >= r.buildingLevel;
            const status = isActive
              ? 'in-progress'
              : level >= r.maxLevel
                ? 'complete'
                : available
                  ? 'available'
                  : 'locked';
            let q: ReturnType<typeof jobQuote> | undefined;
            try {
              q = jobQuote(club, 'research', r.id);
            } catch {
              /* Se detalla el requisito, sin inventar una cotización válida. */
            }
            return (
              <div className="research-node-wrap" key={r.id}>
                <button className={`research-node ${status}`} onClick={() => setSelected(r)}>
                  <span className="node-symbol">
                    <BuildingArt
                      building={BUILDINGS.find(
                        (b) =>
                          b.id ===
                          (tree === 'Finanzas'
                            ? 'finance'
                            : tree === 'Competición'
                              ? 'training'
                              : 'social'),
                      )!}
                      level={Math.min(5, r.row + 1)}
                    />
                  </span>
                  <span className="research-copy">
                    <b>{r.name}</b>
                    <small>{r.description}</small>
                    <span className="research-state">
                      {isActive
                        ? 'EN CURSO'
                        : level >= r.maxLevel
                          ? 'MÁXIMO NIVEL'
                          : available
                            ? level
                              ? 'COMPLETADA · MEJORABLE'
                              : 'DISPONIBLE'
                            : 'BLOQUEADA'}
                    </span>
                    <small>
                      {q
                        ? `${shortMoney(q.money)} · ${q.development} PD · ${(q.duration / 3600000).toFixed(1)} h`
                        : `Centro Nv. ${r.buildingLevel}${r.requires.length ? ' · ' + r.requires.map((id) => RESEARCH.find((t) => t.id === id)?.name).join(' + ') : ''}`}
                    </small>
                  </span>
                  <small>
                    {level}/{r.maxLevel}
                  </small>
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <div className="page-footnote">
        Las dependencias de otras ramas se conservan. Abre una tecnología para viajar a sus
        requisitos y ver qué desbloquea.
      </div>
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={selected.name}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="modal-handle" />
            <button className="modal-close" onClick={() => setSelected(null)} aria-label="Cerrar">
              <X size={20} />
            </button>
            <Badge kind="gold">
              {selected.tree} · {branches[selected.tree][selected.branch]}
            </Badge>
            <h2>{selected.name}</h2>
            <div className="research-modal-art">
              <BuildingArt
                building={BUILDINGS.find((b) => b.id === 'research')!}
                level={Math.min(5, selected.row + 1)}
              />
            </div>
            <p>{selected.description}</p>
            <ul className="effect-list">
              {Object.entries(selected.effects).map(([key, v]) => (
                <li key={key}>
                  <Check size={14} />
                  <span>
                    {effectText[key]}: <b>+{v}</b> por nivel
                  </span>
                </li>
              ))}
            </ul>
            <div className="requirements">
              <b>Requisitos y dependencias</b>
              <p>Centro de investigación Nv. {selected.buildingLevel}</p>
              {selected.requires.map((id) => (
                <button className="text-link" key={id} onClick={() => depend(id)}>
                  {club.research[id] > 0 ? '✓' : '○'} {RESEARCH.find((r) => r.id === id)?.name} →
                </button>
              ))}
              <p>Desbloquea después:</p>
              {RESEARCH.filter((r) => r.requires.includes(selected.id)).map((r) => (
                <button className="text-link" key={r.id} onClick={() => depend(r.id)}>
                  {r.name} →
                </button>
              ))}
              {!RESEARCH.some((r) => r.requires.includes(selected.id)) && (
                <p>Final de esta línea de investigación.</p>
              )}
            </div>
            {quote ? (
              <>
                <div className="quote">
                  <b>{shortMoney(quote.money)}</b>
                  <span>{quote.development} PD</span>
                  <span>{(quote.duration / 3600000).toFixed(1)} h</span>
                </div>
                <p className="hint">
                  Disponibles: {shortMoney(club.resources.money)} · {club.resources.development} PD
                </p>
                <Button
                  disabled={!!active}
                  onClick={() => {
                    void act({ type: 'research', target: selected.id }, 'Investigación iniciada.');
                    setSelected(null);
                  }}
                >
                  <FlaskConical size={16} />
                  Iniciar investigación
                </Button>
              </>
            ) : (
              <p className="locked-reason">
                <LockKeyhole size={16} />
                {error}
              </p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
export { effectText };
