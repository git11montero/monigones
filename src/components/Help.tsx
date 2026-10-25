import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';
import { HELP, type HelpTopic } from '../../shared/help';
/** A single touch/keyboard interaction shared by every contextual explanation. */
export function Help({ topic }: { topic?: HelpTopic }) {
  const [selected, setSelected] = useState<HelpTopic | null>(null),
    id = useId();
  if (!topic) return null;
  return (
    <>
      <button
        type="button"
        className="help-button"
        aria-label={`Ayuda: ${HELP[topic][0]}`}
        aria-haspopup="dialog"
        onClick={() => setSelected(topic)}
      >
        <Info size={18} />
      </button>
      {selected &&
        createPortal(
          <div className="modal-backdrop help-backdrop" onClick={() => setSelected(null)}>
            <section
              className="modal help-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby={id}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="modal-close"
                aria-label="Cerrar ayuda"
                onClick={() => setSelected(null)}
              >
                <X size={20} />
              </button>
              <h2 id={id}>{HELP[selected][0]}</h2>
              {HELP[selected].slice(1).map((text) => (
                <p key={text}>{text}</p>
              ))}
              <details>
                <summary>Consultar otros conceptos</summary>
                <div className="help-topics">
                  {(Object.keys(HELP) as HelpTopic[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={selected === key}
                      onClick={() => setSelected(key)}
                    >
                      {HELP[key][0]}
                    </button>
                  ))}
                </div>
              </details>
              <button
                type="button"
                className="button secondary modal-close-action"
                onClick={() => setSelected(null)}
              >
                Entendido
              </button>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
