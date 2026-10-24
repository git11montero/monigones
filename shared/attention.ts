import {
  BUILDINGS,
  FACILITIES,
  RESEARCH,
  SPONSORS,
  DAY,
  MODULES,
  AD_SLOTS,
  ARTISTS,
} from './config';
import { dailyKey, seasonDay } from './math';
import { activityOffers } from './activities';
import type { Attention, Club, Effect, GameState } from './types';
/** One event has one identity. Ancestors aggregate destinations without cloning events. */
export function notifications(
  s: GameState,
  c: Club,
  ef: Required<Effect>,
  progress: Record<string, number>,
): Attention[] {
  const items: Attention[] = [];
  const add = (
    id: string,
    type: string,
    destination: string,
    title: string,
    at = s.now,
    action = false,
    important = false,
  ) => {
    const read = !!c.notificationReads?.[id];
    items.push({
      id,
      eventId: id,
      type,
      destination,
      title,
      at: c.notificationEvents?.[id]?.firstSeenAt ?? at,
      userId: c.userId,
      leagueId: s.id,
      read,
      priority: important ? 'important' : 'normal',
      mode: action ? 'action' : 'information',
      status: read && !action ? 'resolved' : 'pending',
      count: 1,
    });
  };
  for (const n of s.news) {
    // A completion has one event, linked directly to its department rather than counted twice as news.
    const own = n.clubId === c.id,
      complete = own && ['Investigación', 'Construcción'].includes(n.category);
    let destination = '/newspaper';
    if (complete) {
      const audit = s.audit.find(
        (a) =>
          a.actor === c.id &&
          a.action === 'job.complete' &&
          a.at === n.at &&
          n.subtitle.includes(a.detail.split(':')[1] || '\0'),
      );
      destination =
        n.category === 'Investigación'
          ? '/research'
          : audit?.detail.startsWith('facility:')
            ? '/building/stadium'
            : '/city';
      // Names in subtitles need not be technical IDs.
      if (n.category === 'Construcción') {
        const b = BUILDINGS.find((b) => n.subtitle.startsWith(b.name + ':'));
        destination = b
          ? `/building/${b.id}`
          : FACILITIES.some((f) => n.subtitle.startsWith(f.name + ':'))
            ? '/building/stadium'
            : '/academy';
      }
    }
    add(`news:${n.id}`, complete ? 'completion' : 'news', destination, n.title, n.at, false, own);
  }
  add(
    `market:${s.season}:${s.marketId}`,
    'market',
    '/market',
    'Nuevo catálogo de agentes libres',
    s.nextMarketAt - DAY,
  );
  for (const id of c.wish.filter((id) => s.marketPlayers.includes(id)))
    add(`wish:${s.marketId}:${id}`, 'wish', '/market', 'Un futbolista deseado está disponible');
  for (const b of s.bids.filter(
    (b) => b.clubId === c.id && ['won', 'lost', 'rejected'].includes(b.status),
  ))
    add(
      `bid:${b.id}:${b.status}`,
      'bid',
      '/market',
      b.status === 'won' ? 'Puja adjudicada' : 'Puja cerrada sin adjudicación',
      b.createdAt,
    );
  for (const t of s.transfers.filter(
    (t) => (t.from === c.id || t.to === c.id) && !t.kind.startsWith('Asignación'),
  ))
    add(
      `transfer:${t.id}`,
      'transfer',
      t.kind.toLowerCase().includes('claus') ? '/building/offices' : '/market',
      t.kind,
      t.at,
      false,
      t.from === c.id,
    );
  for (const n of s.negotiations.filter(
    (n) => (n.to === c.id && n.status === 'open') || (n.from === c.id && n.status === 'countered'),
  ))
    add(
      `trade:${n.id}:${n.status}`,
      'negotiation',
      '/trades',
      n.loanRounds ? 'Propuesta de cesión' : 'Negociación pendiente',
      n.at,
      true,
      true,
    );
  for (const a of s.auctions.filter((a) => a.kind === 'special' && a.status === 'open'))
    add(`auction:${a.id}`, 'auction', '/draft', 'Subasta especial abierta', a.endsAt - DAY);
  for (const ct of s.contracts.filter((ct) => ct.clubId === c.id)) {
    if (ct.happiness <= 25)
      add(
        `happiness:${s.season}:${s.currentRound}:${ct.playerId}`,
        'squad',
        '/squad',
        'Un futbolista necesita atención',
        s.now,
        true,
        true,
      );
    if (ct.shieldUntil > s.now && ct.shieldUntil - s.now < DAY)
      add(
        `shield:${ct.playerId}:${ct.shieldUntil}`,
        'shield',
        '/building/offices',
        'Un blindaje vence en menos de 24 horas',
        ct.shieldUntil - DAY,
        true,
      );
    if (s.players.find((p) => p.id === ct.playerId)?.status === 'injured')
      add(
        `injury:${s.currentRound}:${ct.playerId}`,
        'squad',
        '/squad',
        'Futbolista lesionado',
        s.now,
        true,
        true,
      );
  }
  const r = s.rounds.find((r) => r.number === s.currentRound);
  if (r && !s.draft.active) {
    if (!c.selection.locked && c.selection.starters.some((x) => !x.playerId))
      add(
        `lineup:${s.season}:${r.number}`,
        'squad',
        '/squad',
        'Completa tus once titulares',
        r.locksAt - DAY,
        true,
        true,
      );
    if (r.status === 'upcoming' && r.locksAt > s.now && r.locksAt - s.now < DAY)
      add(
        `round:${s.season}:${r.number}`,
        'round',
        '/matchday',
        'La jornada está a punto de comenzar',
        r.locksAt - DAY,
      );
    const potential = c.selection.bench.some(
      (id) =>
        !c.selection.used.includes(id) &&
        s.contracts.some((ct) => ct.playerId === id && ct.clubId === c.id),
    );
    if (r.status === 'live' && ef.manual > c.selection.manual && potential)
      add(
        `sub:${s.season}:${r.number}:${c.selection.manual}`,
        'squad',
        '/matchday',
        'Tienes cambios manuales disponibles',
        s.now,
        true,
      );
  }
  for (const b of BUILDINGS.filter(
    (b) =>
      b.max > (c.buildings[b.id] || 1) &&
      (b.id === 'hq' || (c.buildings[b.id] || 1) < c.buildings.hq),
  )) {
    if (!s.jobs.some((j) => j.clubId === c.id && ['building', 'facility'].includes(j.kind)))
      add(
        `upgrade:${b.id}:${c.buildings[b.id]}:${c.buildings.hq}`,
        'unlock',
        `/building/${b.id}`,
        `Puedes mejorar ${b.name}`,
      );
  }
  for (const f of FACILITIES) {
    const level = c.facilities[f.id] || 0,
      limit =
        f.id === 'locker'
          ? Math.min(18, c.buildings.stadium * 4)
          : f.id === 'bench'
            ? Math.min(7, c.buildings.stadium + 2)
            : Math.min(f.max, c.buildings.stadium);
    if (level < limit && (level < 2 || c.research.works))
      add(
        `facility:${f.id}:${level}:${limit}`,
        'unlock',
        '/building/stadium',
        `${f.name}: ampliación disponible`,
      );
  }
  for (const t of RESEARCH.filter(
    (t) =>
      (c.research[t.id] || 0) < t.maxLevel &&
      c.buildings.research >= t.buildingLevel &&
      t.requires.every((id) => c.research[id] > 0),
  ))
    add(
      `tech:${t.id}:${c.research[t.id] || 0}`,
      'unlock',
      '/research',
      `${t.name}: requisitos cumplidos`,
    );
  for (const m of MODULES.filter(
    (m) =>
      !c.modules.includes(m.id) &&
      (!m.research || c.research[m.research] > 0) &&
      seasonDay(s) >= m.day,
  ))
    add(`module:${m.id}`, 'unlock', '/building/offices', `${m.name}: módulo disponible`);
  const day = dailyKey(s.now),
    remaining = activityOffers(s).filter((a) => !c.dailyDone.includes(a.id));
  if (remaining.length) add(`daily:${day}`, 'daily', '/daily', 'Nuevas actividades del día', s.now);
  if (c.activity && !c.activity.claimedAt && c.activity.endsAt <= s.now)
    add(
      `activity:${c.activity.id}`,
      'reward',
      '/daily',
      'Recoge la recompensa de tu actividad',
      c.activity.endsAt,
      true,
      true,
    );
  for (const sponsor of SPONSORS.filter((x) => x.fame <= c.resources.fame))
    add(
      `sponsor:${day}:${sponsor.id}`,
      'commercial',
      '/marketing',
      `${sponsor.name}: propuesta disponible`,
    );
  for (const deal of s.sponsors.filter(
    (x) => x.clubId === c.id && x.endsAt > s.now && x.endsAt - s.now < DAY,
  ))
    add(
      `sponsor-expiry:${deal.id}`,
      'commercial',
      '/marketing',
      'Un patrocinio vence en menos de 24 horas',
      deal.endsAt - DAY,
    );
  for (const slot of AD_SLOTS.filter(
    (slot) =>
      !slot.startsWith('Videomarcador') ||
      Number(slot.at(-1)) <= Math.min(3, c.facilities.scoreboard || 0),
  ))
    if (!s.sponsors.some((d) => d.clubId === c.id && d.slot === slot && d.endsAt > s.now))
      add(`adslot:${slot}`, 'unlock', '/marketing', `${slot}: espacio publicitario disponible`);
  if (c.modules.includes('concerts') && ARTISTS.some((a) => a.level <= c.buildings.stadium))
    add(
      `concert:${Math.floor((s.now - s.seasonStartedAt) / (7 * DAY))}`,
      'concert',
      '/concerts',
      'Cartel de conciertos disponible',
    );
  for (const e of s.events.filter(
    (e) => e.startsAt <= s.now && e.endsAt > s.now && !c.eventClaims.includes(e.id),
  )) {
    const ready = (progress[e.id] || 0) >= e.goal;
    add(
      `event:${e.id}${ready ? ':ready' : e.endsAt - s.now < DAY ? ':ending' : ''}`,
      'event',
      '/events',
      ready
        ? 'Recompensa de evento disponible'
        : e.endsAt - s.now < DAY
          ? 'Un evento termina pronto'
          : e.title,
      e.startsAt,
      ready,
      ready || e.endsAt - s.now < DAY,
    );
  }
  for (const m of s.chat.filter((m) => m.clubId !== c.id))
    add(`chat:${m.id}`, 'chat', '/chat', 'Mensaje de la liga', m.at);
  for (const t of c.trophies) add(`trophy:${t.id}`, 'trophy', '/museum', t.title, t.at);
  for (const loan of s.loans.filter(
    (l) => l.clubId === c.id && !l.settled && l.dueRound <= s.currentRound + 1,
  ))
    add(
      `loan:${loan.id}`,
      'finance',
      '/finance',
      'Préstamo próximo al vencimiento',
      s.now,
      true,
      true,
    );
  for (const round of s.rounds.filter((r) => r.settled && r.reports[c.id]))
    add(
      `settled:${s.season}:${round.number}`,
      'finance',
      '/finance',
      `Jornada ${round.number}: liquidación completada`,
      round.startsAt,
    );
  if (c.resources.money < 0)
    add(`debt:${s.season}`, 'finance', '/finance', 'La tesorería está en deuda', s.now, true, true);
  return items.filter((x, i) => items.findIndex((y) => y.id === x.id) === i);
}
export const BUILDING_DESTINATIONS: Record<string, string[]> = {
  hq: ['/building/hq', '/daily', '/events'],
  stadium: ['/building/stadium'],
  offices: ['/building/offices', '/trades', '/concerts', '/marketing'],
  research: ['/research'],
  marketing: ['/marketing'],
  academy: ['/academy'],
  sport: ['/coaches', '/squad', '/market'],
  training: ['/training'],
  shop: ['/building/shop'],
  finance: ['/finance'],
  social: ['/fans', '/chat'],
  institution: ['/institution'],
  press: ['/newspaper'],
  museum: ['/museum'],
  competition: ['/league', '/matchday', '/draft'],
};
export function attentionDestinations(destination: string): string[] {
  if (destination.startsWith('/building/'))
    return [...new Set([destination, ...(BUILDING_DESTINATIONS[destination.split('/')[2]] || [])])];
  if (destination === '/more')
    return [
      ...Object.values(BUILDING_DESTINATIONS).flat(),
      ...Object.keys(BUILDING_DESTINATIONS).map((id) => `/building/${id}`),
    ];
  if (destination === '/city')
    return [
      ...Object.values(BUILDING_DESTINATIONS).flat(),
      ...Object.keys(BUILDING_DESTINATIONS).map((id) => `/building/${id}`),
    ].concat('/city');
  if (destination === '/league') return ['/league', '/matchday', '/draft'];
  if (destination === '/newspaper-chat') return ['/chat'];
  return [destination];
}
export function pendingAttention(items: Attention[], destination: string) {
  const paths = attentionDestinations(destination);
  return items.filter((n) => n.status === 'pending' && paths.includes(n.destination));
}
