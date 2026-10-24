import { GameSelect } from '../components/GameSelect';
import { BRAND } from '../../shared/brand';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import { ArrowRight, Shield, Flag, ShieldCheck, Users } from 'lucide-react';
import { post, type Session } from '../lib/api';
import { Crest } from '../components/ui';
import { BuildingArt } from '../components/City';
import { BUILDINGS } from '../../shared/config';
import { REAL_CLUBS } from '../../shared/sports';
export default function AuthPage({ session }: { session: Session }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState('login'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [name, setName] = useState(''),
    [demo, setDemo] = useState('demo1');
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ['session'] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function authenticate() {
    if (session.authMode === 'supabase') {
      const url = import.meta.env.VITE_SUPABASE_URL,
        key = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!url || !key) throw Error('Falta la configuración pública de Supabase.');
      const sb = createClient(url, key);
      if (mode === 'register') {
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (error) throw error;
        if (!data.session)
          throw Error('Cuenta creada. Confirma tu correo antes de iniciar sesión.');
        await post('/api/login', { accessToken: data.session.access_token });
      } else {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await post('/api/login', { accessToken: data.session.access_token });
      }
    } else
      await post(mode === 'register' ? '/api/register' : '/api/login', { email, password, name });
  }
  return (
    <div className="auth-page">
      <div className="auth-top">
        <Crest size={30} />
        <strong>{BRAND.name}</strong>
        <span>FOOTBALL MANAGER</span>
      </div>
      <div className="auth-hero">
        <span className="auth-eyebrow">TU HISTORIA EMPIEZA CON UN BALÓN</span>
        <h1>
          Tu club.
          <br />
          Tu ciudad.
          <br />
          <em>Tu legado.</em>
        </h1>
        <p>{BRAND.slogan}</p>
        <div className="auth-art">
          <span className="auth-orbit orbit-1" />
          <span className="auth-orbit orbit-2" />
          <div className="auth-art-hq">
            <BuildingArt building={BUILDINGS[0]} level={3} />
          </div>
          <div className="auth-art-stadium">
            <BuildingArt building={BUILDINGS[1]} level={3} />
          </div>
          <span className="auth-art-tag">
            <Shield size={14} />
            EL PRÓXIMO GRAN CLUB ES EL TUYO
          </span>
        </div>
      </div>
      <div className="auth-body">
        <div className="auth-intro">
          <h2>
            {mode === 'login'
              ? 'El palco te está esperando.'
              : 'Una nueva historia empieza contigo.'}
          </h2>
          <p>Un fantasy de fútbol. Todo un universo por gestionar.</p>
        </div>
        {session.demo && (
          <div className="demo-access">
            <small>Datos de demostración · resultados y economía de la partida.</small>
            <button
              className="button"
              disabled={busy}
              onClick={() => void run(() => post('/api/demo', { userId: demo }))}
            >
              Entrar a la partida de demostración <ArrowRight size={18} />
            </button>
            <label className="demo-select">
              <Users size={14} />
              <GameSelect
                aria-label="Presidente de demostración"
                value={demo}
                onChange={(e) => setDemo(e.target.value)}
              >
                {[
                  'Real Corona',
                  'Atlético del Barrio',
                  'Deportivo Aurora',
                  'Sporting Oliva',
                  'Unión del Puerto',
                  'Racing Imperial',
                ].map((n, i) => (
                  <option value={`demo${i + 1}`} key={n}>
                    {n}
                    {i === 0 ? ' · Administrador' : ''}
                  </option>
                ))}
              </GameSelect>
            </label>
            <span>Sin registro · Seis clubes · Progreso persistente</span>
          </div>
        )}
        <div className="auth-divider">
          <span>O CREA TU PROPIA LIGA</span>
        </div>
        <div className="segmented">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
            Iniciar sesión
          </button>
          <button
            className={mode === 'register' ? 'active' : ''}
            onClick={() => setMode('register')}
          >
            Crear cuenta
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(authenticate);
          }}
        >
          {mode === 'register' && (
            <label>
              Tu nombre
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
                minLength={2}
              />
            </label>
          )}
          <label>
            Correo electrónico
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="presidente@tuclub.es"
              required
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'register' ? 10 : 1}
              maxLength={128}
              required
            />
          </label>
          <button className="button secondary" disabled={busy} type="submit">
            {busy ? 'Conectando…' : mode === 'login' ? 'Volver a mi club' : 'Crear mi cuenta'}{' '}
            <ArrowRight size={17} />
          </button>
        </form>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="auth-bottom">
          <ShieldCheck size={14} />
          Ligas privadas. Fútbol compartido.
        </div>
      </div>
    </div>
  );
}
export function OnboardingPage() {
  const qc = useQueryClient();
  const [join, setJoin] = useState(false),
    [clubName, setClubName] = useState(''),
    [league, setLeague] = useState(''),
    [invite, setInvite] = useState(''),
    [favorite, setFavorite] = useState('madrid'),
    [color, setColor] = useState('#b99952'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <div className="onboarding">
      <Crest size={67} color={color} />
      <span className="eyebrow">EL PRIMER CAPÍTULO</span>
      <h1>
        Dale un hogar
        <br />a tu ambición.
      </h1>
      <p>Una liga privada. Un club con tu identidad.</p>
      <div className="segmented">
        <button className={!join ? 'active' : ''} onClick={() => setJoin(false)}>
          Crear liga
        </button>
        <button className={join ? 'active' : ''} onClick={() => setJoin(true)}>
          Tengo invitación
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          void post('/api/leagues', {
            clubName,
            name: league,
            invite: join ? invite : undefined,
            favorite,
            color,
          })
            .then(() => qc.invalidateQueries({ queryKey: ['session'] }))
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      >
        {join ? (
          <label>
            Código de invitación
            <input value={invite} onChange={(e) => setInvite(e.target.value)} required />
          </label>
        ) : (
          <label>
            Nombre de la liga
            <input
              value={league}
              onChange={(e) => setLeague(e.target.value)}
              minLength={3}
              maxLength={60}
              placeholder="La liga de los viernes"
              required
            />
          </label>
        )}
        <label>
          Nombre de tu club
          <input
            value={clubName}
            onChange={(e) => setClubName(e.target.value)}
            placeholder="Real Corona"
            minLength={3}
            maxLength={40}
            required
          />
        </label>
        <label>
          Tu color
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
        <label>
          El equipo de tu afición
          <GameSelect value={favorite} onChange={(e) => setFavorite(e.target.value)}>
            {REAL_CLUBS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </GameSelect>
        </label>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <button className="button" disabled={busy} type="submit">
          {busy ? 'Preparando el club…' : join ? 'Entrar a la liga' : 'Fundar mi club'}{' '}
          <Flag size={17} />
        </button>
      </form>
      <p className="hint">
        100 M€ de presupuesto inicial. El administrador invita a los demás presidentes y abre el
        draft.
      </p>
    </div>
  );
}
