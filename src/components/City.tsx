import { AtlasSprite } from './AtlasSprite';
import atlasBounds from '../lib/atlas-bounds.json';
import { Link, useNavigate } from 'react-router-dom';
import {
  Check,
  ChevronRight,
  Hammer,
  LocateFixed,
  Minus,
  Plus,
  Map as MapIcon,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BUILDINGS } from '../../shared/config';
import type { BuildingDef } from '../../shared/types';
import { useGame } from '../lib/api';
import {
  BUILDING_VISUALS,
  WORLD,
  clampCamera,
  zoomCamera,
  cityEnvironment,
  type Camera,
} from '../lib/visuals';
import { audioManager, readPreferences } from '../lib/audio';
import { Countdown, Progress } from './ui';
export function BuildingArt({
  building,
  level = 1,
  constructing = false,
}: {
  building: BuildingDef;
  level?: number;
  constructing?: boolean;
}) {
  const v = BUILDING_VISUALS[building.id],
    actual = building.max ? Math.max(1, Math.min(5, level)) : 3;
  const bounds = atlasBounds[v.atlas as keyof typeof atlasBounds][v.row][actual - 1];
  return (
    <span
      className={`building-art-wrap ${constructing ? 'constructing' : ''}`}
      data-building={building.id}
      data-level={actual}
    >
      <svg viewBox="0 0 390 380" className="building-art" aria-hidden="true">
        <svg
          x={(390 - bounds.width) / 2}
          y={370 - bounds.height}
          width={bounds.width}
          height={bounds.height}
          viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
          overflow="hidden"
        >
          <image href={`/art/${v.atlas}-atlas.webp`} width="1536" height="1024" />
        </svg>
      </svg>
      {constructing && (
        <span className="construction-overlay" aria-hidden="true">
          <i className="crane" />
          <i className="construction-sparks" />
          <span className="work-barricade" />
          <Hammer size={24} />
        </span>
      )}
    </span>
  );
}
function Tree({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <AtlasSprite
      atlas="props"
      row={0}
      column={Math.round(x + y) % 4}
      x={x - 45 * scale}
      y={y - 85 * scale}
      width={90 * scale}
      height={90 * scale}
    />
  );
}
function Grounds() {
  const paths = [
    'M90 440Q680 120 1320 490',
    'M90 790Q700 420 1320 840',
    'M100 1150Q700 810 1320 1220',
    'M90 1500Q700 1170 1340 1580',
    'M170 1780Q760 1470 1270 1800',
    'M680 185L680 1770',
  ];
  return (
    <svg
      className="campus-ground"
      width={WORLD.width}
      height={WORLD.height}
      viewBox={`0 0 ${WORLD.width} ${WORLD.height}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="campus-grass" x2="1" y2="1">
          <stop stopColor="#5a9752" />
          <stop offset=".45" stopColor="#8db368" />
          <stop offset="1" stopColor="#337c59" />
        </linearGradient>
        <pattern id="grass-texture" width="52" height="39" patternUnits="userSpaceOnUse">
          <path
            d="M4 7l3-4m0 5V4M32 27l4-3m-1 5v-5"
            stroke="#b6cf7b"
            strokeWidth="2"
            opacity=".3"
          />
          <circle cx="20" cy="20" r="2" fill="#215c43" opacity=".2" />
        </pattern>
        <linearGradient id="river" x2="1" y2="1">
          <stop stopColor="#54c8d0" />
          <stop offset="1" stopColor="#237a9b" />
        </linearGradient>
        <pattern id="paving" width="28" height="18" patternUnits="userSpaceOnUse">
          <path d="M0 1H28M14 1V18" stroke="#9c9272" opacity=".25" />
        </pattern>
      </defs>
      <rect width="1420" height="1920" fill="url(#campus-grass)" />
      <rect width="1420" height="1920" fill="url(#grass-texture)" />
      <path
        d="M1360 -60Q1100 180 1385 440T1370 960Q1220 1180 1460 1510V-60Z"
        fill="#c4bd8b"
        stroke="#d3cd9b"
        strokeWidth="26"
      />
      <path d="M1378 -70Q1120 175 1400 440T1390 970Q1260 1170 1470 1490V-60Z" fill="url(#river)" />
      <path d="M-20 1380Q180 1320 80 1600Q5 1810 180 1950H-20Z" fill="#246e78" />
      <path
        d="M-20 1380Q180 1320 80 1600Q5 1810 180 1950"
        fill="none"
        stroke="#d0c598"
        strokeWidth="15"
      />
      {paths.map((d, i) => (
        <g key={d}>
          <path
            d={d}
            fill="none"
            stroke="#376849"
            strokeWidth="65"
            opacity=".25"
            transform="translate(5 9)"
          />
          <path d={d} fill="none" stroke="#c1b58b" strokeWidth="58" />
          <path d={d} fill="none" stroke="#e6d9af" strokeWidth="45" />
          <path
            d={d}
            fill="none"
            stroke="#f7ebc3"
            strokeWidth="2"
            strokeDasharray={i === 5 ? '2 16' : '0'}
          />
        </g>
      ))}
      <ellipse cx="680" cy="760" rx="120" ry="67" fill="#c6b99b" stroke="#f4e4b1" strokeWidth="8" />
      <ellipse cx="680" cy="760" rx="114" ry="61" fill="url(#paving)" />
      <AtlasSprite
        atlas="props"
        row={1}
        column={2}
        x={610}
        y={630}
        width={140}
        height={140}
        className="fountain-water"
      />

      {Array.from({ length: 88 }, (_, i) => {
        const edge = i < 38,
          x = edge ? (i % 2 ? 85 : 1330) + (i % 3) * 8 : 150 + ((i * 173) % 1110),
          y = edge ? 70 + Math.floor(i / 2) * 94 : 180 + ((i * 277) % 1510);
        if (
          !edge &&
          Object.values(BUILDING_VISUALS).some(
            (v) => Math.abs(v.x - x) < v.width * 0.55 && Math.abs(v.y - y) < 150,
          )
        )
          return null;
        return <Tree key={i} x={x} y={y} scale={0.65 + (i % 4) * 0.17} />;
      })}
      {Array.from({ length: 22 }, (_, i) => (
        <AtlasSprite
          key={i}
          atlas="props"
          row={2}
          column={0}
          x={(i % 2 ? 745 : 595) - 20}
          y={160 + Math.floor(i / 2) * 148}
          width={45}
          height={65}
        />
      ))}

      <g transform="translate(440 1780)">
        <path d="M0 0L240-28 355 35 115 65Z" fill="#536263" stroke="#d0c5a5" strokeWidth="10" />
        {Array.from({ length: 7 }, (_, i) => (
          <path key={i} d={`M${25 + i * 30} ${2 - i * 3}l48 29`} stroke="#eee5bc" strokeWidth="2" />
        ))}
      </g>
      <text
        x="720"
        y="1865"
        textAnchor="middle"
        fill="#e0d8a8"
        fontSize="31"
        fontWeight="900"
        letterSpacing="10"
      >
        MONIGONES
      </text>
    </svg>
  );
}
function Ambient({ live }: { live: boolean }) {
  const { club } = useGame(),
    high = readPreferences().quality === 'high';
  return (
    <svg className="ambient-layer" width={WORLD.width} height={WORLD.height} aria-hidden="true">
      {Object.entries(BUILDING_VISUALS).flatMap(([id, v], bi) =>
        Array.from(
          {
            length:
              (high ? 2 : 1) +
              Math.floor((club.buildings[id] || 1) / 2) +
              (id === 'stadium' && live ? 12 : 0),
          },
          (_, i) => (
            <g
              key={`${id}-${i}`}
              transform={`translate(${v.x - v.width * 0.35 + i * 19} ${v.y + 25 + (i % 2) * 12})`}
            >
              <g
                className={`campus-person ${id === 'stadium' && live ? 'supporter' : ''}`}
                style={
                  {
                    '--walk-x': `${(i % 2 ? 1 : -1) * (50 + bi * 3)}px`,
                    '--walk-y': `${20 - i * 5}px`,
                    animationDelay: `-${(bi + i) * 0.8}s`,
                    animationDuration: `${9 + (i % 4) * 3}s`,
                  } as CSSProperties
                }
              >
                <ellipse cy="6" rx="5" ry="2" fill="#254b36" opacity=".4" />
                <path
                  className="person-step"
                  d="M-2 0L-3 5M2 0L3 5"
                  stroke="#25374b"
                  strokeWidth="2"
                />
                <path
                  d="M-3-8L3-8 4 0H-4Z"
                  fill={
                    id === 'stadium' && live
                      ? club.color
                      : ['#f5c864', '#df7051', '#82b8d4', '#f0ead4'][i % 4]
                  }
                />
                <circle cy="-12" r="3" fill="#d7a27f" />
              </g>
            </g>
          ),
        ),
      )}
      <g className="campus-car">
        <AtlasSprite
          atlas="props"
          row={3}
          column={club.buildings.stadium >= 3 ? 0 : 1}
          x={625}
          y={850}
          width={90}
          height={75}
        />
      </g>
      {club.buildings.hq >= 2 && (
        <g className="club-flag" transform="translate(690 185)">
          <path d="M0 50V0" stroke="#f2dfac" strokeWidth="3" />
          <path d="M2 2Q22-7 36 3V23Q17 14 2 24Z" fill={club.color} />
        </g>
      )}
      {club.buildings.marketing >= 2 && (
        <ellipse className="marketing-glow" cx="270" cy="600" rx="45" ry="15" fill="#ffbe7655" />
      )}
      <g className="training-ball">
        <circle cx="1080" cy="1050" r="5" fill="#fff0d2" />
        <path d="M1078 1046L1082 1049 1080 1053 1076 1050Z" fill="#213b4d" />
      </g>

      {live && (
        <g className="stadium-lights">
          <path d="M480 535L390 300 545 520M820 540L930 300 765 520" fill="#ffecaa" opacity=".18" />
          <circle cx="515" cy="545" r="7" fill="#fff7d0" />
          <circle cx="795" cy="550" r="7" fill="#fff7d0" />
        </g>
      )}
      {club.buildings.research >= 3 && (
        <g transform="translate(1040 300)">
          <ellipse
            className="science-orbit"
            rx="55"
            ry="19"
            fill="none"
            stroke="#caa9ff"
            strokeWidth="3"
            strokeDasharray="8 12"
          />
        </g>
      )}
    </svg>
  );
}
export function CityMap({ decorative = false }: { decorative?: boolean }) {
  const { club, state } = useGame(),
    navigate = useNavigate();
  const viewport = useRef<HTMLDivElement>(null),
    pointers = useRef(new Map<number, { x: number; y: number }>()),
    moved = useRef(false),
    lastPinch = useRef(0),
    lastPan = useRef({ x: 0, y: 0 });
  const [camera, setCamera] = useState<Camera>({ x: -105, y: 12, zoom: 0.43 }),
    [picker, setPicker] = useState(false),
    [prefs, setPrefs] = useState(readPreferences);
  const environment = cityEnvironment(state, club);
  useEffect(() => {
    const update = () => setPrefs(readPreferences());
    window.addEventListener('monigones:preferences', update);
    return () => window.removeEventListener('monigones:preferences', update);
  }, []);
  const dimensions = () => ({
    width: viewport.current?.clientWidth || 390,
    height: viewport.current?.clientHeight || 620,
  });
  const change = (next: Camera | ((c: Camera) => Camera)) =>
    setCamera((c) => {
      const d = dimensions();
      return clampCamera(typeof next === 'function' ? next(c) : next, d.width, d.height);
    });
  const zoom = (factor: number) => {
    const d = dimensions();
    change((c) => zoomCamera(c, c.zoom * factor, { x: d.width / 2, y: d.height / 2 }));
  };
  const focus = (id: string) => {
    const v = BUILDING_VISUALS[id],
      d = dimensions();
    change({ zoom: 0.65, x: d.width / 2 - v.x * 0.65, y: d.height * 0.62 - v.y * 0.65 });
    setPicker(false);
  };
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      change((c) =>
        zoomCamera(c, c.zoom * Math.exp(-e.deltaY * 0.0015), {
          x: e.clientX - r.left,
          y: e.clientY - r.top,
        }),
      );
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);
  return (
    <div
      ref={viewport}
      className={`city-map city-viewport ${decorative ? 'decorative' : ''}`}
      data-environment={environment.mode}
      data-quality={prefs.quality}
      data-zoom={camera.zoom.toFixed(2)}
      tabIndex={0}
      role="region"
      aria-label="Mapa de la ciudad deportiva. Arrastra para explorar; usa más y menos para ampliar."
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '+', '-', 'Home'].includes(e.key))
          e.preventDefault();
        if (e.key === '+') zoom(1.2);
        if (e.key === '-') zoom(1 / 1.2);
        if (e.key === 'Home') focus('stadium');
        if (e.key.startsWith('Arrow'))
          change((c) => ({
            ...c,
            x: c.x + (e.key === 'ArrowLeft' ? 60 : e.key === 'ArrowRight' ? -60 : 0),
            y: c.y + (e.key === 'ArrowUp' ? 60 : e.key === 'ArrowDown' ? -60 : 0),
          }));
      }}
      onPointerDown={(e) => {
        if ((e.target as Element).closest('.map-hud, .map-controls, .building-picker')) return;
        const p = { x: e.clientX, y: e.clientY };
        pointers.current.set(e.pointerId, p);
        lastPan.current = p;
        moved.current = false;
        if (pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()];
          lastPinch.current = Math.hypot(a.x - b.x, a.y - b.y);
          moved.current = true;
        }
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!pointers.current.has(e.pointerId)) return;
        const current = { x: e.clientX, y: e.clientY };
        pointers.current.set(e.pointerId, current);
        if (pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()],
            distance = Math.hypot(a.x - b.x, a.y - b.y),
            r = e.currentTarget.getBoundingClientRect();
          change((c) =>
            zoomCamera(c, (c.zoom * distance) / (lastPinch.current || distance), {
              x: (a.x + b.x) / 2 - r.left,
              y: (a.y + b.y) / 2 - r.top,
            }),
          );
          lastPinch.current = distance;
          moved.current = true;
        } else {
          const dx = current.x - lastPan.current.x,
            dy = current.y - lastPan.current.y;
          if (Math.hypot(dx, dy) > 5 || moved.current) {
            moved.current = true;
            change((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
            lastPan.current = current;
          }
        }
      }}
      onPointerUp={(e) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.delete(e.pointerId);
        if (pointers.current.size) lastPan.current = [...pointers.current.values()][0];
        if (!moved.current) {
          const r = e.currentTarget.getBoundingClientRect(),
            wx = (e.clientX - r.left - camera.x) / camera.zoom,
            wy = (e.clientY - r.top - camera.y) / camera.zoom;
          const hit = BUILDINGS.toReversed().find((b) => {
            const v = BUILDING_VISUALS[b.id];
            return (
              Math.abs(wx - v.x) < v.width * 0.48 && wy < v.y + 35 && wy > v.y - v.width * 0.94
            );
          });
          if (hit) {
            audioManager.play('open');
            navigate(`/building/${hit.id}`);
          }
        }
      }}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId);
        moved.current = true;
      }}
    >
      <div
        className="city-world"
        style={{
          width: WORLD.width,
          height: WORLD.height,
          transform: `translate3d(${camera.x}px,${camera.y}px,0) scale(${camera.zoom})`,
        }}
      >
        <Grounds />
        {BUILDINGS.map((b) => {
          const v = BUILDING_VISUALS[b.id],
            job = state.jobs.find(
              (j) => j.clubId === club.id && j.kind === 'building' && j.target === b.id,
            ),
            level = club.buildings[b.id] || 1;
          return (
            <Link
              key={b.id}
              to={`/building/${b.id}`}
              className={`map-building ${b.id === 'stadium' ? 'stadium-building' : ''} ${job ? 'has-job' : ''}`}
              style={{ left: v.x, top: v.y, width: v.width, zIndex: Math.round(v.y) }}
              aria-label={`${b.name}${b.max ? `, nivel ${level}` : ''}${job ? ', en construcción' : ''}`}
              onClick={(e) => {
                if (moved.current) e.preventDefault();
                else audioManager.play('open');
              }}
            >
              <BuildingArt building={b} level={level} constructing={!!job} />
              {job && (
                <span className="building-timer">
                  <Hammer size={14} />
                  <Countdown to={job.endsAt} now={state.now} />
                </span>
              )}
              {b.id === 'stadium' && environment.live && (
                <span className="building-live">● EN JUEGO</span>
              )}
              <span className="building-label">
                {b.short}
                {b.max > 0 && <b>{level}</b>}
              </span>
            </Link>
          );
        })}
        {prefs.quality !== 'low' && <Ambient live={!!environment.live} />}
      </div>
      <div className="map-vignette" />
      <div className="map-hud map-location">
        <span className="live-dot" />
        {environment.live ? 'DÍA DE PARTIDO' : 'CIUDAD DEPORTIVA'}
        <small>{club.name}</small>
      </div>
      <div className="map-controls" aria-label="Cámara del mapa">
        <button aria-label="Ampliar mapa" onClick={() => zoom(1.2)}>
          <Plus size={20} />
        </button>
        <output aria-label="Zoom del mapa">{Math.round(camera.zoom * 100)}%</output>
        <button aria-label="Alejar mapa" onClick={() => zoom(1 / 1.2)}>
          <Minus size={20} />
        </button>
        <button aria-label="Centrar estadio" onClick={() => focus('stadium')}>
          <LocateFixed size={20} />
        </button>
        <button
          aria-label="Vista general"
          onClick={() => {
            const d = dimensions();
            change({ zoom: 0.27, x: (d.width - WORLD.width * 0.27) / 2, y: 30 });
          }}
        >
          <MapIcon size={20} />
        </button>
      </div>
      <button className="map-hud map-explore" onClick={() => setPicker(!picker)}>
        {picker ? <X size={17} /> : <MapIcon size={17} />}Departamentos
      </button>
      {picker && (
        <div className="building-picker">
          <b>Viaja por tu club</b>
          <div>
            {BUILDINGS.map((b) => (
              <button key={b.id} onClick={() => focus(b.id)}>
                {b.short}
                <small>{b.max ? `Nv. ${club.buildings[b.id]}` : 'Acceder'}</small>
              </button>
            ))}
          </div>
        </div>
      )}
      <span className="map-gesture">ARRASTRA PARA EXPLORAR · PELLIZCA PARA ACERCAR</span>
    </div>
  );
}
export function WorkQueue() {
  const { state, club, act } = useGame();
  const jobs = state.jobs.filter((j) => j.clubId === club.id);
  return (
    <div className="work-list">
      {jobs.length ? (
        jobs.map((j) => (
          <div className="card work-card" key={j.id}>
            <div className="row">
              <span className="icon-badge gold">
                <Hammer size={20} />
              </span>
              <div className="grow">
                <b>{BUILDINGS.find((b) => b.id === j.target)?.name || j.target}</b>
                <p>
                  Nivel {j.level} · <Countdown to={j.endsAt} now={state.now} />
                </p>
              </div>
            </div>
            <Progress value={state.now - j.startedAt} max={j.endsAt - j.startedAt} />
            {j.kind !== 'research' && (
              <button
                className="text-link danger"
                onClick={() =>
                  void act({ type: 'cancelJob', id: j.id }, 'Obra cancelada. Se devuelve el 50 %.')
                }
              >
                Cancelar · recuperar el 50 %
              </button>
            )}
          </div>
        ))
      ) : (
        <div className="queue-empty">
          <Check size={18} />
          <div>
            <b>Todo listo para crecer</b>
            <p>No tienes obras en curso.</p>
          </div>
          <Link to="/building/hq">
            <ChevronRight size={20} />
          </Link>
        </div>
      )}
    </div>
  );
}
