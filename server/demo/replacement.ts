import { randomUUID } from 'node:crypto';
import source from '../../data/demo-fantasy-v06.json' with { type: 'json' };
import { invariant, dailyKey, nextMarket, capacity } from '../../shared/math.js';
import { callCost, facilityLimit, syncAttention } from '../../shared/engine.js';
import { formationAllowed, selectionFormation } from '../../shared/formations.js';
import { fantasySnapshot } from './fantasy.js';
import {
  configSchema,
  prepareDemo,
  summary,
  validateDemo,
  digest,
  type DemoConfig,
} from './state.js';
import { nextWake, type RpcTransport } from '../online/store.js';
import type { GameState } from '../../shared/types.js';
import { rebaseCheckpoint } from './state.js';
export { summary, digest };
export const REPLACED_DATA = [
  'fichajes',
  'edificios',
  'investigaciones',
  'dinero y reservas',
  'resultados y jornadas',
  'noticias',
  'chat',
  'contratos',
  'eventos y recompensas',
  'actividades',
  'patrocinios, conciertos y préstamos',
  'recibos de idempotencia',
];
export function replacementConfig(input: unknown): DemoConfig {
  const c = configSchema.parse(input);
  invariant(
    c.mode === 'advanced' &&
      c.startAt === 'now' &&
      !c.snapshot &&
      Object.entries(c.users).every(([k, v]) => k === 'demo1' && v === c.adminUserId),
    'REPLACE_CONFIG_REQUIRES_ADMIN_ONLY_AND_NOW',
  );
  return c;
}
export function newPlan(config: DemoConfig, at: number) {
  const plan = prepareDemo(
    config,
    fantasySnapshot(source, Date.parse(config.sourceAt!), config.seed),
    at,
  );
  validateAssigned(plan.state, plan.slots);
  return plan;
}
export function validateAssigned(s: GameState, slots: { slot: string; clubId: string }[]) {
  const copy = structuredClone(s);
  copy.adminId = 'demo1';
  for (const c of copy.clubs) {
    const slot = slots.find((r) => r.clubId === c.id);
    invariant(slot, 'REPLACE_CLUB_WITHOUT_SLOT');
    c.userId = slot.slot;
  }
  validateDemo(copy);
  for (const c of copy.clubs) {
    invariant(
      formationAllowed(selectionFormation(c.selection)!.id, c.facilities.pitch || 0),
      'REPLACE_FORMATION_LOCKED',
    );
    invariant(
      copy.contracts.filter((r) => r.clubId === c.id).length <= capacity(c),
      'REPLACE_ROSTER_CAPACITY',
    );
    invariant(
      c.selection.starters.every(
        (p) =>
          Number.isInteger(p.quality) &&
          p.quality >= 0 &&
          p.quality <= p.unlockedQuality &&
          p.unlockedQuality <= 3,
      ),
      'REPLACE_SLOT_QUALITY',
    );
    for (const [id, level] of Object.entries(c.facilities))
      invariant(level <= facilityLimit(c, id), 'REPLACE_FACILITY_CAPACITY');
    callCost(copy, c);
  }
}
export function restoredPlan(payload: any, now: number, sourceHash: string) {
  const s = rebaseCheckpoint(payload.game.state, now);
  validateAssigned(
    s,
    payload.slots.map((r: any) => ({ slot: r.slot, clubId: r.club_id })),
  );
  return { state: s, due: new Date(nextWake(s)).toISOString(), sourceHash };
}
export type Inspection = { now: number; fingerprint: string; current: any; backup: any | null };
export function comparison(before: GameState, after: GameState) {
  return {
    before: summary(before),
    after: summary(after),
    replaced: REPLACED_DATA,
    retained: [
      'identidad y credenciales Auth',
      'UUID de liga',
      'administrador',
      'otras ligas',
      'historial de operaciones y respaldos',
    ],
    pending: {
      jobs: before.jobs.length,
      auctions: before.auctions.filter((a) => a.status === 'open').length,
      activity: before.clubs.filter((c) => c.activity && !c.activity.claimedAt).length,
    },
    progress:
      before.processed.length ||
      before.transfers.length ||
      before.jobs.length ||
      before.ledger.length,
  };
}
export class ReplacementService {
  constructor(readonly rpc: RpcTransport) {}
  inspect(c: DemoConfig, restore: string | null = null) {
    return this.rpc.call<Inspection>('online_demo_replacement_inspect', {
      p_league: c.leagueId,
      p_admin: c.adminUserId,
      p_restore: restore,
    });
  }
  async preview(c: DemoConfig, restore: string | null = null) {
    const inspection = await this.inspect(c, restore);
    const plan = restore
      ? restoredPlan(inspection.backup.payload, inspection.now, inspection.backup.sha256)
      : newPlan(c, inspection.now);
    const others = [
      ...inspection.current.memberships,
      ...inspection.current.slots.filter((s: any) => s.user_id),
    ].filter((m: any) => m.user_id !== c.adminUserId);
    const problems = others.length ? ['REPLACE_OTHER_USERS'] : [];
    return {
      inspection,
      plan,
      problems,
      otherUsers: others.map((m: any) => ({ userId: m.user_id, clubId: m.club_id })),
      report: comparison(inspection.current.game.state, plan.state),
    };
  }
  async apply(
    c: DemoConfig,
    operation: string,
    preview: Awaited<ReturnType<ReplacementService['preview']>>,
    restore: string | null = null,
  ) {
    invariant(!preview.problems.length, preview.problems.join(', '));
    return this.rpc.call<any>('online_demo_replace', {
      p_league: c.leagueId,
      p_admin: c.adminUserId,
      p_operation: operation,
      p_expected: preview.inspection.fingerprint,
      p_spec: preview.plan,
      p_restore: restore,
    });
  }
  async backup(id: string) {
    return this.rpc.call<any>('online_demo_backup', { p_backup: id });
  }
  async verify(c: DemoConfig) {
    const i = await this.inspect(c),
      s = i.current.game.state as GameState;
    validateAssigned(
      s,
      i.current.slots.map((r: any) => ({ slot: r.slot, clubId: r.club_id })),
    );
    invariant(
      s.version === i.current.game.revision && s.id === c.leagueId && s.adminId === c.adminUserId,
      'REPLACE_INVALID_REVISION',
    );
    const admin = s.clubs.find((club) => club.userId === c.adminUserId);
    invariant(
      admin &&
        i.current.memberships.some(
          (m: any) => m.user_id === c.adminUserId && m.club_id === admin.id,
        ),
      'REPLACE_INVALID_MEMBERSHIP',
    );
    return {
      status: 'verified',
      league: c.leagueId,
      revision: s.version,
      resetId: s.resetId,
      report: summary(s),
    };
  }
}
export function localState(at: number, league: string, invite: string, version: number) {
  const state = structuredClone(
    fantasySnapshot(source, at, `monigones-default-fantasy-v06:${league}:${version}`).state,
  );
  state.id = league;
  state.invite = invite;
  state.version = version;
  state.privateRng = randomUUID();
  // This is an explicit reserved entity, with no local or Auth account/session.
  state.clubs[5].userId = `reserved-demo:${league}:demo6`;
  state.lastDaily = dailyKey(at);
  state.nextMarketAt = nextMarket(at);
  syncAttention(state);
  return state;
}
