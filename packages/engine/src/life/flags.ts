/**
 * Flags the engine itself reads. Every other flag belongs to the cards, which set and test them freely.
 */

/** Pay swings up or down each round. */
export const FLAG_UNSTABLE_PAY = 'unstable_pay';

/** Mortgages cost less. */
export const FLAG_CHEAP_MORTGAGE = 'cheap_mortgage';

/** A life played in a game with friends, which may tease the others. Set by the server, never by a life of the content. */
export const FLAG_IN_ROOM = 'in_room';

/** Set for good the day a business is sold, by order or through a card. */
export const FLAG_SOLD_BUSINESS = 'sold_business';
/** The boss said yes to working from home, whatever the job and the rung. */
export const FLAG_REMOTE_WORK = 'remote_work';
/** Came back to the city the life began in richer than when they left: a triumph has been had. */
export const FLAG_CAME_HOME_RICH = 'came_home_rich';

/** Set by a serious illness: no insurer takes on health cover for it afterwards. */
export const FLAG_HAD_ILLNESS = 'had_illness';

/** Flags that belong to the city the player lives in (a landlord, a flat): their names end so, and a move lets them all go. */
export const HERE_SUFFIX = '_here';

export function hasFlag(flags: Record<string, number>, flag: string): boolean {
  return Object.hasOwn(flags, flag);
}
