import { Component, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Download, RefreshCw, Smartphone, X } from 'lucide-react';
import { applyUpdate, subscribeUpdates, updateSnapshot } from '../lib/updates';
import {
  dismissInstallation,
  installEligible,
  installationSnapshot,
  isStandalone,
  mobilePlatform,
  promptInstallation,
  subscribeInstallation,
} from '../lib/install';

/** Keep the update control reachable if a retired lazy asset cannot be loaded. */
export class RouteRecovery extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="empty-state" role="alert">
        <h2>No se ha podido abrir esta sección</h2>
        <p>Comprueba tu conexión. Si hay una nueva versión, puedes actualizar para continuar.</p>
        <button className="button" onClick={() => void applyUpdate()}>
          Recargar el juego
        </button>
      </div>
    );
  }
}

export function UpdateNotice() {
  const available = useSyncExternalStore(subscribeUpdates, updateSnapshot);
  const [busy, setBusy] = useState(false);
  if (!available) return null;
  return (
    <aside className="update-notice" role="status">
      <RefreshCw size={18} />
      <span>Nueva versión disponible</span>
      <button
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void applyUpdate().finally(() => setBusy(false));
        }}
      >
        Actualizar
      </button>
    </aside>
  );
}
export function Installation({ manual = false }: { manual?: boolean }) {
  const { event } = useSyncExternalStore(subscribeInstallation, installationSnapshot);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (manual || !installEligible()) return;
    // Wait for a quiet city screen, never interrupt a text field, auth or another dialog.
    const timer = window.setInterval(() => {
      if (
        document.hidden ||
        !location.pathname.endsWith('/city') ||
        document.querySelector('[role="dialog"]') ||
        document.activeElement?.matches('input,textarea,[contenteditable="true"]')
      )
        return;
      if (installEligible()) setOpen(true);
      window.clearInterval(timer);
    }, 3500);
    return () => clearInterval(timer);
  }, [manual]);
  if (isStandalone()) return manual ? <p>Monigones se está ejecutando como aplicación.</p> : null;
  const close = (never = false) => {
    dismissInstallation(never);
    setOpen(false);
  };
  const ios = mobilePlatform() === 'ios';
  return (
    <>
      {manual && (
        <button className="button secondary" onClick={() => setOpen(true)}>
          <Smartphone size={18} />
          Cómo instalar Monigones
        </button>
      )}
      {open && (
        <div className="modal-backdrop install-backdrop">
          <section
            className="modal install-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-title"
          >
            <button className="modal-close" aria-label="Cerrar instalación" onClick={() => close()}>
              <X />
            </button>
            <img
              className="install-icon"
              src="/icon-192.png"
              alt="Monigones"
              width="64"
              height="64"
            />
            <h2 id="install-title">Instala Monigones en tu móvil</h2>
            <p>
              Disfruta del juego desde tu pantalla de inicio, con una experiencia más cómoda y a
              pantalla completa
            </p>
            <div className="install-benefits">
              Tu escudo en la pantalla de inicio · Más espacio para jugar · Acceso directo a tu club
            </div>
            {ios ? (
              <ol>
                <li>
                  Abre Monigones en Safari
                  {!/Version\/.*Safari/.test(navigator.userAgent)
                    ? ' (si tu navegador no ofrece esta opción)'
                    : ''}
                  .
                </li>
                <li>Pulsa Compartir.</li>
                <li>Selecciona Añadir a pantalla de inicio.</li>
                <li>Activa Abrir como app web si aparece.</li>
                <li>Confirma.</li>
              </ol>
            ) : (
              <p>
                Abre el menú del navegador y selecciona <b>Instalar aplicación</b> o{' '}
                <b>Añadir a pantalla de inicio</b>. El nombre puede variar según el navegador.
              </p>
            )}
            {event && (
              <button
                className="button"
                onClick={() => {
                  setError('');
                  void promptInstallation()
                    .then((outcome) => {
                      if (outcome === 'accepted') close();
                    })
                    .catch(() =>
                      setError(
                        'No se pudo abrir el instalador. Puedes usar el menú del navegador.',
                      ),
                    );
                }}
              >
                <Download size={18} />
                Instalar Monigones
              </button>
            )}
            {error && <p role="alert">{error}</p>}
            <button className="button secondary modal-close-action" onClick={() => close()}>
              Ahora no
            </button>
            <button className="text-link" onClick={() => close(true)}>
              No volver a mostrar
            </button>
          </section>
        </div>
      )}
    </>
  );
}
