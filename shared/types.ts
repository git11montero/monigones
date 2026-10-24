export type Position = 'POR' | 'DEF' | 'MED' | 'DEL';
export type Resource = 'money' | 'development' | 'medals' | 'fame' | 'prestige' | 'luck' | 'fans';
export type Tree = 'Finanzas' | 'Competición' | 'Relaciones';
export interface RealClub {
  id: string;
  name: string;
  short: string;
  color: string;
  source: string;
}
export interface Player {
  id: string;
  name: string;
  fullName?: string;
  realClubId: string;
  position: Position;
  value: number;
  valueHistory: { at: number; value: number }[];
  simulated: boolean;
  source?: string;
  verifiedAt?: string;
  avatar?: string;
  externalIds?: Record<string, string>;
  status: 'available' | 'injured' | 'doubtful';
}
export interface Contract {
  playerId: string;
  clubId: string;
  salaryBps: number;
  happiness: number;
  missed: number;
  clause: number;
  shieldUntil: number;
  endsAt: number;
  loan?: { from: string; untilRound: number };
}
export interface Slot {
  position: Position;
  playerId: string | null;
  quality: number;
  unlockedQuality: number;
}
export interface Selection {
  round: number;
  starters: Slot[];
  bench: string[];
  policy: 'economic' | 'standard' | 'premium';
  locked: boolean;
  valid: boolean;
  cost: number;
  snapshots: Record<string, { value: number; salary: number }>;
  used: string[];
  manual: number;
}
export interface Club {
  id: string;
  userId: string;
  name: string;
  color: string;
  favorite: string;
  coach: string;
  coachInventory: string[];
  resources: Record<Resource, number>;
  buildings: Record<string, number>;
  facilities: Record<string, number>;
  modules: string[];
  research: Record<string, number>;
  selection: Selection;
  totalPoints: number;
  roundPoints: number;
  dailyDone: string[];
  activity?: import('./activities.js').ActivityRun;
  activityHistory?: import('./activities.js').ActivityRun[];
  activityDays?: Record<string, import('./activities.js').ActivityDay>;
  notificationReads?: Record<string, number>;
  notificationEvents?: Record<string, { firstSeenAt: number; resolvedAt?: number }>;
  hideResources?: boolean;
  presidentName?: string;
  lastInstitution: number;
  wish: string[];
  trophies: Trophy[];
  eventClaims: string[];
  ticketPolicy: 'economic' | 'standard' | 'premium';
}
export interface Trophy {
  id: string;
  title: string;
  season: number;
  at: number;
  detail: string;
}
export interface Job {
  id: string;
  clubId: string;
  kind: 'building' | 'facility' | 'research' | 'academy';
  target: string;
  level: number;
  startedAt: number;
  endsAt: number;
  money: number;
  development: number;
}
export interface Bid {
  id: string;
  clubId: string;
  playerId: string;
  amount: number;
  salaryBps: number;
  createdAt: number;
  status: 'open' | 'won' | 'rejected' | 'lost' | 'withdrawn';
  rejection?: number;
  roll?: number;
  attraction?: number;
  marketId: number;
}
export interface Auction {
  id: string;
  playerId: string;
  kind: 'draft' | 'special';
  endsAt: number;
  highest: number;
  clubId: string | null;
  bids: { clubId: string; amount: number; at: number }[];
  status: 'open' | 'closed';
}
export interface Transaction {
  id: string;
  at: number;
  season: number;
  clubId: string;
  resource: Resource;
  amount: number;
  balance: number;
  reason: string;
  ref?: string;
}
export interface News {
  id: string;
  at: number;
  category: string;
  title: string;
  subtitle: string;
  playerId?: string;
  clubId?: string;
  ref?: string;
}
export interface Message {
  id: string;
  clubId: string;
  text: string;
  at: number;
}
export interface Match {
  id: string;
  home: string;
  away: string;
  startsAt: number;
  endsAt: number;
  status: 'scheduled' | 'live' | 'finished' | 'postponed';
  homeGoals?: number;
  awayGoals?: number;
}
export interface PlayerScore {
  playerId: string;
  points: number;
  minutes: number;
  goals: number;
  assists: number;
}
export interface Round {
  number: number;
  startsAt: number;
  locksAt: number;
  status: 'upcoming' | 'live' | 'finished';
  settled: boolean;
  matches: Match[];
  scores: Record<string, PlayerScore>;
  reports: Record<string, RoundReport>;
}
export interface RoundReport {
  points: number;
  salary: number;
  stadium: number;
  concerts: number;
  sponsors: number;
  merchandising: number;
  television: number;
  maintenance: number;
  substitutions: { out: string; in: string; manual: boolean }[];
  invalid: boolean;
  detail: {
    playerId: string | null;
    position: Position;
    base: number;
    quality: number;
    additional: number;
    final: number;
  }[];
}
export interface SponsorDeal {
  id: string;
  clubId: string;
  sponsorId: string;
  slot: string;
  startsAt: number;
  endsAt: number;
  daily: number;
  lastPaidDay: string;
}
export interface ConcertDeal {
  id: string;
  clubId: string;
  artistId: string;
  startsAt: number;
  endsAt: number;
  perRound: number;
}
export interface Loan {
  id: string;
  clubId: string;
  principal: number;
  repay: number;
  dueRound: number;
  settled: boolean;
}
export interface Negotiation {
  id: string;
  from: string;
  to: string;
  playerId: string;
  offeredPlayerId?: string;
  amount: number;
  status: 'open' | 'accepted' | 'rejected' | 'countered';
  at: number;
  loanRounds?: number;
}
export interface Transfer {
  id: string;
  at: number;
  playerId: string;
  from: string | null;
  to: string | null;
  amount: number;
  kind: string;
}
export interface GameEvent {
  id: string;
  title: string;
  description: string;
  type: 'market' | 'development' | 'matchday' | 'sport' | 'coach' | 'auction';
  goal: number;
  reward: { money: number; development: number; medals: number };
  startsAt: number;
  endsAt: number;
}
export interface Archive {
  season: number;
  at: number;
  ranking: { id: string; name: string; points: number }[];
}
export interface GameState {
  privateRng?: string;
  version: number;
  id: string;
  name: string;
  invite: string;
  adminId: string;
  season: number;
  seasonStartedAt: number;
  seasonEndsAt: number;
  timeOffset: number;
  now: number;
  lastDaily: string;
  nextMarketAt: number;
  marketId: number;
  marketPlayers: string[];
  clubs: Club[];
  players: Player[];
  contracts: Contract[];
  jobs: Job[];
  bids: Bid[];
  auctions: Auction[];
  draft: { active: boolean; finished: boolean; queue: string[] };
  rounds: Round[];
  currentRound: number;
  ledger: Transaction[];
  news: News[];
  chat: Message[];
  sponsors: SponsorDeal[];
  concerts: ConcertDeal[];
  loans: Loan[];
  negotiations: Negotiation[];
  transfers: Transfer[];
  events: GameEvent[];
  archives: Archive[];
  processed: string[];
  audit: { at: number; action: string; actor: string; detail: string }[];
}
export interface Effect {
  salary?: number;
  sale?: number;
  sport?: number;
  sponsor?: number;
  construction?: number;
  secondQueue?: number;
  manual?: number;
  quality?: number;
  fameCap?: number;
  prestigeCap?: number;
  luck?: number;
  fans?: number;
  happiness?: number;
  maintenance?: number;
  wish?: number;
  wishDiscount?: number;
  concerts?: number;
  custom?: number;
  kits?: number;
}
export interface ResearchDef {
  id: string;
  name: string;
  description: string;
  tree: Tree;
  branch: number;
  row: number;
  maxLevel: number;
  requires: string[];
  buildingLevel: number;
  effects: Effect;
}
export interface BuildingDef {
  id: string;
  name: string;
  short: string;
  description: string;
  icon: string;
  max: number;
  x: number;
  y: number;
  color: string;
}
export interface FacilityDef {
  id: string;
  name: string;
  description: string;
  max: number;
}
export interface Actor {
  userId: string;
  clubId: string;
  admin: boolean;
}
export type Command = { type: string; [key: string]: unknown };

export interface Attention {
  id: string;
  eventId: string;
  type: string;
  destination: string;
  userId: string;
  leagueId: string;
  priority: 'normal' | 'important';
  mode: 'information' | 'action';
  read: boolean;
  status: 'pending' | 'resolved';
  at: number;
  count: number;
  title: string;
}
