import type { Content, Order, PlayerState } from '@ratrace/engine';

/** Status that lasts only a while: a thing whose status fades (a trip, a charter), and the rounds it still counts, this one among them. */
export interface Fading {
  itemId: string;
  roundsLeft: number;
}

/** Each thing the player holds whose status runs out, the soonest first. */
export function fadingStatus(p: PlayerState): Fading[] {
  return p.life.items
    .filter((owned): owned is typeof owned & { roundsLeft: number } => owned.roundsLeft !== null)
    .map((owned) => ({ itemId: owned.itemId, roundsLeft: owned.roundsLeft }))
    .sort((a, b) => a.roundsLeft - b.roundsLeft);
}

/**
 * The things whose status wore off with the round just played: those held for their last round as it began, and those bought in it
 * to last that round only, that the life no longer holds. `orders` are the round's, where they are known (a round played by the
 * clock in a game with friends has none to tell).
 */
export function wornOff(content: Content, before: PlayerState, orders: readonly Order[], after: PlayerState): string[] {
  const last = new Set(before.life.items.filter((owned) => owned.roundsLeft === 1).map((owned) => owned.itemId));
  for (const order of orders) {
    if (order.type !== 'buyItem') continue;
    const item = content.items.find((one) => one.id === order.itemId);
    if (item?.kind === 'experience' && item.boostRounds === 1) last.add(item.id);
  }
  const still = new Set(after.life.items.filter((owned) => owned.roundsLeft !== null).map((owned) => owned.itemId));
  return [...last].filter((itemId) => !still.has(itemId));
}
