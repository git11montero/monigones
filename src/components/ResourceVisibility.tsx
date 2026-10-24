import { Eye, EyeOff } from 'lucide-react';
import { useGame } from '../lib/api';
import type { ReactNode } from 'react';
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
