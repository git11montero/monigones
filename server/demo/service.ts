import { invariant } from '../../shared/math.js';
import type { RpcTransport, Snapshot } from '../online/store.js';
import { publicState } from '../../shared/engine.js';
import {
  prepareDemo,
  summary,
  type DemoConfig,
  type DemoSnapshot,
  type DemoPlan,
} from './state.js';

export type DemoStatus = {
  now: number;
  exists: boolean;
  demo: null | {
    requestHash: string;
    sourceHash: string;
    mode: string;
    startAt: number;
    admin: string;
    revision: number;
    baselineRevision: number;
    modified: boolean;
    runs: number;
    slots: { slot: string; clubId: string; userId: string | null; presidentName: string }[];
  };
};
export type AuthLookup = (id: string) => Promise<void>;
export class DemoService {
  constructor(
    readonly rpc: RpcTransport,
    readonly checkAuthUser: AuthLookup,
  ) {}
  status(league: string) {
    return this.rpc.call<DemoStatus>('online_demo_inspect', { p_league: league });
  }
  async preview(config: DemoConfig, source: DemoSnapshot, bind = false) {
    const status = await this.status(config.leagueId);
    const start =
      status.demo?.startAt || (config.startAt === 'now' ? status.now : Date.parse(config.startAt));
    const plan = prepareDemo(config, source, start);
    const problems: string[] = [];
    if (status.exists && !status.demo) problems.push('DEMO_TARGET_OCCUPIED');
    if (
      status.demo &&
      (status.demo.requestHash !== plan.requestHash || status.demo.admin !== config.adminUserId)
    )
      problems.push('DEMO_CONFIG_MISMATCH');
    if (status.demo?.modified && !bind) problems.push('DEMO_MODIFIED');
    if (bind && !status.demo) problems.push('DEMO_NOT_INITIALIZED');
    if (!status.exists && Math.abs(start - status.now) > 240000) problems.push('DEMO_CLOCK_STALE');
    for (const slot of plan.slots) {
      if (!slot.userId) continue;
      await this.checkAuthUser(slot.userId);
      const current = await this.rpc.call<Snapshot>('online_load', { p_user: slot.userId });
      if (current.membership && current.state.id !== config.leagueId)
        problems.push(`DEMO_USER_ALREADY_MEMBER:${slot.slot}`);
      const prior = status.demo?.slots.find((s) => s.slot === slot.slot);
      if (prior?.userId && prior.userId !== slot.userId)
        problems.push(`DEMO_SLOT_ALREADY_OWNED:${slot.slot}`);
      if (!bind && status.demo && prior?.userId !== slot.userId) problems.push('DEMO_USE_BIND');
    }
    if (
      status.demo &&
      status.demo.slots.some((s) => s.userId && !config.users[s.slot as keyof typeof config.users])
    )
      problems.push('DEMO_CANNOT_REMOVE_USER');
    return { status, plan, problems: [...new Set(problems)], report: summary(plan.state) };
  }
  /** Caller must obtain explicit confirmation; SQL rechecks all invariants transactionally. */
  async apply(config: DemoConfig, source: DemoSnapshot, bind = false) {
    const preview = await this.preview(config, source, bind);
    invariant(!preview.problems.length, preview.problems.join(', '));
    if (bind)
      return this.rpc.call('online_demo_bind', {
        p_league: config.leagueId,
        p_admin: config.adminUserId,
        p_request_hash: preview.plan.requestHash,
        p_bindings: config.users,
      });
    return this.rpc.call('online_demo_apply', { p_spec: preview.plan });
  }
  async verify(config: DemoConfig, expected: DemoPlan) {
    const status = await this.status(config.leagueId);
    invariant(
      status.demo && status.demo.requestHash === expected.requestHash,
      'DEMO_NOT_INITIALIZED_OR_MISMATCH',
    );
    const snapshot = await this.rpc.call<Snapshot>('online_load_league', {
      p_league: config.leagueId,
    });
    invariant(
      snapshot.state.id === config.leagueId &&
        snapshot.state.adminId === config.adminUserId &&
        snapshot.state.version === snapshot.revision,
      'DEMO_INVALID_REVISION',
    );
    invariant(
      snapshot.state.players.length === 500 && snapshot.state.clubs.length === 6,
      'DEMO_INVALID_COUNTS',
    );
    for (const slot of status.demo.slots) {
      const club = snapshot.state.clubs.find((c) => c.id === slot.clubId);
      invariant(
        club && club.userId === (slot.userId || `reserved-demo:${config.leagueId}:${slot.slot}`),
        'DEMO_INVALID_MEMBERSHIP',
      );
      if (slot.userId) {
        await this.checkAuthUser(slot.userId);
        const membership = await this.rpc.call<Snapshot>('online_load', { p_user: slot.userId });
        invariant(
          membership.membership &&
            membership.clubId === slot.clubId &&
            membership.state.id === config.leagueId,
          'DEMO_INVALID_MEMBERSHIP',
        );
        // The same filtered view as the online API, without advancing clocks or writing.
        const view = publicState(membership.state, slot.userId);
        invariant(view.clubId === slot.clubId && !view.state.privateRng, 'DEMO_INVALID_API_VIEW');
      }
    }
    return {
      status: 'verified',
      league: config.leagueId,
      revision: snapshot.revision,
      modifiedSinceSeed: status.demo.modified,
      report: summary(snapshot.state),
    };
  }
}
