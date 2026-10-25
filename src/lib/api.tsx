import { GameClock } from '../components/GameClock';
import { emitFeedback, type Sound } from './audio';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Command } from '../../shared/types';
import type { publicState } from '../../shared/engine';
import { getSupabase, isOnlineBackend, onlineScope } from './supabase';
export type Game = ReturnType<typeof publicState>;
export type Session = {
  user: { id: string; email: string; name: string } | null;
  membership: boolean;
  demo: boolean;
  adminTools: boolean;
  authMode: string;
};
const base = import.meta.env.VITE_API_URL || '';
let lastOnlineGame: { user: string; game: Game } | undefined;
export function clearOnlineCache(user = '') {
  lastOnlineGame = undefined;
  sessionStorage.removeItem(`monigones-session:${onlineScope}`);
  if (user) localStorage.removeItem(`monigones-snapshot:${onlineScope}:${user}`);
}
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (options?.body != null && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');
  let user = '';
  if (isOnlineBackend) {
    const sb = getSupabase()!;
    const { data } = await sb.auth.getSession();
    user = data.session?.user.id || '';
    if (data.session) headers.set('Authorization', `Bearer ${data.session.access_token}`);
    if (path === '/api/state' && lastOnlineGame?.user === user)
      headers.set('If-None-Match', `"${lastOnlineGame.game.state.version}"`);
    if (path === '/api/logout') {
      const { error } = await sb.auth.signOut({ scope: 'local' });
      if (error) throw error;
      clearOnlineCache(user);
      return { ok: true } as T;
    }
  }
  const res = await fetch((isOnlineBackend ? '' : base) + path, {
    ...options,
    credentials: 'include',
    headers,
  });
  if (res.status === 304 && lastOnlineGame?.user === user) {
    const game = {
      ...lastOnlineGame.game,
      state: {
        ...lastOnlineGame.game.state,
        now: Number(res.headers.get('X-Monigones-Time')) || lastOnlineGame.game.state.now,
      },
    };
    lastOnlineGame = { user, game };
    return game as T;
  }
  const raw = await res.text();
  let data: any;
  try {
    data = raw.trim() ? JSON.parse(raw) : undefined;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new ApiError(
      'El servidor devolvió una respuesta JSON inválida.',
      res.ok ? 502 : res.status,
    );
  }
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new ApiError(
      'El servidor devolvió una respuesta vacía o inesperada.',
      res.ok ? 502 : res.status,
    );
  if (!res.ok) throw new ApiError(data.error || 'No se pudo completar la operación.', res.status);
  if (isOnlineBackend && data.state && data.clubId) lastOnlineGame = { user, game: data };
  return data;
}
export const post = <T,>(path: string, data: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(data) });
export const sessionQuery = () => ({
  queryKey: ['session'],
  queryFn: async () => {
    try {
      const session = await request<Session>('/api/session');
      sessionStorage.setItem(
        isOnlineBackend ? `monigones-session:${onlineScope}` : 'crown-session',
        JSON.stringify(session),
      );
      return session;
    } catch (e) {
      if (isOnlineBackend && e instanceof ApiError && e.status === 401) {
        clearOnlineCache();
        await getSupabase()!.auth.signOut({ scope: 'local' });
        return {
          user: null,
          membership: false,
          demo: false,
          adminTools: false,
          authMode: 'supabase',
        } satisfies Session;
      }
      const saved = sessionStorage.getItem(
        isOnlineBackend ? `monigones-session:${onlineScope}` : 'crown-session',
      );
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
  act: (cmd: Command, message?: string, onError?: (message: string) => void) => Promise<boolean>;
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
  const key = isOnlineBackend
    ? `monigones-snapshot:${onlineScope}:${session.user!.id}`
    : `crown-snapshot-${session.user!.id}`;
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
    refetchInterval: isOnlineBackend ? 60000 : 15000,
    retry: 1,
  });
  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void query.refetch();
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    if (isOnlineBackend) {
      const sb = getSupabase()!;
      let channel: ReturnType<typeof sb.channel> | undefined;
      let timer: ReturnType<typeof setTimeout>;
      const leagueId = query.data?.state.id;
      if (leagueId) {
        channel = sb
          .channel(`league:${leagueId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'game_revisions',
              filter: `league_id=eq.${leagueId}`,
            },
            () => {
              clearTimeout(timer);
              timer = setTimeout(() => void query.refetch(), 200);
            },
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') void query.refetch();
          });
      }
      return () => {
        clearTimeout(timer);
        window.removeEventListener('online', update);
        window.removeEventListener('offline', update);
        if (channel) void sb.removeChannel(channel);
      };
    }
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
  }, [session.user!.id, query.data?.state.id]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  const pending = useRef(new Map<string, string>());
  useEffect(() => {
    pending.current.clear();
  }, [query.data?.state.resetId]);
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
        headers: {
          'Idempotency-Key': key,
          'X-Monigones-Generation': query.data?.state.resetId || query.data?.state.id || '',
        },
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
  async function act(
    cmd: Command,
    message = 'Operación completada',
    onError?: (message: string) => void,
  ) {
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
      const message =
        e instanceof Error ? e.message : 'No se pudo confirmar. Actualiza antes de reintentar.';
      setNotice(message);
      onError?.(message);
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
      <GameClock now={data.state.now}>{children}</GameClock>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </Context.Provider>
  );
}
