import { useGame } from '../lib/api';
import { createContext, lazy, Suspense, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { AttentionBadge } from './Attention';
const Panel = lazy(() =>
  import('../pages/SocialPages').then((module) => ({ default: module.ChatPanel })),
);
const Chat = createContext<{ open: boolean; show: () => void; hide: () => void } | null>(null);
export function useLeagueChat() {
  const context = useContext(Chat);
  if (!context) throw Error('Chat fuera del contexto de la liga.');
  return context;
}
export function LeagueChatProvider({ children }: { children: ReactNode }) {
  const { state, club } = useGame();
  const [open, setOpen] = useState(false);
  return (
    <Chat.Provider value={{ open, show: () => setOpen(true), hide: () => setOpen(false) }}>
      {children}
      {open &&
        createPortal(
          <div
            className="modal-backdrop newspaper-chat-backdrop global-chat-backdrop"
            onClick={() => setOpen(false)}
          >
            <section
              className="modal newspaper-chat-panel global-chat-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Chat de la liga"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="modal-close"
                aria-label="Cerrar chat"
                onClick={() => setOpen(false)}
              >
                <X size={20} />
              </button>
              <h2>El vestuario</h2>
              <Suspense fallback={<p role="status">Abriendo el vestuario…</p>}>
                <Panel key={`${state.id}:${club.id}`} embedded />
              </Suspense>
            </section>
          </div>,
          document.body,
        )}
    </Chat.Provider>
  );
}
export function HeaderChat() {
  const { show } = useLeagueChat(),
    location = useLocation();
  return (
    <button
      type="button"
      className="header-chat audio-toggle"
      aria-label="Abrir chat de la liga"
      onClick={() => {
        if (location.pathname === '/chat')
          document.querySelector<HTMLTextAreaElement>('.chat-compose textarea')?.focus();
        else show();
      }}
    >
      <MessageCircle size={20} />
      <AttentionBadge to="/chat" />
    </button>
  );
}
