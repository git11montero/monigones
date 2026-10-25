import { completedTestFantasy } from './fixtures/fantasy';
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import catalog from '../data/sports/laliga-2026-27.json';
import historical from '../data/sports/legacy-v05.json';
import fantasy from '../data/demo-fantasy-v06.json';
import retired from '../docs/provenance/retired-photos-v05.json';
import { roster, REAL_CLUBS } from '../shared/sports';
import { formatMoney, formatEuros, parseMoneyInput, amountProblem } from '../shared/money';
import { FORMATION_CATALOG, tacticalSlots } from '../shared/formations';
import { generatedDemo, readSnapshot, snapshotOf } from '../server/demo/state';
import { fantasySnapshot, previewFantasy } from '../server/demo/fantasy';
import { callCost, execute } from '../shared/engine';
import {
  FOOTBALL_ASSETS,
  ALL_FOOTBALL_ASSETS,
  CLUB_SLUGS,
  clubAsset,
  playerAsset,
} from '../shared/football-assets';
import { AUTHORIZED_PHOTOS } from '../shared/sports-assets';
import { imageDimensions } from '../scripts/sports-image-info';
import { HELP } from '../shared/help';
const at = Date.parse('2026-10-25T10:00:00Z');
describe('v06 catálogo e importación controlada', () => {
  it('incluye 25 identidades reales por club con fuentes, temporada y IDs únicos', () => {
    const players = roster(at);
    expect(players).toHaveLength(500);
    expect(new Set(players.map((p) => p.id)).size).toBe(500);
    expect(new Set(players.map((p) => p.externalIds!.laliga)).size).toBe(500);
    for (const c of REAL_CLUBS)
      expect(players.filter((p) => p.realClubId === c.id)).toHaveLength(25);
    for (const p of players) {
      expect(p.simulated).toBe(false);
      expect(p.fullName).toBeTruthy();
      expect(p.season).toBe('2026/27');
      expect(p.source).toMatch(/^https:\/\/www.laliga.com\/jugador\//);
      const old = historical.find((o) => o.id === p.id);
      if (old) {
        expect(old.simulated).toBe(false);
        expect(old.name).toBe(p.name);
      }
    }
    expect(catalog.sources).toHaveLength(20);
    expect(catalog.sources.every((s) => /^[a-f0-9]{64}$/.test(s.sha256))).toBe(true);
  });
  it('conserva instantáneas históricas completas sin reasignar identidades', () => {
    const state = generatedDemo('initial', at, 'legacy-fixture');
    state.players = structuredClone(historical) as typeof state.players;
    state.marketPlayers = [];
    state.draft.queue = [];
    expect(readSnapshot(snapshotOf(state, 'generated-local-demo')).state.players).toEqual(
      historical,
    );
  });
  it('confirma Antony en Porcinos y Fermín en Cholo, sin pendientes ni duplicados', () => {
    expect(previewFantasy(fantasy).problems).toEqual([]);
    expect(fantasy.teams[0].starters.find((p) => p.playerId === 'barcelona-14')).toMatchObject({
      realClubId: 'barcelona',
      reference: 'Fermín López',
    });
    expect(fantasy.teams[1].starters[0]).toMatchObject({
      playerId: 'betis-17',
      realClubId: 'betis',
      fullName: 'Antony Matheus dos Santos',
      position: 'DEL',
    });
    expect(fantasySnapshot(fantasy, at, 'final-fantasy').state.contracts).toHaveLength(58);
    const pending = structuredClone(fantasy) as any;
    pending.teams[1].starters[0].playerId = null;
    expect(() => fantasySnapshot(pending, at, 'pending')).toThrow('pendiente');
  });
  it('genera contratos, capacidad y convocatorias válidas; reserva el sexto club vacío', () => {
    const fixture = completedTestFantasy(),
      source = fantasySnapshot(fixture, at, 'complete-test-only');
    expect(source.sha256).toBe(fantasySnapshot(fixture, at, 'complete-test-only').sha256);
    expect(source.state.contracts).toHaveLength(58);
    expect(
      source.state.contracts.filter((ct) => ct.clubId === source.state.clubs[5].id),
    ).toHaveLength(0);
    for (const c of source.state.clubs)
      expect(callCost(source.state, c).cost).toBeLessThan(c.resources.money);
    const duplicate = structuredClone(fixture);
    duplicate.teams[1].starters[1] = duplicate.teams[0].starters[0];
    expect(() => fantasySnapshot(duplicate, at, 'duplicate')).toThrow('duplicado');
    const wrong = structuredClone(fixture);
    wrong.teams[0].starters[0].fullName = 'Otra persona';
    expect(() => fantasySnapshot(wrong, at, 'wrong')).toThrow('identidad');
  });
});
describe('v06 economía y casillas persistentes', () => {
  it.each([
    [1000, '1.000€'],
    [125000, '125.000€'],
    [11925070, '11.925.070€'],
    [1250.5, '1.250,50€'],
  ])('formatea %s euros', (value, text) => {
    expect(formatEuros(value as number)).toBe(text);
    expect(formatMoney((value as number) * 100)).toBe(text);
  });
  it('valida vacío, letras, céntimos, mínimos, máximos y fondos sin perder el dato', () => {
    expect(parseMoneyInput('').error).toContain('Indica');
    expect(parseMoneyInput('hola').error).toContain('numérico');
    expect(parseMoneyInput('1.250,50').cents).toBe(125050);
    expect(parseMoneyInput('1250.5').cents).toBe(125050);
    expect(parseMoneyInput('1.000', { min: 200000 }).error).toContain('2.000€');
    expect(parseMoneyInput('7.000.000', { available: 620000000 }).error).toContain('6.200.000€');
    expect(parseMoneyInput('100', { max: 999 }).error).toContain('máximo');
    expect(amountProblem(1.2)).toContain('numérico');
  });
  it('no revela el disponible del comprador al aceptar un acuerdo sin fondos', () => {
    const state = generatedDemo('advanced', at, 'trade-error-privacy');
    const [buyer, seller] = state.clubs;
    const buyerActor = { userId: buyer.userId, clubId: buyer.id, admin: true };
    const own = state.contracts.find((ct) => ct.clubId === buyer.id)!;
    execute(state, buyerActor, { type: 'sell', playerId: own.playerId });
    const target = state.contracts.find((ct) => ct.clubId === seller.id)!;
    execute(state, buyerActor, {
      type: 'negotiate',
      playerId: target.playerId,
      amount: 500_000_000,
    });
    buyer.resources.money = 123_456_789;
    const negotiation = state.negotiations.at(-1)!;
    expect(() =>
      execute(
        state,
        { userId: seller.userId, clubId: seller.id, admin: false },
        { type: 'respondTrade', id: negotiation.id, accept: true },
      ),
    ).toThrow('El comprador no tiene dinero disponible suficiente para completar este acuerdo.');
    expect(target.clubId).toBe(seller.id);
    expect(negotiation.status).toBe('open');
    expect(buyer.resources.money).toBe(123_456_789);
  });
  it('proyecta las mismas once calidades sin mutar y las mantiene al cambiar formación en servidor', () => {
    const s = generatedDemo('advanced', at, 'tactical-fixture'),
      c = s.clubs[0];
    c.facilities.pitch = 4;
    c.selection.starters.forEach((slot, i) => {
      slot.quality = i % 4;
      slot.unlockedQuality = i % 4;
    });
    const original = structuredClone(c.selection),
      qualities = original.starters.map((p) => p.quality);
    for (const f of FORMATION_CATALOG) {
      expect(tacticalSlots(c.selection, f).map((p) => p.quality)).toEqual(qualities);
      expect(c.selection).toEqual(original);
    }
    for (const f of FORMATION_CATALOG) {
      execute(
        s,
        { userId: c.userId, clubId: c.id, admin: true },
        { type: 'formation', formation: f.id },
      );
      expect(c.selection.starters.map((p) => p.quality)).toEqual(qualities);
      expect(c.selection.starters.map((p) => p.unlockedQuality)).toEqual(qualities);
      expect(c.selection.starters).toHaveLength(11);
    }
    expect(Object.keys(HELP).length).toBeGreaterThanOrEqual(30);
  });
});
describe('v06 imágenes y compatibilidad', () => {
  it('valida veinte WebP reales y sus PNG compatibles', () => {
    for (const slug of Object.values(CLUB_SLUGS)) {
      const bytes = readFileSync(`public/assets/futbol/escudos/${slug}.webp`);
      expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
      expect(bytes.toString('ascii', 8, 12)).toBe('WEBP');
      expect(imageDimensions(bytes).width).toBeGreaterThanOrEqual(64);
      expect(imageDimensions(bytes).height).toBeGreaterThanOrEqual(64);
      expect(existsSync('public/assets/futbol/fallback/escudo.png')).toBe(true);
    }
    expect(clubAsset('madrid')).toContain('realmadrid.webp');
  });
  it('distribuye solo PNG neutros de jugadores y conserva los recursos históricos', () => {
    expect(AUTHORIZED_PHOTOS).toHaveLength(0);
    expect(FOOTBALL_ASSETS).toHaveLength(500);
    for (const p of ALL_FOOTBALL_ASSETS) {
      const b = readFileSync('public' + p.photo);
      expect(b.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(playerAsset({ id: p.playerId, realClubId: p.clubId }).photo).toBe(p.photo);
    }
    for (const p of retired) {
      expect(existsSync('public' + p.file)).toBe(false);
      expect(existsSync(p.originalFile!)).toBe(false);
    }
  });
});
