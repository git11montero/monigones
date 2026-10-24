import { useEffect, useRef } from 'react';
import { pendingAttention } from '../../shared/attention';
import { useGame } from '../lib/api';
/** Mounted inside an access, so it follows map transforms and never intercepts input. */
export function AttentionBadge({ to, dot = false }: { to: string; dot?: boolean }) {
  const { notifications = [] } = useGame(),
    items = pendingAttention(notifications, to),
    count = items.reduce((a, n) => a + n.count, 0);
  if (!count) return null;
  return (
    <span
      className={`attention-badge ${dot ? 'dot' : ''} ${items.some((x) => x.priority === 'important') ? 'important' : ''}`}
      aria-label={`${count} avisos pendientes`}
      key={items.map((n) => n.id).join(',')}
    >
      {dot ? '' : count > 9 ? '9+' : count}
    </span>
  );
}
/** Only acknowledges the IDs that were actually displayed; a concurrent event is never consumed. */
export function ReadAttention({ to, only }: { to: string; only?: string[] }) {
  const { notifications = [], act, online } = useGame(),
    sent = useRef('');
  const ids = notifications
      .filter(
        (n) =>
          n.destination === to &&
          (!only || only.includes(n.id)) &&
          !n.read &&
          n.mode === 'information',
      )
      .map((n) => n.id)
      .sort(),
    key = ids.join('|');
  useEffect(() => {
    if (!key || !online || sent.current === key || document.visibilityState === 'hidden') return;
    const timer = setTimeout(() => {
      sent.current = key;
      void act({ type: 'notificationRead', ids }, '').then((ok) => {
        if (!ok) sent.current = '';
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [key, online, to]);
  return null;
}
