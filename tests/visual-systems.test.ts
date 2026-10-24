import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BUILDINGS } from '../shared/config';
import { createGame } from '../shared/seed';
import { roster } from '../shared/sports';
import { AUTHORIZED_PHOTOS, sportsAsset, CLUB_ASSETS } from '../shared/sports-assets';
import { validateMediaPackage } from '../shared/sports-media-validation';
import { imageDimensions } from '../scripts/sports-image-info';
import { BUILDING_VISUALS, zoomCamera, clampCamera, cityEnvironment } from '../src/lib/visuals';
import atlas from '../src/lib/v03-atlas-bounds.json';
import { readPreferences } from '../src/lib/audio';
describe('recursos gráficos y cámara', () => {
  it('ofrece cinco recortes de arquitectura distintos para todos los edificios mejorables', () => {
    for (const b of BUILDINGS) {
      const v = BUILDING_VISUALS[b.id];
      expect(v).toBeTruthy();
      const row = atlas[v.atlas as keyof typeof atlas][v.row];
      if (b.max) {
        expect(row).toHaveLength(5);
        expect(new Set(row.map((r) => `${r.x}:${r.y}:${r.width}:${r.height}`)).size).toBe(5);
      }
      for (const cell of row) {
        expect(cell.width).toBeGreaterThan(150);
        expect(cell.height).toBeGreaterThan(128);
      }
    }
  });
  it('conserva el punto bajo los dedos al ampliar y limita la cámara', () => {
    const c = { x: -100, y: -250, zoom: 0.4 },
      anchor = { x: 170, y: 220 },
      n = zoomCamera(c, 0.8, anchor);
    expect((anchor.x - c.x) / c.zoom).toBeCloseTo((anchor.x - n.x) / n.zoom);
    expect((anchor.y - c.y) / c.zoom).toBeCloseTo((anchor.y - n.y) / n.zoom);
    expect(clampCamera({ x: 99999, y: -99999, zoom: 10 }, 390, 650)).toEqual({
      x: 0,
      y: 650 - 2400 * 1.15,
      zoom: 1.15,
    });
  });
  it('activa el estadio sólo cuando hay partidos en juego y vuelve al estado normal', () => {
    const s = createGame(Date.now()),
      c = s.clubs[0],
      r = s.rounds[0];
    expect(cityEnvironment(s, c).mode).toBe('normal');
    r.status = 'live';
    r.matches[0].status = 'live';
    expect(cityEnvironment(s, c).mode).toBe('matchday');
    r.status = 'finished';
    r.matches.forEach((m) => (m.status = 'finished'));
    expect(cityEnvironment(s, c).mode).toBe('normal');
  });
  it('activa la escena de concierto sólo durante el contrato vigente', () => {
    const s = createGame(Date.now()),
      c = s.clubs[0];
    s.concerts = [
      {
        id: 'qa',
        clubId: c.id,
        artistId: 'test',
        startsAt: s.now - 1,
        endsAt: s.now + 100,
        perRound: 100,
      },
    ];
    expect(cityEnvironment(s, c).mode).toBe('concert');
    s.now += 101;
    expect(cityEnvironment(s, c).mode).toBe('normal');
  });
});
describe('fotografías e identidades estables', () => {
  const players = roster(Date.now());
  it('comprueba dimensiones y duplicados de cada fotografía distribuida', () => {
    const hashes = new Set();
    for (const photo of AUTHORIZED_PHOTOS) {
      const b = readFileSync('public' + photo.file);
      expect(imageDimensions(b)).toEqual({ width: photo.width, height: photo.height });
      const digest = createHash('sha256').update(b).digest('hex');
      expect(hashes.has(digest)).toBe(false);
      hashes.add(digest);
      expect(players.find((p) => p.id === photo.playerId)?.name).toBe(photo.identity);
    }
  });
  it('nunca asigna una foto real a las 110 identidades ficticias', () => {
    const fictitious = players.filter((p) => p.simulated);
    expect(fictitious).toHaveLength(110);
    for (const p of fictitious) {
      expect(sportsAsset(p).photo).toBeUndefined();
      expect(sportsAsset(p).availability).toBe('fictional-portrait');
    }
  });
  it('actualiza el club sin cambiar la identidad ni la foto', () => {
    const p = players.find((p) => p.id === 'madrid-13')!,
      a = sportsAsset(p),
      b = sportsAsset({ ...p, realClubId: 'barcelona' });
    expect(a.photo?.file).toBe(b.photo?.file);
    expect(b.crest?.clubId).toBe('barcelona');
    expect(b.crest?.official).toBe(false);
    expect(CLUB_ASSETS).toHaveLength(20);
  });
  it('rechaza paquetes con ID, identidad, club, licencia o duplicados incorrectos', () => {
    const base = {
      season: '2026/27',
      photos: [{ ...AUTHORIZED_PHOTOS[0], clubId: 'madrid', sha256: 'a'.repeat(64) }],
    };
    expect(() => validateMediaPackage(base, players)).not.toThrow();
    for (const patch of [
      { playerId: 'inventado' },
      { identity: 'Otra persona' },
      { clubId: 'barcelona' },
      { license: 'CC-BY-NC-4.0' },
      { width: 10 },
    ])
      expect(() =>
        validateMediaPackage({ ...base, photos: [{ ...base.photos[0], ...patch }] }, players),
      ).toThrow();
    expect(() =>
      validateMediaPackage({ ...base, photos: [base.photos[0], base.photos[0]] }, players),
    ).toThrow();
    const f = players.find((p) => p.simulated)!;
    expect(() =>
      validateMediaPackage(
        {
          ...base,
          photos: [{ ...base.photos[0], playerId: f.id, identity: f.name, clubId: f.realClubId }],
        },
        players,
      ),
    ).toThrow();
  });
  it('rechaza archivos que no son imágenes', () =>
    expect(() => imageDimensions(Buffer.alloc(40))).toThrow());
});
describe('preferencias defensivas de audio y gráficos', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: { getItem: () => null },
      configurable: true,
    });
  });
  it('empieza con música y con calidad alta', () => {
    expect(readPreferences()).toMatchObject({
      music: true,
      effects: true,
      quality: 'high',
      volume: 0.35,
    });
  });
  it('recupera preferencias corruptas sin bloquear el acceso', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: { getItem: () => '{invalido' },
      configurable: true,
    });
    expect(readPreferences().music).toBe(true);
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () =>
          JSON.stringify({ volume: 900, quality: 'ultra', music: 'sí', effects: false }),
      },
      configurable: true,
    });
    expect(readPreferences()).toMatchObject({
      volume: 1,
      quality: 'high',
      music: true,
      effects: false,
    });
  });
});
