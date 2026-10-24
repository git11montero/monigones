import { describe, expect, it } from 'vitest';
import { createGame } from '../shared/seed';
import {
  execute,
  publicState,
  reconcile,
  effects,
  jobQuote,
  callCost,
  eventProgress,
} from '../shared/engine';
import { activityOffers, ACTIVITY_CATALOG, RARITIES } from '../shared/activities';
import { dailyKey, nextMarket } from '../shared/math';
import { DAY, RESEARCH, euro } from '../shared/config';
import { researchDetails, RESEARCH_STORIES } from '../shared/research-guide';
import { pendingAttention } from '../shared/attention';
import { Store } from '../server/store';
const now = Date.parse('2026-10-23T12:00:00Z');
function fixture() {
  const s = createGame(now),
    c = s.clubs[0];
  return {
    s,
    c,
    cmd: (command: { type: string; [key: string]: unknown }) =>
      execute(s, { userId: c.userId, clubId: c.id, admin: true }, command),
    view: () => publicState(s, c.userId),
  };
}
describe('actividades temporizadas', () => {
  it('ofrece tres propuestas estables, distintas y dentro de su duración de rareza', () => {
    const { s } = fixture();
    expect(activityOffers(s)).toEqual(activityOffers(structuredClone(s)));
    expect(new Set(activityOffers(s).map((a) => a.id)).size).toBe(3);
    expect(ACTIVITY_CATALOG.length).toBeGreaterThanOrEqual(20);
    for (const a of ACTIVITY_CATALOG) {
      const [min, max] = {
        common: [30, 60],
        uncommon: [60, 120],
        rare: [120, 240],
        epic: [240, 360],
        legendary: [360, 480],
      }[a.rarity];
      expect(a.duration / 60000).toBeGreaterThanOrEqual(min);
      expect(a.duration / 60000).toBeLessThanOrEqual(max);
    }
    expect(RARITIES.legendary.weight).toBe(1);
  });
  it('cobra al iniciar, bloquea otra actividad y solo premia después del tiempo del servidor', () => {
    const { s, c, cmd } = fixture(),
      a = activityOffers(s)[0],
      money = c.resources.money;
    cmd({ type: 'daily', id: a.id, startedAt: 0, endsAt: 0 });
    const event = s.events.find((e) => e.type === 'coach')!;
    expect(eventProgress(s, c, event.id)).toBe(0);
    const run = c.activity!;
    expect(c.resources.money).toBe(money - a.cost);
    expect(run.startedAt).toBe(now);
    expect(run.endsAt).toBe(now + a.duration);
    expect(() => cmd({ type: 'dailyStart', id: activityOffers(s)[1].id })).toThrow('actual');
    expect(() => cmd({ type: 'dailyClaim', id: run.id, now: run.endsAt + DAY })).toThrow(
      'terminado',
    );
    reconcile(s, run.endsAt);
    const before = c.resources[a.resource];
    cmd({ type: 'dailyClaim', id: run.id });
    expect(c.resources[a.resource]).toBeGreaterThanOrEqual(before);
    expect(c.activity?.claimedAt).toBe(s.now);
    expect(eventProgress(s, c, event.id)).toBe(1);
    const resources = structuredClone(c.resources),
      ledger = s.ledger.length;
    expect(() => cmd({ type: 'dailyClaim', id: run.id })).toThrow('pendiente');
    expect(c.resources).toEqual(resources);
    expect(s.ledger).toHaveLength(ledger);
    expect(c.dailyDone).toContain(a.id);
  });
  it('sobrevive a las 06:00, renueva las propuestas y no consume una oferta del día siguiente', () => {
    const { s, c, cmd } = fixture();
    reconcile(s, nextMarket(s.now) - 10 * 60000);
    const day = dailyKey(s.now);
    cmd({ type: 'dailyStart', id: activityOffers(s)[0].id });
    const run = structuredClone(c.activity!);
    reconcile(s, nextMarket(s.now) + 1);
    expect(dailyKey(s.now)).not.toBe(day);
    expect(c.activity).toEqual(run);
    expect(c.dailyDone).toEqual([]);
    reconcile(s, Math.max(s.now, run.endsAt));
    cmd({ type: 'dailyClaim', id: run.id });
    expect(c.dailyDone).toEqual([]);
    expect(c.activityHistory?.[0].offerDay).toBe(day);
    cmd({ type: 'dailyStart', id: activityOffers(s)[0].id });
    expect(c.activity?.id).not.toBe(run.id);
  });
  it('serializa dos inicios y dos cobros, también con claves distintas', async () => {
    const store = new Store(':memory:', true);
    try {
      const initial = store.getState('demo1'),
        id = initial.daily[0].id,
        money = initial.state.clubs[0].resources.money;
      const start = await Promise.allSettled(
        ['a', 'b'].map((key) =>
          Promise.resolve().then(() =>
            store.dispatch('demo1', { type: 'dailyStart', id }, 'start-' + key),
          ),
        ),
      );
      expect(start.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
      const active = store.getState('demo1');
      expect(active.state.clubs[0].resources.money).toBe(money - initial.daily[0].cost);
      store.dispatch('demo1', { type: 'advance', step: 'activity' }, 'advance', true);
      const results = await Promise.allSettled(
        ['a', 'b'].map((key) =>
          Promise.resolve().then(() =>
            store.dispatch(
              'demo1',
              { type: 'dailyClaim', id: active.state.clubs[0].activity!.id },
              'claim-' + key,
            ),
          ),
        ),
      );
      expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
      expect(store.getState('demo1').state.clubs[0].activityHistory).toHaveLength(1);
    } finally {
      store.close();
    }
  });
});
describe('avisos reales y persistencia por usuario', () => {
  it('una noticia tiene un único aviso y leer sus IDs resuelve solo esa información', () => {
    const { s, c, cmd, view } = fixture();
    s.news.push({
      id: 'new',
      at: s.now,
      category: 'Liga',
      title: 'Una noticia',
      subtitle: 'Prueba',
    });
    const items = view().notifications;
    expect(items.filter((n) => n.id === 'news:new')).toHaveLength(1);
    cmd({ type: 'notificationRead', ids: ['news:new', 'invented'] });
    expect(view().notifications.find((n) => n.id === 'news:new')?.status).toBe('resolved');
    expect(c.notificationReads?.invented).toBeUndefined();
    const rival = publicState(s, s.clubs[1].userId);
    expect(rival.notifications.find((n) => n.id === 'news:new')?.read).toBe(false);
    expect(rival.state.clubs[0].notificationReads).toBeUndefined();
  });
  it('el mercado consultado no reaparece hasta la renovación diaria', () => {
    const { s, cmd, view } = fixture();
    const market = view().notifications.find((n) => n.type === 'market')!;
    cmd({ type: 'notificationRead', ids: [market.id] });
    expect(pendingAttention(view().notifications, '/market').some((n) => n.type === 'market')).toBe(
      false,
    );
    reconcile(s, s.nextMarketAt + 1);
    expect(pendingAttention(view().notifications, '/market').some((n) => n.type === 'market')).toBe(
      true,
    );
  });
  it('una oferta recibida sigue pendiente aunque se lea y se elimina al resolverla', () => {
    const { s, c, cmd, view } = fixture();
    s.negotiations.push({
      id: 'offer',
      from: s.clubs[1].id,
      to: c.id,
      playerId: s.contracts.find((ct) => ct.clubId === c.id)!.playerId,
      amount: euro(100000),
      status: 'open',
      at: s.now,
    });
    const n = view().notifications.find((n) => n.type === 'negotiation')!;
    expect(n.mode).toBe('action');
    cmd({ type: 'notificationRead', ids: [n.id] });
    expect(view().notifications.find((x) => x.id === n.id)?.status).toBe('pending');
    cmd({ type: 'respondTrade', id: 'offer', accept: false });
    expect(view().notifications.some((x) => x.id === n.id)).toBe(false);
  });
  it('finalizar investigación produce un aviso hasta consultar el resultado', () => {
    const { s, c, cmd, view } = fixture();
    c.resources.development = 10000;
    cmd({ type: 'research', target: 'accounting' });
    reconcile(s, s.jobs[0].endsAt);
    const n = view().notifications.find(
      (n) => n.type === 'completion' && n.destination === '/research',
    )!;
    expect(n).toBeDefined();
    cmd({ type: 'notificationRead', ids: [n.id] });
    expect(view().notifications.find((x) => x.id === n.id)?.status).toBe('resolved');
  });
  it('una recompensa lista permanece pendiente al visitar actividades y se resuelve al cobrar', () => {
    const { s, c, cmd, view } = fixture();
    cmd({ type: 'dailyStart', id: activityOffers(s)[0].id });
    reconcile(s, c.activity!.endsAt);
    const n = view().notifications.find((n) => n.type === 'reward')!;
    cmd({ type: 'notificationRead', ids: [n.id] });
    expect(view().notifications.find((x) => x.id === n.id)?.status).toBe('pending');
    cmd({ type: 'dailyClaim', id: c.activity!.id });
    expect(view().notifications.some((x) => x.id === n.id)).toBe(false);
  });
  it('una sesión nueva conserva lecturas y ocultación y la liga rival queda aislada', () => {
    const store = new Store(':memory:', true);
    try {
      const first = store.getState('demo1'),
        n = first.notifications.find((n) => n.type === 'market')!;
      store.dispatch('demo1', { type: 'notificationRead', ids: [n.id] }, 'read');
      store.dispatch('demo1', { type: 'resourceVisibility', hidden: true }, 'hide');
      const token = store.session('demo1');
      expect(store.user(token)?.id).toBe('demo1');
      const reloaded = store.getState('demo1');
      expect(reloaded.notifications.find((x) => x.id === n.id)?.read).toBe(true);
      expect(reloaded.state.clubs[0].hideResources).toBe(true);
      expect(store.getState('demo2').state.clubs[0].hideResources).toBeUndefined();
    } finally {
      store.close();
    }
  });
});
describe('guía de investigación y cancelación', () => {
  it('explica las 49 tecnologías con textos específicos y no promete los dos editores pendientes', () => {
    const { c } = fixture();
    expect(RESEARCH).toHaveLength(49);
    expect(new Set(Object.values(RESEARCH_STORIES)).size).toBe(49);
    for (const r of RESEARCH) {
      expect(r.description).toBe(RESEARCH_STORIES[r.id]);
      expect(researchDetails(c, r).entries).toHaveLength(Object.keys(r.effects).length);
    }
    expect(
      researchDetails(
        c,
        RESEARCH.find((r) => r.id === 'kits')!,
      ).pending,
    ).toBe(true);
    expect(RESEARCH_STORIES.bank).toContain('no reduce intereses');
  });
  it('el ejemplo salarial coincide con el coste del motor, incluyendo acumulado y mínimo', () => {
    const { s, c } = fixture();
    c.research.salary = 2;
    const guide = researchDetails(
      c,
      RESEARCH.find((r) => r.id === 'salary')!,
    );
    expect(guide.entries[0].current).toBe('0,6 puntos porcentuales');
    expect(guide.entries[0].next).toBe('0,9 puntos porcentuales');
    c.selection.starters.forEach((x) => (x.playerId = null));
    c.selection.bench = [];
    const ct = s.contracts.find((ct) => ct.clubId === c.id)!,
      p = s.players.find((p) => p.id === ct.playerId)!;
    p.value = euro(10000000);
    ct.salaryBps = 200;
    c.selection.starters.find((x) => x.position === p.position)!.playerId = p.id;
    expect(callCost(s, c).cost).toBe(euro(140000));
    expect(guide.example).toContain('140');
    c.research.salary = 3;
    expect(callCost(s, c).cost).toBe(euro(110000));
    c.research.salary = 5;
    expect(effects(c).salary).toBe(150);
  });
  it('cancelar devuelve exactamente la mitad de los importes pagados y nunca cancela investigación', () => {
    const { s, c, cmd } = fixture();
    const quote = jobQuote(c, 'building', 'hq');
    cmd({ type: 'build', target: 'hq' });
    const money = c.resources.money,
      pd = c.resources.development;
    cmd({ type: 'cancelJob', id: s.jobs[0].id });
    expect(c.resources.money).toBe(money + Math.floor(quote.money / 2));
    expect(c.resources.development).toBe(pd + Math.floor(quote.development / 2));
    cmd({ type: 'research', target: 'accounting' });
    expect(() => cmd({ type: 'cancelJob', id: s.jobs[0].id })).toThrow('Solo');
    expect(s.jobs).toHaveLength(1);
  });
});
