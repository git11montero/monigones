import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import { DAY, RULES } from './config.js';
import type { Club, GameState, Player, Resource } from './types.js';
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export const roundRatio = (n: number, numerator: number, denominator = 10000) =>
  Math.round((n * numerator) / denominator);
export function score(base: number, quality: number, additional: number) {
  return base <= 0
    ? base
    : roundRatio(base, 10000 + clamp(quality, 0, 2500) + clamp(additional, 0, 2500));
}
export function acceptance(value: number, offer: number, salaryBps: number, fame: number) {
  const rejection = clamp(
    50 - 100 * (offer / value - 1) - 10 * ((salaryBps - 200) / 100) - 0.05 * fame,
    2,
    50,
  );
  return {
    rejection,
    attraction: (0.85 * offer) / value + (0.13 * salaryBps) / 200 + (0.02 * fame) / 100,
  };
}
export function hash(seed: string) {
  let n = 2166136261;
  for (const c of seed) {
    n ^= c.charCodeAt(0);
    n = Math.imul(n, 16777619);
  }
  return n >>> 0;
}
export const random = (seed: string) => hash(seed) / 4294967296;
export function economicRandom(secret: string, context: string) {
  const digest = hmac(sha256, utf8ToBytes(secret), utf8ToBytes(context));
  return (
    new DataView(digest.buffer, digest.byteOffset, digest.byteLength).getUint32(0) / 4294967296
  );
}
export function dayKey(at: number) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}
export function madridSix(year: number, month: number, day: number) {
  const target = Date.UTC(year, month - 1, day, 6);
  let utc = target;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Madrid',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(utc);
    const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const wall = Date.UTC(+v.year, +v.month - 1, +v.day, +v.hour, +v.minute, +v.second);
    utc += target - wall;
  }
  return utc;
}
export function dailyKey(at: number) {
  const [y, m, d] = dayKey(at).split('-').map(Number);
  return at < madridSix(y, m, d) ? dayKey(Date.UTC(y, m - 1, d - 1, 12)) : dayKey(at);
}
export function nextMarket(at: number) {
  const [y, m, d] = dayKey(at).split('-').map(Number);
  const today = madridSix(y, m, d);
  if (today > at) return today;
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return madridSix(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}
export const seasonDay = (s: GameState) => Math.floor((s.now - s.seasonStartedAt) / DAY) + 1;
export const capacity = (c: Club) =>
  Math.min(RULES.maxCapacity, RULES.initialCapacity + (c.facilities.locker || 0));
export const playerOf = (s: GameState, id: string) => {
  const p = s.players.find((p) => p.id === id);
  invariant(p, 'Futbolista no encontrado.');
  return p;
};
export const owned = (s: GameState, c: Club) => s.contracts.filter((x) => x.clubId === c.id);
export const money = (n: number) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n / 100);
export const shortMoney = (n: number) =>
  Math.abs(n) >= 100000000
    ? `${(n / 100000000).toLocaleString('es-ES', { maximumFractionDigits: 2 })} M€`
    : money(n);
export const resourceName: Record<Resource, string> = {
  money: 'Euros',
  development: 'PD',
  medals: 'Medallas',
  fame: 'Fama',
  prestige: 'Prestigio',
  luck: 'Suerte',
  fans: 'Afición',
};
export function playerInitials(p: Player) {
  return p.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');
}
