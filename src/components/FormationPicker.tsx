import { useState } from 'react';
import { Check, ChevronDown, LockKeyhole, X } from 'lucide-react';
import { FORMATION_CATALOG, formationRows, type Formation } from '../../shared/formations';
import { useGame } from '../lib/api';
export function TacticalPreview({ formation }: { formation: Formation }) {
  return (
    <div className="tactical-preview" aria-label={`Vista previa ${formation.id}: once futbolistas`}>
      {formationRows(formation).map((row, i) => (
        <div key={i} className="tactical-row">
          {row.map((index) => (
            <i
              key={index}
              data-position={formation.positions[index]}
              aria-label={formation.positions[index]}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
export function FormationPicker({
  current,
  disabled,
  onApply,
}: {
  current: Formation;
  disabled: boolean;
  onApply: (id: string) => Promise<boolean>;
}) {
  const { club, busy, online } = useGame();
  const [open, setOpen] = useState(false),
    [preview, setPreview] = useState(current);
  const level = club.facilities.pitch || 0,
    allowed = preview.pitch <= level;
  return (
    <>
      <button
        className="formation-trigger"
        aria-label={`Formación ${current.id}`}
        aria-haspopup="dialog"
        disabled={disabled || busy || !online}
        onClick={() => {
          setPreview(current);
          setOpen(true);
        }}
      >
        <span>
          <small>FORMACIÓN</small>
          <b>{current.id}</b>
        </span>
        <ChevronDown size={18} />
      </button>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <section
            className="modal formation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="formation-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Cerrar selector táctico"
              onClick={() => setOpen(false)}
            >
              <X size={20} />
            </button>
            <h2 id="formation-title">Tu dibujo táctico</h2>
            <p>
              Césped nivel {level} · Toca un sistema para verlo. Los bloqueados solo permiten vista
              previa.
            </p>
            <div className="formation-preview-panel">
              <TacticalPreview formation={preview} />
              <div>
                <b>{preview.id}</b>
                <p>{preview.lines.map((line) => `${line.count} ${line.position}`).join(' · ')}</p>
                <span>
                  {allowed ? 'Disponible' : `Bloqueada · requiere césped nivel ${preview.pitch}`}
                </span>
                {preview.pitch === 4 && (
                  <small>Último nivel · sin bonificaciones adicionales</small>
                )}
              </div>
            </div>
            <div className="formation-list" role="group" aria-label="Sistemas tácticos">
              {FORMATION_CATALOG.map((formation) => (
                <button
                  key={formation.id}
                  className={`formation-choice ${formation.pitch > level ? 'locked' : ''}`}
                  aria-pressed={preview.id === formation.id}
                  onClick={() => setPreview(formation)}
                >
                  <b>{formation.id}</b>
                  <span>{formation.pitch === 0 ? 'Inicial' : `Césped ${formation.pitch}`}</span>
                  {formation.pitch > level ? (
                    <LockKeyhole size={15} aria-label="Bloqueada" />
                  ) : current.id === formation.id ? (
                    <Check size={17} aria-label="Seleccionada" />
                  ) : (
                    <span className="formation-ready">Disponible</span>
                  )}
                </button>
              ))}
            </div>
            <div className="formation-apply">
              <p>
                Al aplicar, conservas los titulares compatibles y la calidad de cada casilla. Revisa
                las plazas nuevas.
              </p>
              <button
                className="button"
                disabled={!allowed || disabled || busy || !online || preview.id === current.id}
                onClick={() => {
                  void onApply(preview.id).then((ok) => {
                    if (ok) setOpen(false);
                  });
                }}
              >
                {allowed ? `Aplicar ${preview.id}` : `Requiere césped nivel ${preview.pitch}`}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
