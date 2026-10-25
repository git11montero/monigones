import { Eye, EyeOff } from 'lucide-react';
import { Help } from './Help';
import type { HelpTopic } from '../../shared/help';
import { useGame } from '../lib/api';
import type { ReactNode } from 'react';
import { shortMoney } from '../../shared/math';
export function ResourceHelp() {
  const topics: [HelpTopic, string][] = [
    ['money', 'Dinero'],
    ['development', 'Desarrollo'],
    ['medals', 'Medallas'],
    ['fame', 'Fama'],
    ['prestige', 'Prestigio'],
    ['luck', 'Suerte'],
    ['fans', 'Satisfacción'],
  ];
  return (
    <div className="resource-help-strip" aria-label="Ayuda sobre recursos">
      {topics.map(([topic, label]) => (
        <span key={topic}>
          {label}
          <Help topic={topic} />
        </span>
      ))}
    </div>
  );
}
/** Context balances use the same reservation calculation as the authoritative game view. */
export function OperationResources({ development = false }: { development?: boolean }) {
  const { club, available } = useGame();
  return (
    <div className="operation-resources" aria-label="Recursos disponibles">
      <span>
        Disponible: <ResourceAmount>{shortMoney(available)}</ResourceAmount>
      </span>
      <span>
        Reservado: <ResourceAmount>{shortMoney(club.resources.money - available)}</ResourceAmount>
      </span>
      {development && (
        <span>
          Desarrollo:{' '}
          <ResourceAmount>{club.resources.development.toLocaleString('es-ES')}</ResourceAmount> PD
        </span>
      )}
    </div>
  );
}
export function ResourceAmount({ children }: { children: ReactNode }) {
  const { club } = useGame();
  return (
    <span
      className="resource-amount"
      aria-label={club.hideResources ? 'Recurso oculto' : undefined}
    >
      {club.hideResources ? '••••' : children}
    </span>
  );
}
export function ResourceToggle() {
  const { club, act, busy, online } = useGame();
  return (
    <button
      className="audio-toggle"
      aria-label={club.hideResources ? 'Mostrar recursos' : 'Ocultar recursos'}
      aria-pressed={!!club.hideResources}
      disabled={busy || !online}
      onClick={() => void act({ type: 'resourceVisibility', hidden: !club.hideResources }, '')}
    >
      {club.hideResources ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  );
}
