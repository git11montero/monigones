import { remainingTime, useServerNow } from './GameClock';
import { Help } from './Help';
import { helpTopic } from '../../shared/help';
import { PlayerPortrait, ClubBadge } from './PlayerPortrait';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Shield,
  LockKeyhole,
  type LucideIcon,
} from 'lucide-react';
import { type ReactNode } from 'react';
import { clubById } from '../../shared/sports';
import { shortMoney } from '../../shared/math';
import type { Player } from '../../shared/types';
import { useGame } from '../lib/api';
export function IconBadge({ icon: Icon, tone = 'green' }: { icon: LucideIcon; tone?: string }) {
  return (
    <span className={`icon-badge ${tone}`}>
      <Icon size={21} />
    </span>
  );
}
export function Section({
  eyebrow,
  title,
  children,
  action,
  to,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  action?: string;
  to?: string;
}) {
  return (
    <section className="section">
      <div className="section-heading">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <div className="heading-help">
            <h2>{title}</h2>
            <Help topic={helpTopic(title)} />
          </div>
        </div>
        {to && (
          <Link to={to} className="text-link">
            {action || 'Ver todo'} <ArrowRight size={15} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
const SCREEN_TITLES: Record<string, string> = {
  'La próxima gran firma': 'Mercado',
  'La ventaja se investiga': 'Investigación',
  'Hoy dejas huella': 'Actividades diarias',
  'La salud de tu club': 'Finanzas',
  'La liga está en juego': 'Clasificación',
  'El club que estás creando': 'Mi club',
  'Ajustes del club': 'Ajustes',
  'Un paso más allá': 'Eventos',
  'La mesa de negociación': 'Negociaciones',
  'Desde la banda': 'Entrenadores',
  'Tu club, al detalle': 'Bonificaciones',
  'Tu once, tu historia': 'Plantilla',
  'Tu equipo, tu idea': 'Plantilla',
  'Juntos, más lejos': 'Patrocinios',
  'Noches para recordar': 'Conciertos',
  'Poder, pactos y palancas': 'Relaciones institucionales',
  'Talento con raíces': 'Cantera',
  'Cada casilla, más fuerte': 'Entrenamiento',
  'Nadie juega solo': 'Afición',
  'Un lugar en la historia': 'Museo del club',
  'La primera gran decisión': 'Draft inicial',
};
export function PageTitle({
  title,
  subtitle,
  back = false,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  back?: boolean;
  action?: ReactNode;
}) {
  const nav = useNavigate();
  return (
    <div className="page-title">
      {back && (
        <button className="back" onClick={() => nav(-1)} aria-label="Volver">
          <ArrowLeft size={20} />
        </button>
      )}
      <div>
        <div className="heading-help">
          <h1>{SCREEN_TITLES[title] || title}</h1>
          <Help topic={helpTopic(title)} />
        </div>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function Button({
  children,
  onClick,
  disabled = false,
  variant = '',
  className = '',
  type = 'button',
  'aria-label': ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: string;
  className?: string;
  type?: 'button' | 'submit';
  'aria-label'?: string;
}) {
  const { busy, online } = useGame();
  return (
    <button
      type={type}
      aria-label={ariaLabel}
      className={`button ${variant} ${className}`}
      disabled={disabled || busy || !online}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
export function Badge({ children, kind = '' }: { children: ReactNode; kind?: string }) {
  return <span className={`badge ${kind}`}>{children}</span>;
}
export function Empty({
  title,
  children,
  icon: Icon = LockKeyhole,
}: {
  title: string;
  children?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="empty-state">
      <Icon size={30} />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
export function Progress({ value, max = 100 }: { value: number; max?: number }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <i style={{ width: `${Math.min(100, Math.max(0, (value / max) * 100))}%` }} />
    </div>
  );
}
export function Countdown({ to, now }: { to: number; now?: number }) {
  const serverNow = useServerNow(now);
  return (
    <span className="countdown">
      <Clock3 size={13} />
      {remainingTime(to, serverNow)}
    </span>
  );
}

export function Crest({
  color = '#bc9a52',
  size = 42,
  label = 'M',
}: {
  color?: string;
  size?: number;
  label?: string;
}) {
  return (
    <svg width={size} height={size * 1.12} viewBox="0 0 54 60" aria-hidden="true">
      <path d="M5 10L27 3 49 10V32Q49 47 27 57Q5 47 5 32Z" fill={color} />
      <path d="M10 14L27 8 44 14V32Q44 44 27 51Q10 44 10 32Z" fill="#102540" />
      <path d="M15 18L27 14 39 18" stroke={color} strokeWidth="1.5" fill="none" />
      <text
        x="27"
        y="37"
        textAnchor="middle"
        fontSize="16"
        fontFamily="system-ui"
        fontWeight="900"
        fill="#ffe7ae"
      >
        {label.slice(0, 2).toUpperCase()}
      </text>
      <path d="M22 43L27 40 32 43 27 47Z" fill={color} />
    </svg>
  );
}

export function PlayerAvatar({ player, size = 58 }: { player: Player; size?: number }) {
  return <PlayerPortrait player={player} size={size} />;
}
export function PlayerRow({
  player,
  aside,
  children,
}: {
  player: Player;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="player-row">
      <Link to={`/player/${player.id}`} className="player-identity">
        <PlayerAvatar player={player} size={43} />
        <div>
          <div className="player-name">{player.name}</div>
          <div className="player-meta">
            <b className={`position ${player.position}`}>{player.position}</b>
            <ClubBadge clubId={player.realClubId} size={17} />
            <span>{clubById(player.realClubId).short}</span>
          </div>
        </div>
      </Link>
      <div className="player-aside">
        {aside || <strong>{shortMoney(player.value)}</strong>}
        {children}
      </div>
    </div>
  );
}
export function Confirm({
  title,
  children,
  onConfirm,
  onClose,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Volver',
  closeOnConfirm = true,
}: {
  closeOnConfirm?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  title: string;
  children: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="modal-handle" />
        <h2>{title}</h2>
        {children}
        <div className="button-row">
          <Button variant="secondary" className="modal-close-action" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              if (closeOnConfirm) onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}
export function Stat({
  label,
  value,
  icon: Icon = Shield,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="stat">
      <Icon size={17} />
      <strong>{value}</strong>
      <span className="heading-help">
        {label}
        <Help topic={helpTopic(label)} />
      </span>
    </div>
  );
}
export function Done() {
  return (
    <span className="done">
      <Check size={14} />
      Completado
    </span>
  );
}
