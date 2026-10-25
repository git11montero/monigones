import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { createGame } from '../shared/seed';
import { execute, reconcile, publicState } from '../shared/engine';
import { activityOffers } from '../shared/activities';
import { dailyKey, nextMarket } from '../shared/math';
import { roster, REAL_CLUBS } from '../shared/sports';
import {
  FOOTBALL_ASSETS,
  playerAsset,
  clubAsset,
  PLAYER_FALLBACK,
} from '../shared/football-assets';
import { mediaStatus, publicFootballPath } from '../server/football-media';
import { clampCamera, WORLD } from '../src/lib/visuals';

function fixture(now = Date.parse('2026-10-24T03:50:00Z')) {
  const s = createGame(now),
    c = s.clubs[0];
  s.draft.active = true;
  c.resources.fame = 8;
  return {
    s,
    c,
    cmd: (command: { type: string; [key: string]: unknown }) =>
      execute(s, { userId: c.userId, clubId: c.id, admin: true }, command),
  };
}

describe('v0.3: penalización y día de origen', () => {
  it.each([0, 1, 2, 3])(
    '%i actividades completadas: solo cero pierde fama, también en partidas v0.2',
    (count) => {
      const { s, c } = fixture(),
        day = dailyKey(s.now);
      c.dailyDone = Array.from({ length: count }, (_, i) => `old-${i}`);
      reconcile(s, nextMarket(s.now));
      expect(c.resources.fame).toBe(count === 0 ? 7 : 8);
      expect(c.activityDays?.[day].completed).toBe(count);
      expect(c.activityDays?.[day].penaltyApplied === true).toBe(count === 0);
      reconcile(s, s.now + 1000);
      expect(c.resources.fame).toBe(count === 0 ? 7 : 8);
    },
  );
  it('aplaza el cierre al cruzar las 06:00 y atribuye un único cobro al día de inicio', () => {
    const { s, c, cmd } = fixture(),
      day = dailyKey(s.now),
      offers = activityOffers(s);
    cmd({ type: 'dailyStart', id: offers[0].id });
    const run = structuredClone(c.activity!),
      money = c.resources.money;
    expect(() => cmd({ type: 'dailyClaim', id: run.id, now: run.endsAt })).toThrow('terminado');
    reconcile(s, nextMarket(s.now));
    expect(c.resources.fame).toBe(8);
    expect(c.activityDays?.[day]).toMatchObject({
      closed: true,
      completed: 0,
      pendingRunId: run.id,
    });
    expect(c.activityDays?.[day].penaltyApplied).toBeUndefined();
    expect(activityOffers(s)).not.toEqual(offers);
    expect(c.resources.money).toBe(money);
    expect(() => cmd({ type: 'dailyStart', id: activityOffers(s)[0].id })).toThrow('actual');
    reconcile(s, run.endsAt);
    expect(c.activityHistory || []).toHaveLength(0);
    cmd({ type: 'dailyClaim', id: run.id });
    expect(c.activityDays?.[day]).toMatchObject({ completed: 1, closed: true });
    expect(c.activityDays?.[day].pendingRunId).toBeUndefined();
    expect(c.dailyDone).toEqual([]);
    expect(c.activityHistory).toHaveLength(1);
    const resources = structuredClone(c.resources);
    expect(() => cmd({ type: 'dailyClaim', id: run.id })).toThrow('pendiente');
    expect(c.resources).toEqual(resources);
    expect(c.activityDays?.[day].completed).toBe(1);
    expect(publicState(s, s.clubs[1].userId).state.clubs[0].activityDays).toBeUndefined();
  });
  it('un cobro atrasado no protege días posteriores sin actividad ni concede premios automáticos', () => {
    const { s, c, cmd } = fixture(),
      day = dailyKey(s.now);
    cmd({ type: 'dailyStart', id: activityOffers(s)[0].id });
    const run = structuredClone(c.activity!);
    reconcile(s, nextMarket(s.now));
    reconcile(s, nextMarket(s.now));
    expect(c.resources.fame).toBe(7);
    expect(c.activityDays?.[day].pendingRunId).toBe(run.id);
    expect(c.activityHistory || []).toHaveLength(0);
    cmd({ type: 'dailyClaim', id: run.id });
    expect(c.activityDays?.[day].completed).toBe(1);
    expect(c.dailyDone).toHaveLength(0);
  });
});

describe('v0.3: catálogo manual de PNG', () => {
  it('cubre exactamente los 500 jugadores y 20 clubes, con identidades y archivos únicos', () => {
    const players = roster(0);
    expect(FOOTBALL_ASSETS).toHaveLength(players.length);
    expect(FOOTBALL_ASSETS).toHaveLength(500);
    expect(new Set(FOOTBALL_ASSETS.map((e) => e.playerId)).size).toBe(500);
    expect(new Set(FOOTBALL_ASSETS.map((e) => e.resourceId)).size).toBe(500);
    for (const p of players) {
      const asset = playerAsset(p);
      expect(asset.entry?.name).toBe(p.name);
      expect(asset.entry?.clubId).toBe(p.realClubId);
      const bytes = readFileSync('public' + asset.photo);
      expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(bytes.readUInt32BE(16)).toBeGreaterThanOrEqual(64);
      expect(bytes.readUInt32BE(20)).toBeGreaterThanOrEqual(64);
    }
    expect(REAL_CLUBS).toHaveLength(20);
    for (const club of REAL_CLUBS) expect(existsSync('public' + clubAsset(club.id))).toBe(true);
  });
  it('el club real cambia el prefijo, la propiedad fantasy conserva el recurso', () => {
    const p = roster(0).find((p) => p.id === 'madrid-13')!;
    expect(playerAsset(p).photo).toBe('/assets/futbol/jugadores/realmadrid-mbappe.png');
    const fantasy = { ...p, ownerId: 'otro-club' };
    expect(playerAsset(fantasy).photo).toBe(playerAsset(p).photo);
    expect(playerAsset({ ...p, realClubId: 'betis' }).photo).toBe(
      '/assets/futbol/jugadores/betis-mbappe.png',
    );
    expect(playerAsset({ id: 'inventado', realClubId: 'betis' }).photo).toBe(PLAYER_FALLBACK);
    expect(publicFootballPath('/assets/futbol/jugadores/betis-mbappe.png')).toBeDefined();
    expect(publicFootballPath('/assets/futbol/jugadores/../../server/index.ts')).toBeUndefined();
    expect(publicFootballPath('/assets/futbol/jugadores/betis-inventado.png')).toBeUndefined();
  });
  it('detecta PNG nuevos tras un cambio real y no los etiqueta como fotografías autorizadas', () => {
    const path = '/assets/futbol/jugadores/betis-mbappe.png',
      file = 'public' + path;
    const old = existsSync(file) ? readFileSync(file) : undefined;
    try {
      const placeholder = readFileSync('public' + PLAYER_FALLBACK);
      writeFileSync(file, placeholder);
      const initial = mediaStatus()[path];
      expect(initial.kind).toBe('placeholder');
      // The neutral shield is a valid alternate PNG: never substitute another person's face.
      writeFileSync(file, readFileSync('public/assets/futbol/fallback/escudo.png'));
      const changed = mediaStatus()[path];
      expect(changed.version).not.toBe(initial.version);
      expect(changed.kind).not.toBe('licensed');
    } finally {
      if (old) writeFileSync(file, old);
      else unlinkSync(file);
    }
  });
});

describe('v0.3: límites de cámara para cualquier gesto', () => {
  it.each([
    [320, 568],
    [390, 652],
    [460, 1000],
    [2400, 3200],
  ])('cubre o centra el escenario en %ix%i', (width, height) => {
    for (const zoom of [0.01, 0.27, 0.58, 0.9, 1.15, 4])
      for (const x of [-1e9, 0, 1e9])
        for (const y of [-1e9, 0, 1e9]) {
          const c = clampCamera({ x, y, zoom }, width, height);
          for (const [pos, view, world] of [
            [c.x, width, WORLD.width],
            [c.y, height, WORLD.height],
          ]) {
            if (world * c.zoom <= view) expect(pos).toBeCloseTo((view - world * c.zoom) / 2);
            else {
              expect(pos).toBeLessThanOrEqual(0);
              expect(pos + world * c.zoom).toBeGreaterThanOrEqual(view - 1e-7);
            }
          }
        }
  });
});
