import { GameSelect } from './GameSelect';
import { shortMoney } from '../../shared/math';
import { useDialogAccessibility } from '../lib/dialogs';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLocation } from 'react-router-dom';
import { Music2, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { useGame } from '../lib/api';
import {
  audioManager,
  readPreferences,
  savePreferences,
  type Preferences,
  type Sound,
} from '../lib/audio';
import { cityEnvironment } from '../lib/visuals';

export function DepartmentScene() {
  return null;
}
export function AudioToggle() {
  const [prefs, setPrefs] = useState(readPreferences);
  useEffect(() => {
    const fn = () => setPrefs(readPreferences());
    window.addEventListener('monigones:preferences', fn);
    return () => window.removeEventListener('monigones:preferences', fn);
  }, []);
  return (
    <button
      className="audio-toggle"
      aria-label={prefs.music ? 'Silenciar música' : 'Activar música'}
      aria-pressed={prefs.music}
      onClick={() => {
        void audioManager.unlock();
        savePreferences({ ...prefs, music: !prefs.music });
      }}
    >
      {prefs.music ? <Volume2 size={17} /> : <VolumeX size={17} />}
    </button>
  );
}
export function ExperienceSettings() {
  const [p, setP] = useState<Preferences>(readPreferences);
  const update = (patch: Partial<Preferences>) => {
    const next = { ...p, ...patch };
    setP(next);
    savePreferences(next);
  };
  return (
    <div className="card experience-settings">
      <div className="row">
        <Music2 />
        <h3>Música, sonido y calidad gráfica</h3>
      </div>
      <label className="switch-row">
        Música ambiental
        <input
          type="checkbox"
          checked={p.music}
          onChange={(e) => {
            void audioManager.unlock();
            update({ music: e.target.checked });
          }}
        />
      </label>
      <label className="switch-row">
        Efectos sonoros
        <input
          type="checkbox"
          checked={p.effects}
          onChange={(e) => update({ effects: e.target.checked })}
        />
      </label>
      <label>
        Volumen
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(p.volume * 100)}
          onChange={(e) => update({ volume: Number(e.target.value) / 100 })}
        />
      </label>
      <label>
        Calidad gráfica
        <GameSelect
          value={p.quality}
          onChange={(e) => update({ quality: e.target.value as Preferences['quality'] })}
        >
          <option value="high">Alta · máxima resolución</option>
          <option value="medium">Media · resolución equilibrada</option>
          <option value="low">Baja · menor resolución</option>
        </GameSelect>
      </label>
      <label className="switch-row">
        Animaciones de interfaz
        <input
          type="checkbox"
          checked={p.motion}
          onChange={(e) => update({ motion: e.target.checked })}
        />
      </label>
      <p>
        Las preferencias se guardan en este dispositivo. El movimiento reducido del sistema tiene
        prioridad. La música empieza después de tu interacción.
      </p>
      <button
        className="button secondary"
        onClick={() => {
          void audioManager.unlock().then(() => audioManager.play('reward'));
        }}
      >
        Probar efectos
      </button>
    </div>
  );
}
export function Experience() {
  useDialogAccessibility();
  const { state, club, online } = useGame(),
    location = useLocation(),
    previous = useRef(state),
    [feedback, setFeedback] = useState<{ kind: Sound; title?: string; key: number } | null>(null),
    [preferences, setPreferences] = useState(readPreferences),
    [deltas, setDeltas] = useState<{
      money: number;
      development: number;
      medals: number;
      key: number;
    } | null>(null);
  const mode = cityEnvironment(state, club).mode;
  useEffect(() => {
    audioManager.setMode(mode === 'normal' ? 'city' : mode);
  }, [mode]);
  useEffect(() => {
    const prefs = () => setPreferences(readPreferences());
    const event = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setFeedback({ ...detail, key: Date.now() });
    };
    window.addEventListener('monigones:preferences', prefs);
    window.addEventListener('monigones:feedback', event);
    return () => {
      window.removeEventListener('monigones:preferences', prefs);
      window.removeEventListener('monigones:feedback', event);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.motion = preferences.motion ? 'full' : 'reduced';
    document.documentElement.dataset.quality = preferences.quality;
  }, [preferences]);
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 2400);
    return () => clearTimeout(t);
  }, [feedback]);
  useEffect(() => {
    if (!deltas) return;
    const t = setTimeout(() => setDeltas(null), 2100);
    return () => clearTimeout(t);
  }, [deltas]);
  useEffect(() => {
    const prev = previous.current;
    previous.current = state;
    if (!online || prev.id !== state.id) return;
    const prevClub = prev.clubs.find((c) => c.id === club.id);
    if (!prevClub) return;
    const money = club.resources.money - prevClub.resources.money,
      development = club.resources.development - prevClub.resources.development,
      medals = club.resources.medals - prevClub.resources.medals;
    if (money || development || medals) setDeltas({ money, development, medals, key: Date.now() });
    const signing = state.contracts.find(
      (ct) =>
        ct.clubId === club.id &&
        !prev.contracts.some((old) => old.playerId === ct.playerId && old.clubId === club.id),
    );
    if (signing) {
      audioManager.play('transfer');
      setFeedback({
        kind: 'transfer',
        title: `¡${state.players.find((p) => p.id === signing.playerId)?.name} ya es de tu club!`,
        key: Date.now(),
      });
    }
    const scandal = state.news.find(
      (n) =>
        n.clubId === club.id &&
        n.category === 'Escándalos' &&
        !prev.news.some((o) => o.id === n.id),
    );
    if (scandal) {
      audioManager.play('scandal');
      setFeedback({ kind: 'scandal', title: scandal.title, key: Date.now() });
    }

    const complete = prev.jobs.filter(
      (j) =>
        j.clubId === club.id &&
        !state.jobs.some((n) => n.id === j.id) &&
        ((j.kind === 'building' && club.buildings[j.target] > prevClub.buildings[j.target]) ||
          (j.kind === 'research' &&
            (club.research[j.target] || 0) > (prevClub.research[j.target] || 0)) ||
          (j.kind === 'facility' &&
            (club.facilities[j.target] || 0) > (prevClub.facilities[j.target] || 0))),
    );
    if (complete.length) {
      const j = complete[0],
        kind = j.kind === 'research' ? 'research' : 'level';
      audioManager.play(kind);
      setFeedback({
        kind,
        title: j.kind === 'research' ? '¡Investigación completada!' : '¡Tu club sube de nivel!',
        key: Date.now(),
      });
    }
    const oldRound = prev.rounds.find((r) => r.number === state.currentRound),
      round = state.rounds.find((r) => r.number === state.currentRound);
    if (round?.status === 'live' && oldRound?.status === 'upcoming') {
      audioManager.play('stadium');
      setFeedback({ kind: 'stadium', title: '¡Empieza la jornada!', key: Date.now() });
    }
    const previousGoals = Object.values(oldRound?.scores || {}).reduce((n, s) => n + s.goals, 0),
      goals = Object.values(round?.scores || {}).reduce((n, s) => n + s.goals, 0);
    if (round?.status === 'live' && oldRound?.status === 'live' && goals > previousGoals) {
      audioManager.play('goal');
      setFeedback({ kind: 'goal', title: '¡Gol en la jornada!', key: Date.now() });
    }
    const settled = state.rounds.find(
      (r) => r.settled && !prev.rounds.find((o) => o.number === r.number)?.settled,
    );
    if (settled) {
      const ranking = state.clubs.toSorted(
        (a, b) =>
          (settled.reports[b.id]?.points || 0) - (settled.reports[a.id]?.points || 0) ||
          a.id.localeCompare(b.id),
      );
      const won = club.trophies.some(
          (t) =>
            !prevClub.trophies.some((o) => o.id === t.id) &&
            t.title === `Ganador de la jornada ${settled.number}`,
        ),
        kind: Sound = won ? 'victory' : ranking.at(-1)?.id === club.id ? 'defeat' : 'notification';
      audioManager.play(kind);
      setFeedback({
        kind,
        title: won ? '¡La jornada es tuya!' : 'Jornada finalizada · informe disponible',
        key: Date.now(),
      });
    }
  }, [state, club, online]);
  return (
    <>
      <span className="route-announcer" key={location.pathname} />
      {deltas && !club.hideResources && (
        <div key={deltas.key} className="resource-deltas" aria-live="polite">
          {deltas.money !== 0 && (
            <span className={deltas.money > 0 ? 'gain' : 'loss'}>
              {deltas.money > 0 ? '+' : ''}
              {shortMoney(deltas.money)}
            </span>
          )}
          {deltas.development !== 0 && (
            <span className={deltas.development > 0 ? 'gain' : 'loss'}>
              {deltas.development > 0 ? '+' : ''}
              {deltas.development} PD
            </span>
          )}
          {deltas.medals !== 0 && (
            <span className={deltas.medals > 0 ? 'gain' : 'loss'}>
              {deltas.medals > 0 ? '+' : ''}
              {deltas.medals} medallas
            </span>
          )}
        </div>
      )}
      {feedback && (
        <div
          key={feedback.key}
          className={`game-feedback feedback-${feedback.kind}`}
          aria-live="polite"
        >
          <Sparkles />
          <strong>
            {feedback.title ||
              (
                {
                  transfer: '¡Movimiento confirmado!',
                  reward: '¡Actividad completada!',
                  construction: '¡Obra en marcha!',
                  research: 'Investigación en marcha',
                  sponsor: '¡Contrato firmado!',
                  concert: '¡Concierto confirmado!',
                  scandal: 'Decisión institucional registrada',
                  substitution: 'Cambio realizado',
                  coins: 'Tesorería actualizada',
                } as Partial<Record<Sound, string>>
              )[feedback.kind] ||
              'Operación confirmada'}
          </strong>
          {Array.from({ length: 9 }, (_, i) => (
            <i key={i} style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
      )}
    </>
  );
}
