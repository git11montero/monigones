import { createHash } from 'node:crypto';
import { createGame, makeClub } from '../../shared/seed.js';
import { execute, publicState, reconcile, syncAttention } from '../../shared/engine.js';
import { invariant } from '../../shared/math.js';
import { REAL_CLUBS } from '../../shared/sports.js';
import type { Command, GameState } from '../../shared/types.js';
export interface OnlineUser {
  id: string;
  email: string;
  name: string;
}
export interface RpcTransport {
  call<T>(name: string, args?: Record<string, unknown>): Promise<T>;
}
export type Snapshot = {
  state: GameState;
  revision: number;
  now: number;
  presidents?: Record<string, string>;
  membership?: boolean;
  clubId?: string;
  lease?: string;
};
export function operationHash(command: unknown): string {
  const canonical = (value: any): any =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((k) => [k, canonical(value[k])]),
          )
        : value;
  return createHash('sha256')
    .update(JSON.stringify(canonical(command)))
    .digest('hex');
}
/** All scheduled boundaries. Manual activity rewards remain manual. */
export function nextWake(s: GameState): number {
  const round = s.rounds.find((r) => r.number === s.currentRound);
  const times = [
    s.nextMarketAt,
    ...s.jobs.map((j) => j.endsAt),
    ...s.auctions.filter((a) => a.status === 'open').map((a) => a.endsAt),
    ...s.clubs.flatMap((c) =>
      c.activity && !c.activity.claimedAt && c.activity.endsAt > s.now ? [c.activity.endsAt] : [],
    ),
    ...s.concerts.flatMap((c) => [c.startsAt, c.endsAt].filter((t) => t > s.now)),
  ];
  if (round && !s.draft.active) {
    if (!s.processed.includes(`lock:${s.season}:${round.number}`)) times.push(round.locksAt);
    for (const match of round.matches)
      if (match.status === 'scheduled') times.push(match.startsAt);
      else if (match.status === 'live') times.push(match.endsAt);
  }
  return Math.min(...times);
}
function prepare(s: GameState, snapshot: Snapshot) {
  // Neither a body timestamp nor the browser's clock reaches the reducer.
  invariant(!s.timeOffset, 'La liga online no admite un reloj de simulación.');
  reconcile(s, Math.max(s.now, snapshot.now));
  syncAttention(s);
}
function view(snapshot: Snapshot, user: string) {
  const result = publicState(snapshot.state, user);
  for (const c of result.state.clubs)
    c.presidentName = c.presidentName || snapshot.presidents?.[c.userId] || 'Presidente';
  return result;
}
export class PostgresStore {
  constructor(readonly rpc: RpcTransport) {}
  async profile(user: OnlineUser) {
    await this.rpc.call('online_profile', { p_user: user.id, p_name: user.name });
  }
  async rate(user: string, bucket: 'read' | 'command' | 'join') {
    invariant(
      await this.rpc.call<boolean>('online_rate', {
        p_user: user,
        p_bucket: bucket,
        p_max: bucket === 'join' ? 12 : bucket === 'read' ? 120 : 180,
      }),
      'Demasiadas peticiones. Espera un minuto.',
    );
  }
  async load(user: string, invite?: string) {
    return this.rpc.call<Snapshot>('online_load', { p_user: user, p_invite: invite || null });
  }
  private async commit(
    snapshot: Snapshot,
    user?: string,
    key?: string,
    hash?: string,
    join = false,
  ) {
    const s = snapshot.state;
    s.version = Math.max(s.version, snapshot.revision + 1);
    syncAttention(s);
    return this.rpc.call<'committed' | 'conflict' | 'duplicate'>('online_commit', {
      p_league: s.id,
      p_expected: snapshot.revision,
      p_state: s,
      p_due: new Date(nextWake(s)).toISOString(),
      p_user: user || null,
      p_key: key || null,
      p_hash: hash || null,
      p_join: join,
    });
  }
  private async retry(attempt: number) {
    invariant(attempt < 15, 'Hay muchas acciones simultáneas. Reintenta con la misma clave.');
    await new Promise((resolve) => setTimeout(resolve, Math.min(150, 5 * (attempt + 1))));
  }
  async getState(user: string) {
    for (let attempt = 0; ; attempt++) {
      const snapshot = await this.load(user);
      invariant(snapshot.membership, 'Todavía no perteneces a una liga.');
      const due = nextWake(snapshot.state) <= snapshot.now;
      prepare(snapshot.state, snapshot);
      if (!due || (await this.commit(snapshot)) === 'committed') return view(snapshot, user);
      await this.retry(attempt);
    }
  }
  async dispatch(user: string, command: Command, key: string, generation?: string) {
    invariant(/^[a-zA-Z0-9-]{8,100}$/.test(key), 'Falta una clave de idempotencia válida.');
    const hash = operationHash(command);
    let firstGeneration: string | undefined;
    for (let attempt = 0; ; attempt++) {
      const snapshot = await this.load(user);
      invariant(snapshot.membership, 'No perteneces a una liga.');
      const currentGeneration = snapshot.state.resetId || snapshot.state.id;
      firstGeneration ??= currentGeneration;
      invariant(
        firstGeneration === currentGeneration &&
          (!snapshot.state.resetId || generation === currentGeneration),
        'La demo ha cambiado. Actualiza la partida antes de volver a enviar esta acción.',
      );
      const prior = await this.rpc.call<{ hash: string; league: string } | null>('online_receipt', {
        p_user: user,
        p_key: key,
      });
      if (prior) {
        invariant(
          prior.hash === hash && prior.league === snapshot.state.id,
          'La clave de idempotencia ya se utilizó con otra acción.',
        );
        return this.getState(user);
      }
      prepare(snapshot.state, snapshot);
      invariant(
        command.type !== 'advance' && command.type !== 'importSports',
        'Los controles de pruebas solo están disponibles en el modo local.',
      );
      const club = snapshot.state.clubs.find((c) => c.userId === user);
      invariant(club, 'No perteneces a esta liga.');
      execute(
        snapshot.state,
        { userId: user, clubId: club.id, admin: snapshot.state.adminId === user },
        command,
      );
      const status = await this.commit(snapshot, user, key, hash);
      if (status === 'committed') return view(snapshot, user);
      if (status === 'duplicate') return this.getState(user);
      await this.retry(attempt);
    }
  }
  async createLeague(user: OnlineUser, input: Record<string, unknown>) {
    const { clubName, favorite, color } = clubInput(input);
    invariant(
      typeof input.name === 'string' && input.name.length >= 3 && input.name.length <= 60,
      'El nombre de liga debe tener entre 3 y 60 caracteres.',
    );
    const current = await this.load(user.id);
    invariant(!current.membership, 'Solo puedes pertenecer a una liga activa.');
    const s = createGame(current.now, false, user.id, input.name);
    s.clubs.push(makeClub(user.id, clubName, favorite, color, s.now));
    syncAttention(s);
    await this.rpc.call('online_create', {
      p_user: user.id,
      p_state: s,
      p_due: new Date(nextWake(s)).toISOString(),
    });
    return this.getState(user.id);
  }
  async joinLeague(user: OnlineUser, input: Record<string, unknown>) {
    const { clubName, favorite, color } = clubInput(input);
    invariant(
      typeof input.invite === 'string' && /^[A-Z0-9]{12}$/i.test(input.invite.trim()),
      'Invitación no válida.',
    );
    for (let attempt = 0; ; attempt++) {
      const snapshot = await this.load(user.id, input.invite.trim());
      const s = snapshot.state;
      prepare(s, snapshot);
      invariant(
        s.draft.active && !s.auctions.some((a) => a.kind === 'draft'),
        'La liga ya ha comenzado el draft.',
      );
      invariant(s.clubs.length < 20, 'La liga está completa.');
      s.clubs.push(makeClub(user.id, clubName, favorite, color, s.now));
      const status = await this.commit(snapshot, user.id, undefined, undefined, true);
      if (status === 'committed') return this.getState(user.id);
      await this.retry(attempt);
    }
  }
  /** No browser needed. Claims expire; CAS checkpoints permit overlap and recovery. */
  async tick(limit = 10) {
    const due = await this.rpc.call<Snapshot[]>('online_claim_due', { p_limit: limit });
    const results: { league: string; ok: boolean; error?: string }[] = [];
    const started = Date.now();
    for (const claimed of due) {
      if (Date.now() - started > 45000) break; // Unprocessed claims expire in two minutes.
      let snapshot = claimed;
      try {
        for (let attempt = 0; ; attempt++) {
          prepare(snapshot.state, snapshot);
          if ((await this.commit(snapshot)) === 'committed') break;
          await this.retry(attempt);
          snapshot = await this.rpc.call<Snapshot>('online_load_league', {
            p_league: claimed.state.id,
          });
        }
        results.push({ league: claimed.state.id, ok: true });
      } catch (e) {
        const error = e instanceof Error ? e.message : 'Fallo del proceso';
        await this.rpc.call('online_tick_failed', {
          p_league: claimed.state.id,
          p_lease: claimed.lease,
          p_error: error,
        });
        results.push({ league: claimed.state.id, ok: false, error });
      }
    }
    return { claimed: due.length, processed: results.length, results };
  }
}
export function clubInput(input: Record<string, unknown>) {
  const { clubName, favorite, color } = input;
  invariant(
    typeof clubName === 'string' && clubName.trim().length >= 3 && clubName.length <= 40,
    'Nombre del club inválido.',
  );
  invariant(
    typeof favorite === 'string' && REAL_CLUBS.some((c) => c.id === favorite),
    'Equipo favorito inválido.',
  );
  invariant(typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color), 'Color inválido.');
  return { clubName: clubName.trim(), favorite, color };
}
