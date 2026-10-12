export type Cents = number;
export type Bp = number;

export const BP = 10_000;

/** Math.round that never returns negative zero. */
export function round(x: number): number {
  return Math.round(x) + 0;
}

/** amount × bp / 10000, rounded to the nearest cent. */
export function applyBp(amount: Cents, bp: Bp): Cents {
  return round((amount * bp) / BP);
}

/** floor(a × b / c), for proportional splits. */
export function mulDiv(a: number, b: number, c: number): number {
  if (c === 0) throw new Error('mulDiv: division by zero');
  return Math.floor((a * b) / c) + 0;
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** True for a positive whole number of cents that adds and subtracts exactly. */
export function isAmount(x: unknown): x is Cents {
  return typeof x === 'number' && Number.isSafeInteger(x) && x > 0;
}
