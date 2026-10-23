import { BRAND } from '../../shared/brand';
import { ExperienceSettings } from '../components/Experience';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Award,
  BookOpen,
  BriefcaseBusiness,
  ChevronRight,
  ClipboardList,
  Coins,
  Copy,
  Download,
  FlaskConical,
  Gavel,
  HeartHandshake,
  LogOut,
  Megaphone,
  MessageCircle,
  Music2,
  Newspaper,
  RotateCcw,
  Scale,
  Settings,
  Shield,
  Sprout,
  Trophy,
  UserRound,
  Users,
} from 'lucide-react';
import { useGame, post } from '../lib/api';
import { Badge, Button, Confirm, Crest, PageTitle, Section } from '../components/ui';
import { COACHES, clubById } from '../../shared/sports';
import { seasonDay } from '../../shared/math';
export default function MorePage() {
  const { club, state } = useGame();
  const links = [
    ['/finance', 'Finanzas y movimientos', Coins],
    ['/research', 'Investigación', FlaskConical],
    ['/daily', 'Decisiones diarias', ClipboardList],
    ['/building/offices', 'Oficinas del club', BriefcaseBusiness],
    ['/marketing', 'Patrocinadores', Megaphone],
    ['/concerts', 'Conciertos', Music2],
    ['/institution', 'Relaciones institucionales', Scale],
    ['/academy', 'Cantera', Sprout],
    ['/training', 'Centro de entrenamiento', Award],
    ['/fans', 'Afición', HeartHandshake],
    ['/coaches', 'Entrenadores', UserRound],
    ['/trades', 'Negociaciones', Users],
    ['/draft', 'Draft y subastas', Gavel],
    ['/newspaper', 'El Balonazo', Newspaper],
    ['/chat', 'Chat de liga', MessageCircle],
    ['/museum', 'Museo del club', Trophy],
    ['/bonuses', 'Auditoría de bonificaciones', Shield],
    ['/archive', 'Archivo de temporadas', BookOpen],
    ['/settings', 'Ajustes y administración', Settings],
  ] as const;
  return (
    <>
      <PageTitle eyebrow="MUCHO MÁS QUE ONCE JUGADORES" title="El club que estás creando" />
      <div className="club-profile">
        <Crest
          size={72}
          color={club.color}
          label={club.name
            .split(' ')
            .map((n) => n[0])
            .join('')}
        />
        <div>
          <Badge kind="gold">PRESIDENTE DEL CLUB</Badge>
          <h2>{club.name}</h2>
          <p>
            {COACHES.find((c) => c.id === club.coach)?.name} · {clubById(club.favorite).short}
          </p>
        </div>
      </div>
      <div className="profile-stats">
        <span>
          <b>{club.resources.fame}</b>Fama
        </span>
        <span>
          <b>{club.resources.prestige}</b>Prestigio
        </span>
        <span>
          <b>{club.resources.fans}%</b>Afición
        </span>
      </div>
      <div className="more-links">
        {links.map(([to, label, Icon]) => (
          <Link to={to} key={to}>
            <span className="more-icon">
              <Icon size={21} />
            </span>
            <span>{label}</span>
            <ChevronRight size={17} />
          </Link>
        ))}
      </div>
      <p className="page-footnote">
        {state.name} · Temporada {state.season} · Día {seasonDay(state)}
      </p>
    </>
  );
}
export function SettingsPage() {
  const { club, state, admin, session, act, toast } = useGame();
  const qc = useQueryClient();
  const [reset, setReset] = useState(false),
    [name, setName] = useState(club.name),
    [color, setColor] = useState(club.color);
  const [install, setInstall] = useState<any>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstall(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  return (
    <>
      <PageTitle back eyebrow="TU PARTIDA, A TU MANERA" title="Ajustes del club" />
      <Section title="Tu experiencia de juego">
        <ExperienceSettings />
        <Link className="card access-link" to="/media">
          Fotografías, emblemas y créditos →
        </Link>
      </Section>
      <Section title="Identidad del club">
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            void act({ type: 'identity', name, color }, 'Identidad actualizada.');
          }}
        >
          <label>
            Nombre del club
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={3}
              maxLength={40}
              required
            />
          </label>
          <label>
            Color del club
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </label>
          <p className="hint">Cambiar la identidad cuesta 100.000 € y reduce 1 punto de fama.</p>
          <Button type="submit">Guardar identidad</Button>
        </form>
      </Section>
      <Section title="Una grada en tu pantalla">
        <div className="card">
          <p>Instala {BRAND.name} para abrir tu club como una aplicación.</p>
          <p>
            <b>Android:</b> menú del navegador → Instalar aplicación.
          </p>
          <p>
            <b>iPhone:</b> Safari → Compartir → Añadir a pantalla de inicio.
          </p>
          <p className="hint">
            Se necesita HTTPS en producción. Sin conexión puedes consultar la última copia; las
            operaciones requieren servidor.
          </p>
          {install && (
            <Button onClick={() => void install.prompt()}>
              <Download size={17} />
              Instalar {BRAND.name}
            </Button>
          )}
        </div>
      </Section>
      {admin && (
        <Section title="Tu liga privada">
          <div className="card">
            <h3>{state.name}</h3>
            <label>
              Código de invitación
              <input value={state.invite} readOnly />
            </label>
            <Button
              variant="secondary"
              onClick={() =>
                void navigator.clipboard
                  .writeText(state.invite)
                  .then(() => toast('Invitación copiada.'))
                  .catch(() => toast('Copia el código que aparece en pantalla.'))
              }
            >
              <Copy size={15} />
              Copiar invitación
            </Button>
            <p className="hint">
              Las invitaciones permiten entrar antes de presentar el primer futbolista del draft.
            </p>
          </div>
        </Section>
      )}
      {admin && session.adminTools && (
        <Section title="Importación deportiva">
          <div className="card">
            <p>
              Importa un catálogo JSON validado. Los datos reales deben indicar fuente. No reemplaza
              futbolistas con contratos activos.
            </p>
            <label>
              Archivo JSON de futbolistas
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    void file.text().then((text) => {
                      try {
                        void act(
                          { type: 'importSports', payload: JSON.parse(text) },
                          'Catálogo importado y sincronización registrada.',
                        );
                      } catch {
                        toast('Archivo JSON inválido.');
                      }
                    });
                }}
              />
            </label>
            <p className="hint">Formato: docs/SPORTS_DATA.md · Ejemplo: data/import-example.json</p>
          </div>
        </Section>
      )}
      {admin && session.adminTools && (
        <Section eyebrow="ENTORNO LOCAL · SOLO ADMINISTRADOR" title="Laboratorio de temporada">
          <div className="card">
            <p>
              Reloj simulado del servidor:{' '}
              <b>{new Date(state.now).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</b>
            </p>
            <div className="admin-grid">
              {[
                ['day', 'Día siguiente'],
                ['market', 'Cerrar mercado'],
                ['jobs', 'Terminar obras e investigación'],
                ['kickoff', 'Iniciar jornada'],
                ['match', 'Finalizar próximo partido'],
                ['round', 'Cerrar jornada'],
                ['week', 'Semana siguiente'],
                ['fifty', 'Avanzar hasta día 51'],
              ].map(([step, label]) => (
                <Button
                  variant="secondary"
                  key={step}
                  onClick={() =>
                    void act(
                      { type: 'advance', step },
                      'Tiempo avanzado. Se han reconciliado los procesos vencidos.',
                    )
                  }
                >
                  {label}
                </Button>
              ))}
            </div>
            <p className="hint">
              Los avances ejecutan las mismas reglas de dominio que las operaciones ordinarias.
              Todos los clubes de la liga comparten este reloj.
            </p>
          </div>
        </Section>
      )}
      {admin && (
        <Section title="Cambio de temporada">
          <div className="card">
            <p>
              Archiva la clasificación, conserva el museo y reinicia dinero, plantilla, recursos,
              ciudad e investigación para todos los clubes. Comienza un nuevo draft.
            </p>
            <Button variant="danger-button" onClick={() => setReset(true)}>
              <RotateCcw size={16} />
              Reiniciar temporada
            </Button>
          </div>
        </Section>
      )}
      <div className="padded">
        <Button
          variant="secondary"
          onClick={() => {
            void post('/api/logout', {}).then(() => {
              sessionStorage.removeItem('crown-session');
              localStorage.removeItem(`crown-snapshot-${session.user!.id}`);
              qc.removeQueries({ queryKey: ['game'] });
              void qc.invalidateQueries({ queryKey: ['session'] });
            });
          }}
        >
          <LogOut size={16} />
          Cerrar sesión
        </Button>
      </div>
      <p className="page-footnote">
        {BRAND.name} · Servidor local persistente
        <br />
        Puntuaciones, calendarios y valores de mercado simulados.
      </p>
      {reset && (
        <Confirm
          title="Abrir una nueva temporada"
          onClose={() => setReset(false)}
          onConfirm={() =>
            void act(
              { type: 'resetSeason' },
              'Nueva temporada abierta. La historia queda en el museo.',
            )
          }
        >
          <p>
            Se reinicia el progreso competitivo de todos los clubes de esta liga. Sus trofeos y la
            clasificación histórica se conservan.
          </p>
        </Confirm>
      )}
    </>
  );
}
