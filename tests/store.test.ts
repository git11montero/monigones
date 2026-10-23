import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../server/store';
import { euro } from '../shared/config';
import { createGame } from '../shared/seed';
import { execute, reconcile } from '../shared/engine';
let store: Store, path: string;
beforeEach(() => {
  path = mkdtempSync(join(tmpdir(), 'crown-test-'));
  store = new Store(join(path, 'test.sqlite'), true);
});
afterEach(() => {
  store.close();
  rmSync(path, { recursive: true, force: true });
});
describe('transacciones y persistencia del servidor', () => {
  it('persiste los cambios tras cerrar y volver a abrir SQLite', () => {
    const s = store.getState('demo1');
    const daily = s.daily[0];
    store.dispatch('demo1', { type: 'daily', id: daily.id }, 'persist-test');
    store.close();
    store = new Store(join(path, 'test.sqlite'), true);
    expect(store.getState('demo1').state.clubs[0].dailyDone).toContain(daily.id);
  });
  it('deduplica peticiones económicas con una clave de idempotencia', () => {
    const before = store.getState('demo1');
    const command = { type: 'build', target: 'hq' };
    const first = store.dispatch('demo1', command, 'same-key');
    const second = store.dispatch('demo1', command, 'same-key');
    expect(second.state.clubs[0].resources.money).toBe(first.state.clubs[0].resources.money);
    expect(second.state.jobs).toHaveLength(1);
    expect(() => store.dispatch('demo1', { type: 'build', target: 'stadium' }, 'same-key')).toThrow(
      'idempotencia',
    );
  });
  it('revierte una operación inválida sin tocar saldo ni estado', () => {
    const before = store.getState('demo1');
    expect(() =>
      store.dispatch('demo1', { type: 'build', target: 'stadium' }, 'invalid-key'),
    ).toThrow();
    const after = store.getState('demo1');
    expect(after.state.clubs[0].resources.money).toBe(before.state.clubs[0].resources.money);
    expect(after.state.jobs).toHaveLength(0);
  });
  it('serializa pujas simultáneas en una subasta y adjudica una sola vez', async () => {
    const m = store.membership('demo1')!;
    const s = store.getLeague(m.league_id);
    s.contracts = [];
    store.save(s);
    store.dispatch('demo1', { type: 'specialAuction' }, 'open-auction');
    const opened = store.getState('demo1');
    const auction = opened.state.auctions[0],
      p = opened.state.players.find((p) => p.id === auction.playerId)!;
    const a = Math.max(p.value, euro(100000));
    const attempts = await Promise.allSettled([
      Promise.resolve().then(() =>
        store.dispatch(
          'demo1',
          { type: 'auctionBid', id: auction.id, amount: a },
          'auction-user-1',
        ),
      ),
      Promise.resolve().then(() =>
        store.dispatch(
          'demo2',
          { type: 'auctionBid', id: auction.id, amount: a + euro(100000) },
          'auction-user-2',
        ),
      ),
    ]);
    expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(2);
    store.dispatch('demo1', { type: 'advance', step: 'jobs' }, 'no-job-advance', true);
    const closedState = store.getLeague(m.league_id);
    reconcile(closedState, closedState.auctions[0].endsAt + 1);
    const owned = closedState.contracts.filter((ct) => ct.playerId === p.id);
    expect(owned).toHaveLength(1);
    expect(owned[0].clubId).toBe(closedState.clubs[1].id);
    const balance = closedState.clubs[1].resources.money;
    reconcile(closedState, closedState.now);
    expect(closedState.clubs[1].resources.money).toBe(balance);
  });
  it('deniega reloj de pruebas para usuarios normales incluso enviando la acción', () => {
    expect(() =>
      store.dispatch('demo2', { type: 'advance', step: 'day' }, 'unauthorized', true),
    ).toThrow();
    expect(() =>
      store.dispatch('demo1', { type: 'advance', step: 'day' }, 'disabled-admin', false),
    ).toThrow();
  });
  it('registro, hash de contraseña, sesiones revocables y ligas privadas', () => {
    const user = store.createUser('ana@example.com', 'MiClubSeguro123', 'Ana');
    expect(() => store.login(user.email, 'incorrecta')).toThrow();
    expect(store.login(user.email, 'MiClubSeguro123').id).toBe(user.id);
    const token = store.session(user.id);
    expect(store.user(token)?.id).toBe(user.id);
    store.logout(token);
    expect(store.user(token)).toBeUndefined();
    const league = store.createLeague(user, 'Liga de pruebas', 'Club de Ana', 'madrid', '#bb9966');
    const other = store.createUser('luis@example.com', 'MiClubSeguro456', 'Luis');
    expect(() => store.joinLeague(other, 'inventada', 'Club Luis', 'betis', '#bb9966')).toThrow();
    const joined = store.joinLeague(other, league.state.invite, 'Club Luis', 'betis', '#bb9966');
    expect(joined.state.clubs).toHaveLength(2);
    expect(() => store.createLeague(other, 'Otra liga', 'Otro Club', 'betis', '#bb9966')).toThrow();
    expect(joined.state.invite).toBe('');
  });
});
describe('draft y subasta especial', () => {
  it('no admite pujas sin saldo y concede prima una sola vez al terminar draft', () => {
    const s = createGame(Date.now(), true);
    s.contracts = [];
    s.draft.active = true;
    s.draft.finished = false;
    const c = s.clubs[0],
      actor = { userId: c.userId, clubId: c.id, admin: true };
    execute(s, actor, { type: 'nextAuction' });
    const auction = s.auctions[0],
      p = s.players.find((p) => p.id === auction.playerId)!;
    expect(() =>
      execute(s, actor, { type: 'auctionBid', id: auction.id, amount: c.resources.money + 1 }),
    ).toThrow();
    execute(s, actor, {
      type: 'auctionBid',
      id: auction.id,
      amount: Math.max(p.value, euro(100000)),
    });
    reconcile(s, auction.endsAt + 1);
    const balance = c.resources.money;
    execute(s, actor, { type: 'finishDraft' });
    expect(c.resources.money).toBe(balance + euro(20000000));
    expect(() => execute(s, actor, { type: 'finishDraft' })).toThrow();
    expect(c.selection.starters.some((slot) => slot.playerId === null)).toBe(false); // demo conserva el once; una liga nueva empieza vacía
  });
  it('puja del último segundo de evento extiende el contador treinta segundos', () => {
    const s = createGame(Date.now(), true);
    s.contracts = [];
    const c = s.clubs[0],
      actor = { userId: c.userId, clubId: c.id, admin: true };
    execute(s, actor, { type: 'specialAuction' });
    const auction = s.auctions[0],
      p = s.players.find((p) => p.id === auction.playerId)!;
    s.now = auction.endsAt - 1000;
    execute(s, actor, {
      type: 'auctionBid',
      id: auction.id,
      amount: Math.max(p.value, euro(100000)),
    });
    expect(auction.endsAt - s.now).toBe(30000);
  });
});
describe('sincronización administrativa', () => {
  it('importa un catálogo validado, registra versión y deniega a otros presidentes', () => {
    const command = {
      type: 'importSports',
      payload: {
        version: 'sync-test-1',
        players: [
          {
            id: 'import-test',
            name: 'Jugador Ficticio',
            realClubId: 'madrid',
            position: 'MED',
            value: 150000000,
            simulated: true,
          },
        ],
      },
    };
    const result = store.dispatch('demo1', command, 'sports-valid-1', true);
    expect(result.state.players.find((p) => p.id === 'import-test')?.value).toBe(150000000);
    expect(store.db.prepare('SELECT count(*) AS n FROM sync_logs').get()?.n).toBe(1);
    expect(() => store.dispatch('demo2', command, 'sports-denied-1', true)).toThrow();
  });
  it('revierte un catálogo entero si intenta reemplazar un futbolista con contrato', () => {
    const state = store.getState('demo1');
    const id = state.state.contracts[0].playerId;
    const command = {
      type: 'importSports',
      payload: {
        version: 'sync-invalid',
        players: [
          {
            id: 'never-imported',
            name: 'Jugador de Prueba',
            realClubId: 'madrid',
            position: 'MED',
            value: 150000000,
            simulated: true,
          },
          {
            id,
            name: 'No se puede editar',
            realClubId: 'madrid',
            position: 'MED',
            value: 150000000,
            simulated: true,
          },
        ],
      },
    };
    expect(() => store.dispatch('demo1', command, 'sports-rollback', true)).toThrow();
    expect(store.getState('demo1').state.players.some((p) => p.id === 'never-imported')).toBe(
      false,
    );
  });
});
