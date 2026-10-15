/**
 * Flags the engine itself reads. Every other flag belongs to the cards, which set and test them freely.
 */

/** Pay swings up or down each round. */
export const FLAG_UNSTABLE_PAY = 'unstable_pay';

/** Mortgages cost less. */
export const FLAG_CHEAP_MORTGAGE = 'cheap_mortgage';

/** Set for good the day a business is sold, by order or through a card. */
export const FLAG_SOLD_BUSINESS = 'sold_business';
/** The boss said yes to working from home, whatever the job and the rung. */
export const FLAG_REMOTE_WORK = 'remote_work';

/** Set by a serious illness: no insurer takes on health cover for it afterwards. */
export const FLAG_HAD_ILLNESS = 'had_illness';

export function hasFlag(flags: Record<string, number>, flag: string): boolean {
  return Object.hasOwn(flags, flag);
}
