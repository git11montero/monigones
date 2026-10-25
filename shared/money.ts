/** Money in the engine is always integer cents. User-entered amounts are euros. */
export const MAX_MONEY_CENTS = 1_000_000_000_000;
export function formatEuros(euros: number): string {
  if (!Number.isFinite(euros)) throw Error('Importe no finito.');
  const rounded = Math.round(euros * 100) / 100;
  return (
    new Intl.NumberFormat('es-ES', {
      useGrouping: 'always',
      minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(rounded) + '€'
  );
}
export function formatMoney(cents: number): string {
  return formatEuros(cents / 100);
}
export type MoneyLimits = { min?: number; max?: number; available?: number };
export function amountProblem(cents: unknown, limits: MoneyLimits = {}): string {
  if (typeof cents !== 'number' || !Number.isSafeInteger(cents))
    return 'Introduce un importe numérico con un máximo de dos decimales, por ejemplo 1.500.000€.';
  if (cents < (limits.min ?? 0))
    return `La oferta mínima para esta operación es de ${formatMoney(limits.min ?? 0)}.`;
  if (cents > (limits.max ?? MAX_MONEY_CENTS))
    return `La oferta supera el máximo permitido para esta operación: ${formatMoney(limits.max ?? MAX_MONEY_CENTS)}.`;
  if (limits.available !== undefined && cents > limits.available)
    return `No tienes suficiente dinero. Dispones de ${formatMoney(limits.available)} y has introducido ${formatMoney(cents)}.`;
  return '';
}
/** Accept Spanish grouping/decimal marks and ungrouped machine decimal input. */
export function parseMoneyInput(input: string, limits: MoneyLimits = {}) {
  let value = input.trim().replace(/€\s*$/, '').trim();
  if (!value) return { error: 'Indica cuánto dinero quieres ofrecer.', cents: undefined };
  if (/^[+-]?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(value))
    value = value.replaceAll('.', '').replace(',', '.');
  else if (/^[+-]?\d+(?:,\d{1,2})?$/.test(value)) value = value.replace(',', '.');
  else if (!/^[+-]?\d+(?:\.\d{1,2})?$/.test(value))
    return { error: 'Introduce un importe numérico, por ejemplo 1.500.000€.', cents: undefined };
  const cents = Math.round(Number(value) * 100);
  const error = amountProblem(cents, limits);
  return { cents, error };
}
