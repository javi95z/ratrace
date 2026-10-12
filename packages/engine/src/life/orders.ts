import { careerOf } from '../lookup';
import { mulDiv } from '../money';
import { indexed } from '../rates';
import type { Cents } from '../money';
import type { CityDef, Content, FocusAction, InsuranceKind, ItemDef, Order, OrderContext, OwnedItem, PlayerState, RejectReason, WorldState } from '../types';
import { INSURANCE_KINDS } from './derive';

export const FOCUS_ACTIONS: readonly FocusAction[] = ['overtime', 'studyCareer', 'jobHunt'];

export type LifeOrder = Extract<
  Order,
  { type: 'focus' | 'buyItem' | 'sellItem' | 'setLifestyle' | 'setRentTier' | 'setInsurance' | 'moveCity' }
>;

/** Focus points the player can still spend this round. */
export function focusLeft(p: PlayerState): number {
  return Math.max(0, p.life.focusBase - p.life.focusUsed);
}

function executeFocus(p: PlayerState, action: FocusAction, ctx: OrderContext): RejectReason | null {
  if (!FOCUS_ACTIONS.includes(action)) return 'unknown-action';
  if (p.life.career === null) return 'no-job';
  if (ctx.tally.focusActions.includes(action)) return 'already-done';
  if (focusLeft(p) < 1) return 'no-focus';
  p.life.focusUsed += 1;
  ctx.tally.focusActions.push(action);
  // Study and job hunting pay off when the round has resolved. Overtime is paid in this round.
  if (action === 'overtime') p.life.salaryBoostPct += careerOf(ctx.content, p.life.career.id).overtimePct;
  return null;
}

/** What an item costs in the shop today, and what it is worth the moment it is bought. */
export function itemTerms(item: ItemDef, world: WorldState): { price: Cents; resale: Cents } {
  const price = indexed(item.price, world);
  return { price, resale: item.kind === 'durable' ? mulDiv(price, item.resaleStartPct, 100) : 0 };
}

/** What moving to a city costs today. */
export function moveCost(content: Content, world: WorldState, city: CityDef): Cents {
  return mulDiv(indexed(city.livingCostAnnual, world), content.life.moveCostPct, 100);
}

function executeBuyItem(p: PlayerState, itemId: string, ctx: OrderContext): RejectReason | null {
  const item = ctx.content.items.find((i) => i.id === itemId);
  if (!item) return 'unknown-item';
  if (item.cardOnly === true) return 'not-for-sale';
  if (p.life.items.some((owned) => owned.itemId === itemId)) return 'already-owned';
  const { price, resale } = itemTerms(item, ctx.world);
  if (price > p.cash) return 'not-enough-cash';
  p.cash -= price;
  ctx.tally.itemsBought += price;
  p.life.items.push({
    itemId,
    value: resale,
    roundsLeft: item.kind === 'experience' ? item.boostRounds : null,
  });
  if (!p.life.collection.includes(itemId)) p.life.collection.push(itemId);
  return null;
}

/**
 * True if something owned may be sold or cancelled. An experience is already spent, and what only
 * a card can give, a degree for one, is not the player's to sell. The order and the quote both ask here.
 */
export function canSellItem(content: Content, owned: OwnedItem): boolean {
  return owned.roundsLeft === null && !content.items.some((item) => item.id === owned.itemId && item.cardOnly === true);
}

/** Sells a durable for what it is worth today, or cancels a membership. */
function executeSellItem(p: PlayerState, itemId: string, ctx: OrderContext): RejectReason | null {
  const index = p.life.items.findIndex((owned) => owned.itemId === itemId);
  if (index < 0) return 'not-owned';
  const owned = p.life.items[index];
  if (!canSellItem(ctx.content, owned)) return 'cannot-sell';
  p.cash += owned.value;
  ctx.tally.itemsSold += owned.value;
  p.life.items.splice(index, 1);
  return null;
}

function executeMoveCity(p: PlayerState, cityId: string, ctx: OrderContext): RejectReason | null {
  const city = ctx.content.cities.find((c) => c.id === cityId);
  if (!city) return 'unknown-city';
  if (cityId === p.cityId) return 'same-city';
  if (p.life.movingTo !== null) return 'already-moving';
  if (focusLeft(p) < 1) return 'no-focus';
  const cost = moveCost(ctx.content, ctx.world, city);
  if (cost > p.cash) return 'not-enough-cash';
  p.cash -= cost;
  ctx.tally.movingCost += cost;
  p.life.focusUsed += 1;
  p.life.movingTo = cityId;
  return null;
}

/**
 * Executes an order about the player's life. Returns the reason for rejection, or null.
 * A rejected order changes nothing.
 */
export function executeLifeOrder(p: PlayerState, order: LifeOrder, ctx: OrderContext): RejectReason | null {
  switch (order.type) {
    case 'focus':
      return executeFocus(p, order.action, ctx);
    case 'buyItem':
      return executeBuyItem(p, order.itemId, ctx);
    case 'sellItem':
      return executeSellItem(p, order.itemId, ctx);
    case 'setLifestyle':
      if (order.tier !== 0 && order.tier !== 1 && order.tier !== 2 && order.tier !== 3) return 'bad-tier';
      if (order.tier < p.life.minLifestyleTier) return 'below-lifestyle-floor';
      p.lifestyleTier = order.tier;
      return null;
    case 'setRentTier':
      if (order.tier !== 0 && order.tier !== 1) return 'bad-tier';
      p.life.rentTier = order.tier;
      return null;
    case 'setInsurance':
      if (!INSURANCE_KINDS.includes(order.insurance as InsuranceKind)) return 'unknown-insurance';
      p.life.insurance[order.insurance] = order.on;
      return null;
    case 'moveCity':
      return executeMoveCity(p, order.cityId, ctx);
  }
}
