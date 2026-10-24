import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
const Clock = createContext<{ now: number; sampled: number } | null>(null);
let tick = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer)
    timer = setInterval(() => {
      tick++;
      listeners.forEach((fn) => fn());
    }, 1000);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}
/** One UI ticker; elapsed real time is always anchored to the last server snapshot. */
export function GameClock({ now, children }: { now: number; children: ReactNode }) {
  const anchor = useMemo(() => ({ now, sampled: performance.now() }), [now]);
  return <Clock.Provider value={anchor}>{children}</Clock.Provider>;
}
export function useServerNow(fallback?: number) {
  const anchor = useContext(Clock);
  useSyncExternalStore(subscribe, () => tick);
  const local = useMemo(
    () => ({ now: fallback ?? Date.now(), sampled: performance.now() }),
    [fallback],
  );
  const clock = anchor || local;
  return clock.now + Math.max(0, performance.now() - clock.sampled);
}
export function remainingTime(to: number, now: number) {
  const seconds = Math.max(0, Math.floor((to - now) / 1000));
  return `${seconds >= 86400 ? Math.floor(seconds / 86400) + 'd ' : ''}${String(Math.floor(seconds / 3600) % 24).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
