import { useBlocker } from 'react-router-dom';
import { Confirm } from './ui';
/** Covers internal links, programmatic navigation and the browser Back button. */
export function UnsavedChanges({ dirty, label }: { dirty: boolean; label: string }) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  if (blocker.state !== 'blocked') return null;
  return (
    <Confirm
      title="¿Descartar los cambios sin guardar?"
      confirmLabel="Sí, salir sin guardar"
      cancelLabel="Seguir editando"
      closeOnConfirm={false}
      onClose={() => blocker.reset()}
      onConfirm={() => blocker.proceed()}
    >
      <p>
        {label}. Estos cambios todavía no se han enviado. Si sales, se perderán. No se cobra ni se
        devuelve ningún recurso.
      </p>
    </Confirm>
  );
}
