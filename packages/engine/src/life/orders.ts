import { loanRoom, takePersonalLoan } from '../debt';
import { careerOf } from '../lookup';
import { mulDiv } from '../money';
import { indexed } from '../rates';
import type { Cents } from '../money';
import type { CityDef, Content, FocusAction, InsuranceKind, ItemDef, Order, OrderContext, OwnedItem, PlayerState, RejectReason, WorldState } from '../types';
import { INSURANCE_KINDS, perksOf } from './derive';

export const FOCUS_ACTIONS: readonly FocusAction[] = ['overtime', 'studyCareer', 'jobHunt'];

export type LifeOrder = Extract<
  Order,
  { type: 'focus' | 'buyItem' | 'sellItem' | 'setLifestyle' | 'setRentTier' | 'setInsurance' | 'moveCity' }
>;

/** Focus points the player can still spend this round. */
export function focusLeft(p: PlayerState): number {
  return Math.max(0, focusTotal(p) - p.life.focusUsed);
}

/** Focus points the player has for this round in all: their own, and what a rest gave them. */
export function focusTotal(p: PlayerState): number {
  return p.life.focusBase + p.life.focusBonus;
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

/** True where the shops of a city sell the item. */
export function soldIn(item: ItemDef, cityId: string): boolean {
  return item.cities === undefined || item.cities.includes(cityId);
}

/** What the player owns that a move to the city would end: memberships that only mean something elsewhere. */
export function lapsingIn(content: Content, p: PlayerState, cityId: string): string[] {
  return p.life.items
    .filter((owned) => content.items.some((item) => item.id === owned.itemId && item.kind === 'membership' && !soldIn(item, cityId)))
    .map((owned) => owned.itemId);
}

/** What moving to a city costs this player today: less for someone with a car to carry their life in. */
export function moveCost(content: Content, world: WorldState, city: CityDef, p: PlayerState): Cents {
  const alone = mulDiv(indexed(city.livingCostAnnual, world), content.life.moveCostPct, 100);
  // A household is dearer to move than a suitcase: a partner and each child add their share.
  const family = (p.life.partner ? content.life.movePartnerPct : 0) + p.life.children.length * content.life.moveChildPct;
  const full = mulDiv(alone, 100 + family, 100);
  return mulDiv(full, Math.max(0, 100 - perksOf(p, content).moveCostOffPct), 100);
}

/**
 * The terms on which a shop sells an item on instalments today: what is paid down and what is
 * borrowed. Null for what no shop finances: only a thing that lasts, and costs enough to be worth
 * a contract, is sold this way.
 */
export function itemFinance(item: ItemDef, content: Content, world: WorldState): { down: Cents; loan: Cents } | null {
  const { price } = itemTerms(item, world);
  if (item.kind !== 'durable' || item.cardOnly === true || price < indexed(content.life.itemFinanceMinPrice, world)) return null;
  const down = mulDiv(price, content.life.itemFinanceDownPct, 100);
  return price > down ? { down, loan: price - down } : null;
}

/**
 * Why the player may not buy an item on instalments today, or null when they may. The loan is a
 * personal loan like any other: it needs a bank willing to lend and room under the usual limit.
 */
export function financeLock(p: PlayerState, plan: { down: Cents; loan: Cents }, content: Content, world: WorldState, round: number): RejectReason | null {
  if (round < p.bankruptUntilRound) return 'no-credit';
  if (plan.loan > loanRoom(p, content, world)) return 'over-loan-limit';
  if (plan.down > p.cash) return 'not-enough-cash';
  return null;
}

/**
 * Buys an item from the shop. Paid in full from cash, or, on instalments, with a share paid down
 * and the rest as a personal loan: the item is the player's at once either way, and so is the debt,
 * which stays even if the item is sold.
 */
function executeBuyItem(p: PlayerState, order: Extract<LifeOrder, { type: 'buyItem' }>, ctx: OrderContext): RejectReason | null {
  const { itemId } = order;
  const item = ctx.content.items.find((i) => i.id === itemId);
  if (!item) return 'unknown-item';
  if (item.cardOnly === true) return 'not-for-sale';
  if (!soldIn(item, p.cityId)) return 'not-sold-here';
  if (p.life.items.some((owned) => owned.itemId === itemId)) return 'already-owned';
  const { price, resale } = itemTerms(item, ctx.world);
  if (order.financed === true) {
    const plan = itemFinance(item, ctx.content, ctx.world);
    if (plan === null) return 'cannot-finance';
    const lock = financeLock(p, plan, ctx.content, ctx.world, ctx.round);
    if (lock !== null) return lock;
    takePersonalLoan(p, plan.loan, ctx.content, ctx.world).forItem = itemId;
  } else if (price > p.cash) return 'not-enough-cash';
  p.cash -= price;
  ctx.tally.itemsBought += price;
  p.life.items.push({
    itemId,
    value: resale,
    roundsLeft: item.kind === 'experience' ? item.boostRounds : null,
    paid: price,
    age: 0,
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
  const cost = moveCost(ctx.content, ctx.world, city, p);
  if (cost > p.cash) return 'not-enough-cash';
  p.cash -= cost;
  ctx.tally.movingCost += cost;
  p.life.focusUsed += 1;
  p.life.movingTo = cityId;
  p.life.movingTransfer = false;
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
      return executeBuyItem(p, order, ctx);
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
