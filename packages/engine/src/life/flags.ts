/**
 * Flags the engine itself reads. Every other flag belongs to the cards, which set and test them freely.
 */

/** Pay swings up or down each round. */
export const FLAG_UNSTABLE_PAY = 'unstable_pay';

/** Mortgages cost less. */
export const FLAG_CHEAP_MORTGAGE = 'cheap_mortgage';

export function hasFlag(flags: Record<string, number>, flag: string): boolean {
  return Object.hasOwn(flags, flag);
}
