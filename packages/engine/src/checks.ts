import type { Recurring } from './types';

/**
 * Small predicates shared by content validation, start validation and the invariant check.
 * They take `unknown` because all three read data the engine did not write.
 */

/** Ids become object keys in state, so they must be plain lower-case names and never a built-in property name. */
const SAFE_ID = /^[a-z][a-z0-9_]*$/;
export const idAllowed = (id: unknown): id is string => typeof id === 'string' && SAFE_ID.test(id) && !(id in Object.prototype);

/** A whole number that adds and subtracts exactly, and is not negative zero. */
export const isWhole = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && !Object.is(x, -0);
export const isCount = (x: unknown): x is number => isWhole(x) && x >= 0;
export const isFiniteNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
export const notNegative = (x: unknown): x is number => isFiniteNumber(x) && x >= 0;
export const within = (x: unknown, lo: number, hi: number): x is number => isFiniteNumber(x) && x >= lo && x <= hi;
export const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** True for a well-formed recurring entry, whether it comes from a starting life, a card or a saved game. */
export function isRecurring(x: unknown): x is Recurring {
  if (!isRecord(x)) return false;
  return (
    idAllowed(x.tag) &&
    (x.kind === 'expense' || x.kind === 'passive') &&
    isCount(x.annual) &&
    (x.roundsLeft === null || (isCount(x.roundsLeft) && x.roundsLeft >= 1))
  );
}
