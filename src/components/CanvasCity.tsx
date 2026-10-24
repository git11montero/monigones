import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BUILDINGS } from '../../shared/config';
import { useGame } from '../lib/api';
import { AttentionBadge } from './Attention';
import { Countdown } from './ui';
import { audioManager, readPreferences } from '../lib/audio';
import {
  BUILDING_VISUALS,
  WORLD,
  clampCamera,
  zoomCamera,
  cityEnvironment,
  type Camera,
} from '../lib/visuals';
import bounds from '../lib/v03-atlas-bounds.json';
const images = new Map<string, HTMLImageElement>();
const CITY_PROPS = [
  { column: 0, row: 0, x: 580, y: 650, width: 205 },
  { column: 1, row: 0, x: 920, y: 635, width: 225 },
  { column: 2, row: 0, x: 1130, y: 755, width: 175 },
  { column: 0, row: 1, x: 380, y: 1540, width: 170 },
  { column: 1, row: 1, x: 790, y: 1025, width: 135 },
  { column: 2, row: 1, x: 1400, y: 1600, width: 240 },
];
function texture(src: string) {
  let img = images.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    images.set(src, img);
  }
  return img;
}
export function spriteRect(id: string, level: number) {
  const v = BUILDING_VISUALS[id],
    column = ['offices', 'competition'].includes(id) ? 2 : Math.min(4, Math.max(0, level - 1));
  const cell = bounds[v.atlas as keyof typeof bounds][v.row][column],
    width = v.width * (0.82 + column * 0.045);
  return {
    cell,
    width,
    height: (width * cell.height) / cell.width,
    x: v.x - width / 2,
    y: v.y - (width * cell.height) / cell.width,
  };
}
export function CanvasCity({ decorative = false }: { decorative?: boolean }) {
  const { state, club } = useGame(),
    nav = useNavigate(),
    viewport = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    cameraRef = useRef<Camera>({ x: -300, y: -80, zoom: 0.6 }),
    pointers = useRef(new Map<number, { x: number; y: number }>()),
    gesture = useRef({
      moved: false,
      last: { x: 0, y: 0 },
      start: { x: 0, y: 0 },
      distance: 0,
      pinched: false,
    });
  const [camera, setCamera] = useState(cameraRef.current),
    [size, setSize] = useState({ width: 390, height: 700 }),
    [prefs, setPrefs] = useState(readPreferences),
    [ready, setReady] = useState(false);
  const env = cityEnvironment(state, club);
  const change = (next: Camera) => {
    const el = viewport.current;
    if (!el) return;
    const c = clampCamera(next, el.clientWidth, el.clientHeight);
    cameraRef.current = c;
    setCamera(c);
  };
  useEffect(() => {
    const el = viewport.current!;
    let initial = true;
    const observer = new ResizeObserver(() => {
      const width = el.clientWidth,
        height = el.clientHeight;
      setSize({ width, height });
      if (initial) {
        const zoom = 0.58,
          v = BUILDING_VISUALS.stadium;
        change({ zoom, x: width / 2 - v.x * zoom, y: height * 0.6 - v.y * zoom });
        initial = false;
      } else change(cameraRef.current);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const fn = () => setPrefs(readPreferences());
    window.addEventListener('monigones:preferences', fn);
    return () => window.removeEventListener('monigones:preferences', fn);
  }, []);
  useEffect(() => {
    let alive = true;
    Promise.all(
      ['ground', 'core', 'training', 'commerce', 'relations', 'culture', 'props'].map((name) =>
        texture(`/art/v03/${name}.webp`).decode(),
      ),
    ).then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const el = viewport.current!;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      change(
        zoomCamera(cameraRef.current, cameraRef.current.zoom * Math.exp(-event.deltaY * 0.001), {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        }),
      );
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);
  useEffect(() => {
    const el = canvas.current;
    if (!el || !ready) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    el.width = Math.round(size.width * dpr);
    el.height = Math.round(size.height * dpr);
    const ctx = el.getContext('2d', { alpha: false })!;
    let frame = 0,
      last = 0;
    const reduced = !prefs.motion || matchMedia('(prefers-reduced-motion: reduce)').matches,
      animated = prefs.quality !== 'low' && !reduced;
    function draw(time: number) {
      if (time - last < 1000 / 30 && animated) {
        frame = requestAnimationFrame(draw);
        return;
      }
      last = time;
      const c = cameraRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#506453';
      ctx.fillRect(0, 0, size.width, size.height);
      ctx.translate(c.x, c.y);
      ctx.scale(c.zoom, c.zoom);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(texture('/art/v03/ground.webp'), 0, 0, WORLD.width, WORLD.height);
      const drawProp = (p: (typeof CITY_PROPS)[number]) => {
        ctx.drawImage(
          texture('/art/v03/props.webp'),
          p.column * 512,
          p.row * 512,
          512,
          512,
          p.x - p.width / 2,
          p.y - p.width,
          p.width,
          p.width,
        );
      };
      const pendingProps = [...CITY_PROPS].sort((a, b) => a.y - b.y);
      // Accurate bounds keep raster sprites flush to their paved plot; draw in depth order.
      for (const b of [...BUILDINGS].sort(
        (a, b) => BUILDING_VISUALS[a.id].y - BUILDING_VISUALS[b.id].y,
      )) {
        while (pendingProps.length && pendingProps[0].y <= BUILDING_VISUALS[b.id].y)
          drawProp(pendingProps.shift()!);
        const level = club.buildings[b.id] || 1,
          v = BUILDING_VISUALS[b.id],
          r = spriteRect(b.id, level);
        ctx.drawImage(
          texture(`/art/v03/${v.atlas}.webp`),
          r.cell.x,
          r.cell.y,
          r.cell.width,
          r.cell.height,
          r.x,
          r.y,
          r.width,
          r.height,
        );
        if (level >= 3) {
          ctx.fillStyle = '#70a675';
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.ellipse(r.x + 20 + i * 19, v.y + 6, 12, 6, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        if (level >= 4) {
          ctx.fillStyle = '#ffe8aa60';
          ctx.beginPath();
          ctx.ellipse(v.x + r.width * 0.4, v.y - 8, 20, 8, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        if (
          state.jobs.some((j) => j.clubId === club.id && j.kind === 'building' && j.target === b.id)
        ) {
          ctx.strokeStyle = '#edb74e';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(r.x + 20, v.y);
          ctx.lineTo(r.x + 20, r.y - 20);
          ctx.lineTo(r.x + r.width * 0.6, r.y - 20);
          ctx.lineTo(r.x + r.width * 0.6, r.y + 35);
          ctx.stroke();
          ctx.fillStyle = '#ebad3c';
          ctx.fillRect(r.x, v.y - 10, r.width, 8);
        }
      }
      for (const p of pendingProps) drawProp(p);
      if (animated) {
        const count = prefs.quality === 'high' ? 45 + club.buildings.hq * 6 : 20;
        for (let i = 0; i < count; i++) {
          const t = ((time / 1000) * (7 + (i % 5)) + i * 37) % 320,
            area = i % 3,
            x = area === 0 ? 300 + t : area === 1 ? 1040 + t * 0.7 : 520 + t,
            y = area === 0 ? 470 + t * 0.08 : area === 1 ? 1320 - t * 0.12 : 1980 + t * 0.12;
          ctx.fillStyle = '#22303944';
          ctx.beginPath();
          ctx.ellipse(x + 3, y + 6, 6, 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = ['#c84d40', '#e4e0c9', '#2f5264', '#b58b62'][i % 4];
          ctx.fillRect(x, y - 9, 5, 10);
          ctx.fillStyle = '#d8af89';
          ctx.beginPath();
          ctx.arc(x + 2.5, y - 11, 2.7, 0, Math.PI * 2);
          ctx.fill();
        }
        for (let i = 0; i < 3 + Math.floor(club.buildings.hq / 2); i++) {
          const t = ((time / 1000) * 22 + i * 320) % 1600,
            x = 100 + t * 0.75,
            y = 2190 - t * 0.2;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(-0.18);
          ctx.fillStyle = '#192a2c66';
          ctx.fillRect(-1, 3, 40, 16);
          ctx.fillStyle = ['#e3e5dc', '#325d76', '#bd5946', '#d8c68e'][i % 4];
          ctx.fillRect(0, 0, 37, 13);
          ctx.fillStyle = '#29404a';
          ctx.fillRect(10, 2, 14, 9);
          ctx.restore();
        }
      }
      if (env.live || env.concert) {
        const v = BUILDING_VISUALS.stadium;
        for (let i = 0; i < (env.live ? 48 : 30); i++) {
          const angle = i * 2.4,
            rx = 240 + Math.sin(time / 5000 + i) * 8;
          ctx.fillStyle = i % 3 ? '#dfd4bf' : '#a82f32';
          ctx.fillRect(v.x + Math.cos(angle) * rx, v.y + Math.sin(angle) * 55 - 24, 5, 8);
        }
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = env.concert ? '#9ecbff35' : '#fff1b840';
        for (const offset of [-220, 220]) {
          ctx.beginPath();
          ctx.moveTo(v.x + offset, v.y - 220);
          ctx.lineTo(v.x + offset - 80, v.y + 40);
          ctx.lineTo(v.x + offset + 100, v.y + 10);
          ctx.fill();
        }
        ctx.restore();
      }
      if (animated) frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [ready, size, camera, club, state.jobs, env.live, env.concert, prefs]);
  const release = (event: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    if (!g.moved && !g.pinched) {
      const rect = event.currentTarget.getBoundingClientRect(),
        c = cameraRef.current,
        point = {
          x: (event.clientX - rect.left - c.x) / c.zoom,
          y: (event.clientY - rect.top - c.y) / c.zoom,
        };
      const hit = [...BUILDINGS]
        .sort((a, b) => BUILDING_VISUALS[b.id].y - BUILDING_VISUALS[a.id].y)
        .find((b) => {
          const r = spriteRect(b.id, club.buildings[b.id] || 1);
          return (
            point.x >= r.x &&
            point.x <= r.x + r.width &&
            point.y >= r.y &&
            point.y <= r.y + r.height
          );
        });
      if (hit) {
        audioManager.play('open');
        nav(`/building/${hit.id}`);
      }
    }
    if (pointers.current.size) g.last = [...pointers.current.values()][0];
  };
  return (
    <div
      ref={viewport}
      className={`city-map city-viewport canvas-city ${decorative ? 'decorative' : ''}`}
      data-renderer="canvas-2d"
      data-animated={
        prefs.motion &&
        prefs.quality !== 'low' &&
        !matchMedia('(prefers-reduced-motion: reduce)').matches
      }
      data-ready={ready}
      data-environment={env.mode}
      data-zoom={camera.zoom.toFixed(3)}
      data-camera-x={camera.x}
      data-camera-y={camera.y}
      role="region"
      tabIndex={0}
      aria-label="Mapa de la ciudad deportiva. Arrastra para explorar y pellizca para ampliar."
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        const c = cameraRef.current;
        if (['+', '-', 'Home', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key))
          e.preventDefault();
        if (e.key === '+' || e.key === '-')
          change(
            zoomCamera(c, c.zoom * (e.key === '+' ? 1.2 : 1 / 1.2), {
              x: size.width / 2,
              y: size.height / 2,
            }),
          );
        else if (e.key === 'Home') {
          const v = BUILDING_VISUALS.stadium;
          change({ ...c, x: size.width / 2 - v.x * c.zoom, y: size.height * 0.6 - v.y * c.zoom });
        } else
          change({
            ...c,
            x: c.x + (e.key === 'ArrowLeft' ? 65 : e.key === 'ArrowRight' ? -65 : 0),
            y: c.y + (e.key === 'ArrowUp' ? 65 : e.key === 'ArrowDown' ? -65 : 0),
          });
      }}
      onPointerDown={(e) => {
        const point = { x: e.clientX, y: e.clientY };
        pointers.current.set(e.pointerId, point);
        const g = gesture.current;
        if (pointers.current.size === 1) {
          g.moved = false;
          g.pinched = false;
          g.start = point;
          g.last = point;
        } else {
          const [a, b] = [...pointers.current.values()];
          g.distance = Math.hypot(a.x - b.x, a.y - b.y);
          g.pinched = true;
          g.moved = true;
        }
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!pointers.current.has(e.pointerId)) return;
        const g = gesture.current,
          current = { x: e.clientX, y: e.clientY },
          c = cameraRef.current;
        pointers.current.set(e.pointerId, current);
        if (pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()],
            distance = Math.hypot(a.x - b.x, a.y - b.y),
            rect = e.currentTarget.getBoundingClientRect();
          change(
            zoomCamera(c, (c.zoom * distance) / (g.distance || distance), {
              x: (a.x + b.x) / 2 - rect.left,
              y: (a.y + b.y) / 2 - rect.top,
            }),
          );
          g.distance = distance;
        } else if (g.moved || Math.hypot(current.x - g.start.x, current.y - g.start.y) > 7) {
          g.moved = true;
          change({ ...c, x: c.x + current.x - g.last.x, y: c.y + current.y - g.last.y });
          g.last = current;
        }
      }}
      onPointerUp={release}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId);
        gesture.current.moved = true;
        gesture.current.pinched = true;
      }}
    >
      <canvas ref={canvas} className="city-canvas" aria-hidden="true" />
      {!ready && (
        <div className="map-loading" role="status">
          Cargando ciudad deportiva…
        </div>
      )}
      <div
        className="city-world canvas-accesses"
        style={{
          width: WORLD.width,
          height: WORLD.height,
          transform: `translate3d(${camera.x}px,${camera.y}px,0) scale(${camera.zoom})`,
        }}
      >
        {BUILDINGS.map((b) => {
          const r = spriteRect(b.id, club.buildings[b.id] || 1),
            job = state.jobs.find(
              (j) => j.clubId === club.id && j.kind === 'building' && j.target === b.id,
            );
          return (
            <Link
              key={b.id}
              to={`/building/${b.id}`}
              data-building={b.id}
              data-level={club.buildings[b.id] || 1}
              className={`map-building ${job ? 'has-job' : ''}`}
              style={
                {
                  left: r.x,
                  top: r.y,
                  width: r.width,
                  height: r.height,
                  zIndex: BUILDING_VISUALS[b.id].y,
                } as CSSProperties
              }
              aria-label={`${b.name}${b.max ? `, nivel ${club.buildings[b.id]}` : ''}`}
              onClick={(e) => {
                if (gesture.current.moved || e.detail > 0) e.preventDefault();
              }}
            >
              <AttentionBadge to={`/building/${b.id}`} />
              <span className="building-label">
                {b.short}
                {b.max > 0 && <b>{club.buildings[b.id]}</b>}
              </span>
              {job && (
                <span className="building-timer">
                  <Countdown to={job.endsAt} now={state.now} />
                </span>
              )}
              {b.id === 'stadium' && env.live && <span className="building-live">EN JUEGO</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
