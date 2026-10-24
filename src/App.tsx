import { AttentionBadge, ReadAttention } from './components/Attention';
import { ResourceAmount, ResourceToggle } from './components/ResourceVisibility';
import { BRAND } from '../shared/brand';
import { AudioToggle, DepartmentScene, Experience } from './components/Experience';
import { Suspense, lazy, useEffect } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  Bell,
  Coins,
  Shield,
  Landmark,
  ShoppingBag,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { GameProvider, sessionQuery, useGame } from './lib/api';
import { Crest } from './components/ui';
import { shortMoney } from '../shared/math';
import AuthPage, { OnboardingPage } from './pages/AuthPage';
const MediaCredits = lazy(() => import('./components/MediaCredits'));
const CityPage = lazy(() => import('./pages/CityPage'));
const BuildingsPage = lazy(() => import('./pages/BuildingsPage'));
const ResearchPage = lazy(() => import('./pages/ResearchPage'));
const MarketPage = lazy(() => import('./pages/MarketPage'));
const PlayerPage = lazy(() =>
  import('./pages/MarketPage').then((m) => ({ default: m.PlayerPage })),
);
const SquadPage = lazy(() => import('./pages/SquadPage'));
const LeaguePage = lazy(() => import('./pages/LeaguePage'));
const MatchdayPage = lazy(() =>
  import('./pages/LeaguePage').then((m) => ({ default: m.MatchdayPage })),
);
const MuseumPage = lazy(() =>
  import('./pages/LeaguePage').then((m) => ({ default: m.MuseumPage })),
);
const ArchivePage = lazy(() =>
  import('./pages/LeaguePage').then((m) => ({ default: m.ArchivePage })),
);
const FinancePage = lazy(() => import('./pages/FinancePage'));
const MorePage = lazy(() => import('./pages/SettingsPage'));
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const management = (name: keyof typeof import('./pages/ManagementPages')) =>
  lazy(() => import('./pages/ManagementPages').then((m) => ({ default: m[name] })));
const DailyPage = management('DailyPage'),
  MarketingPage = management('MarketingPage'),
  ConcertsPage = management('ConcertsPage'),
  InstitutionPage = management('InstitutionPage'),
  AcademyPage = management('AcademyPage'),
  TrainingPage = management('TrainingPage'),
  FansPage = management('FansPage'),
  BonusesPage = management('BonusesPage'),
  CoachesPage = management('CoachesPage');
const social = (name: keyof typeof import('./pages/SocialPages')) =>
  lazy(() => import('./pages/SocialPages').then((m) => ({ default: m[name] })));
const NewspaperPage = social('NewspaperPage'),
  ChatPage = social('ChatPage'),
  EventsPage = social('EventsPage'),
  DraftPage = social('DraftPage'),
  TradesPage = social('TradesPage');
function Layout() {
  const { club, state } = useGame();
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);
  useEffect(() => {
    let baseline = window.innerHeight;
    const update = () => {
      const vv = window.visualViewport,
        height = vv?.height || window.innerHeight;
      baseline = Math.max(baseline, window.innerHeight);
      // Keep the compressed layout while focus moves to Send: restoring navigation
      // between pointerdown and click would move the button away from the pointer.
      const composing =
        document.activeElement?.matches('.chat-compose textarea') ||
        (document.querySelector('.chat-compose') &&
          document.documentElement.dataset.keyboard === 'open');
      const keyboard = !!composing && (height < baseline - 100 || height < 550);
      document.documentElement.style.setProperty('--viewport-height', `${height}px`);
      document.documentElement.dataset.keyboard = keyboard ? 'open' : 'closed';
    };
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    update();
    return () => {
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, []);
  const nav = [
    ['/city', 'Ciudad', Landmark],
    ['/squad', 'Equipo', Users],
    ['/market', 'Mercado', ShoppingBag],
    ['/league', 'Liga', Trophy],
    ['/more', 'Mi club', Shield],
  ] as const;
  return (
    <>
      <Experience />
      {!['/newspaper', '/chat', '/market'].includes(location.pathname) && (
        <ReadAttention to={location.pathname} />
      )}
      <header className="app-header">
        <div className="brand-row">
          <Link to="/city" className="brand">
            <Crest size={28} />
            <strong>{BRAND.name}</strong>
          </Link>
          <Link className="header-club" to="/more">
            <span>{club.name}</span>
            <Crest
              size={24}
              color={club.color}
              label={club.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            />
          </Link>
          <AudioToggle />
          <ResourceToggle />
          <Link className="header-notification" to="/newspaper" aria-label="Noticias de la liga">
            <Bell size={20} />
            <AttentionBadge to="/newspaper" />
          </Link>
        </div>
        <div className="resource-bar">
          <Link to="/finance">
            <span className="resource-symbol money">
              <Coins size={16} />
            </span>
            <div>
              <strong>
                <ResourceAmount>{shortMoney(club.resources.money)}</ResourceAmount>
              </strong>
              <span>TESORERÍA</span>
            </div>
          </Link>
          <Link to="/research">
            <span className="resource-symbol development">
              <Zap size={16} />
            </span>
            <div>
              <strong>
                <ResourceAmount>
                  {club.resources.development.toLocaleString('es-ES')}
                </ResourceAmount>
              </strong>
              <span>DESARROLLO</span>
            </div>
          </Link>
          <Link to="/events">
            <span className="resource-symbol medals">
              <Award size={17} />
            </span>
            <div>
              <strong>
                <ResourceAmount>{club.resources.medals}</ResourceAmount>
              </strong>
              <span>MEDALLAS</span>
            </div>
          </Link>
        </div>
      </header>
      <main
        className={location.pathname === '/city' ? 'city-main' : 'interior-main'}
        data-page={location.pathname.split('/')[1]}
        key={location.pathname}
      >
        <DepartmentScene />
        <Suspense
          fallback={
            <div className="route-loading">
              <span className="spinner" />
              Preparando el siguiente capítulo…
            </div>
          }
        >
          <Routes>
            <Route path="/city" element={<CityPage />} />
            <Route path="/media" element={<MediaCredits />} />
            <Route path="/building/:id" element={<BuildingsPage />} />
            <Route path="/research" element={<ResearchPage />} />
            <Route path="/market" element={<MarketPage />} />
            <Route path="/player/:id" element={<PlayerPage />} />
            <Route path="/squad" element={<SquadPage />} />
            <Route path="/league" element={<LeaguePage />} />
            <Route path="/matchday" element={<MatchdayPage />} />
            <Route path="/museum/:clubId?" element={<MuseumPage />} />
            <Route path="/archive" element={<ArchivePage />} />
            <Route path="/finance" element={<FinancePage />} />
            <Route path="/more" element={<MorePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/daily" element={<DailyPage />} />
            <Route path="/marketing" element={<MarketingPage />} />
            <Route path="/concerts" element={<ConcertsPage />} />
            <Route path="/institution" element={<InstitutionPage />} />
            <Route path="/academy" element={<AcademyPage />} />
            <Route path="/training" element={<TrainingPage />} />
            <Route path="/fans" element={<FansPage />} />
            <Route path="/bonuses" element={<BonusesPage />} />
            <Route path="/coaches" element={<CoachesPage />} />
            <Route path="/newspaper" element={<NewspaperPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/draft" element={<DraftPage />} />
            <Route path="/trades" element={<TradesPage />} />
            <Route path="*" element={<Navigate to="/city" replace />} />
          </Routes>
        </Suspense>
      </main>
      <nav className="bottom-nav" aria-label="Navegación principal">
        {nav.map(([to, title, Icon]) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon size={23} />
            <AttentionBadge to={to} />
            <span>{title}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
export default function App() {
  const session = useQuery(sessionQuery());
  return (
    <div className="phone-shell">
      {session.isPending ? (
        <div className="loading-screen">
          <Crest size={70} />
          <h1>{BRAND.name}</h1>
          <p>{BRAND.slogan}</p>
          <div className="loading-bar" />
        </div>
      ) : session.isError ? (
        <div className="empty-state">
          <Crest size={60} />
          <h2>Tu club necesita conectar</h2>
          <p>Revisa tu conexión e inténtalo de nuevo.</p>
          <button className="button" onClick={() => void session.refetch()}>
            Reconectar
          </button>
        </div>
      ) : !session.data?.user ? (
        <AuthPage session={session.data!} />
      ) : !session.data.membership ? (
        <OnboardingPage />
      ) : (
        <GameProvider session={session.data}>
          <Layout />
        </GameProvider>
      )}
    </div>
  );
}
