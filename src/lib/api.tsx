import { emitFeedback, type Sound } from './audio';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Command } from '../../shared/types';
import type { publicState } from '../../shared/engine';
export type Game = ReturnType<typeof publicState>;
export type Session = {
  user: { id: string; email: string; name: string } | null;
  membership: boolean;
  demo: boolean;
  adminTools: boolean;
  authMode: string;
};
const base = import.meta.env.VITE_API_URL || '';
export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(base + path, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const data = await res.json();
  if (!res.ok) throw Error(data.error || 'No se pudo completar la operación.');
  return data;
}
export const post = <T,>(path: string, data: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(data) });
export const sessionQuery = () => ({
  queryKey: ['session'],
  queryFn: async () => {
    try {
      const session = await request<Session>('/api/session');
      sessionStorage.setItem('crown-session', JSON.stringify(session));
      return session;
    } catch (e) {
      const saved = sessionStorage.getItem('crown-session');
      if (saved) return JSON.parse(saved) as Session;
      throw e;
    }
  },
  retry: 1,
});
function saveSnapshot(key: string, data: Game) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* Una caché llena no invalida la respuesta del servidor. */
  }
}
interface GameContextValue extends Game {
  club: Game['state']['clubs'][number];
  act: (cmd: Command, message?: string) => Promise<boolean>;
  busy: boolean;
  online: boolean;
  toast: (text: string) => void;
  session: Session;
}
const Context = createContext<GameContextValue | null>(null);
export const useGame = () => {
  const c = useContext(Context);
  if (!c) throw Error('Partida no cargada.');
  return c;
};
export function GameProvider({ session, children }: { session: Session; children: ReactNode }) {
  const qc = useQueryClient();
  const [online, setOnline] = useState(navigator.onLine),
    [notice, setNotice] = useState('');
  const key = `crown-snapshot-${session.user!.id}`;
  const query = useQuery({
    queryKey: ['game', session.user!.id],
    queryFn: async () => {
      try {
        const result = await request<Game>('/api/state');
        saveSnapshot(key, result);
        setOnline(true);
        return result;
      } catch (e) {
        setOnline(false);
        const cached = localStorage.getItem(key);
        if (cached) return JSON.parse(cached) as Game;
        throw e;
      }
    },
    refetchInterval: 15000,
    retry: 1,
  });
  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void query.refetch();
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    const es = new EventSource(base + '/api/events', { withCredentials: true });
    es.addEventListener('change', () => {
      void query.refetch();
    });
    es.onerror = () => {
      if (!navigator.onLine) setOnline(false);
    };
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      es.close();
    };
  }, [session.user!.id]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  const pending = useRef(new Map<string, string>());
  const mutation = useMutation({
    mutationFn: async (cmd: Command) => {
      if (!navigator.onLine || !online) throw Error('Sin conexión. La acción no se ha enviado.');
      const encoded = JSON.stringify(cmd);
      const key =
        pending.current.get(encoded) ||
        (crypto.randomUUID
          ? crypto.randomUUID()
          : Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
              n.toString(16).padStart(2, '0'),
            ).join(''));
      pending.current.set(encoded, key);
      const result = await request<Game>('/api/command', {
        method: 'POST',
        body: encoded,
        headers: { 'Idempotency-Key': key },
      });
      pending.current.delete(encoded);
      return result;
    },
    onSuccess: (data) => {
      qc.setQueryData<Game>(['game', session.user!.id], (current) =>
        current && current.state.version > data.state.version ? current : data,
      );
      saveSnapshot(key, data);
    },
  });
  async function act(cmd: Command, message = 'Operación completada') {
    try {
      await mutation.mutateAsync(cmd);
      if (message) setNotice(message);
      const sounds: Record<string, Sound> = {
        build: 'construction',
        facility: 'construction',
        research: 'research',
        daily: 'reward',
        eventClaim: 'reward',
        sell: 'coins',
        bid: 'notification',
        sponsor: 'sponsor',
        concert: 'concert',
        institution: 'notification',
        academy: 'construction',
        quality: 'level',
        manualSub: 'substitution',
        coach: 'transfer',
      };
      if (sounds[cmd.type]) emitFeedback(sounds[cmd.type], message);
      return true;
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : 'No se pudo confirmar. Actualiza antes de reintentar.',
      );
      return false;
    }
  }
  if (query.isPending)
    return (
      <div className="loading-screen">
        <div className="loading-crown">⚽</div>
        <h2>Preparando tu club</h2>
        <p>El próximo capítulo empieza aquí.</p>
        <div className="loading-bar" />
      </div>
    );
  if (query.isError || !query.data)
    return (
      <div className="empty-state">
        <h2>No podemos conectar con tu club</h2>
        <p>{String(query.error)}</p>
        <button className="button" onClick={() => void query.refetch()}>
          Volver a conectar
        </button>
      </div>
    );
  const data = query.data,
    club = data.state.clubs.find((c) => c.id === data.clubId)!;
  return (
    <Context.Provider
      value={{
        ...data,
        club,
        act,
        busy: mutation.isPending && mutation.variables?.type !== 'notificationRead',
        online,
        toast: setNotice,
        session,
      }}
    >
      {!online && (
        <div role="status" className="offline-banner">
          Sin conexión · Consultando la última copia. Las operaciones están desactivadas.
        </div>
      )}
      {children}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </Context.Provider>
  );
}
