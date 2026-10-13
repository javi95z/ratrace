import { newId } from './ids';
import { FLAG_SOLD_BUSINESS } from './life/flags';
import { focusLeft } from './life/orders';
import { applyBp, isAmount, mulDiv } from './money';
import type { Cents } from './money';
import { indexed } from './rates';
import type { Business, BusinessTypeDef, Content, Order, OrderContext, PlayerState, RejectReason, WorldState } from './types';

/** The kind of a business, by id. Throws for one the content does not have: state is checked before it gets here. */
export function businessTypeOf(content: Content, typeId: string): BusinessTypeDef {
  const type = content.business.types.find((x) => x.id === typeId);
  if (!type) throw new Error(`unknown business type: ${typeId}`);
  return type;
}

/** What a round of a business comes to, at the economy of the given world. */
export interface BusinessRound {
  /** True when nobody ran it: no manager, and none of the owner's focus this round. */
  neglected: boolean;
  /** What the economy adds to its profit this round, or takes, in percent. */
  cyclePct: number;
  /** What it made, after the manager's share. Negative in a round it lost money. */
  profit: Cents;
  /** The part of the profit taken out as income. Nothing in a round of losses. */
  payout: Cents;
  /** What stays in the business: the rest of the profit, or the whole of a loss. */
  retained: Cents;
}

/**
 * The round of one business. Its profit is a yield on the capital in it, which thins out as the
 * business grows past the size its kind is made for, so that no shop compounds into an empire. The
 * economy then moves it, a manager takes a share of what is made, and a business nobody runs
 * makes only part of what it could.
 */
export function businessRound(business: Business, content: Content, world: WorldState): BusinessRound {
  const type = businessTypeOf(content, business.typeId);
  const rules = content.business;
  const scale = indexed(type.scale, world);
  // The capital that works: all of a small one, and less and less of each dollar on top.
  const working = mulDiv(business.capital, scale, scale + business.capital);
  const cyclePct = type.cyclePct[world.regime] ?? 0;
  const base = applyBp(working, type.yieldBp * content.yearsPerRound);
  let profit = mulDiv(base, 100 + cyclePct, 100);
  const neglected = !business.manager && !business.tended;
  if (profit > 0) {
    if (neglected) profit = mulDiv(profit, rules.neglectProfitPct, 100);
    if (business.manager) profit -= mulDiv(profit, type.managerPct, 100);
  }
  const payout = profit > 0 ? mulDiv(profit, business.payoutPct, 100) : 0;
  return { neglected, cyclePct, profit, payout, retained: profit - payout };
}

/** Everything the player's businesses pay out in the round. */
export function businessIncome(p: PlayerState, content: Content, world: WorldState): Cents {
  let total = 0;
  for (const business of p.businesses) total += businessRound(business, content, world).payout;
  return total;
}

/** Everything in the player's businesses. */
export function businessCapital(p: PlayerState): Cents {
  let total = 0;
  for (const business of p.businesses) total += business.capital;
  return total;
}

/** What a business would fetch if sold in the given world: its capital, less what a buyer takes off in a poor economy. Never more than is in it. */
export function businessSalePrice(business: Business, content: Content, world: WorldState): Cents {
  return mulDiv(business.capital, content.business.salePct[world.regime], 100);
}

/** Why the player may not open a business of a kind today, whatever the capital, or null when they may. */
export function businessLock(p: PlayerState, type: BusinessTypeDef, content: Content): RejectReason | null {
  if (type.minFinanceSkill > p.life.financeSkill) return 'needs-finance-skill';
  if (p.businesses.length >= content.business.maxBusinesses) return 'too-many-businesses';
  if (focusLeft(p) < 1) return 'no-focus';
  return null;
}

/** Opens a business with the given capital. It is run by its owner on the day it opens, and pays out half until told otherwise. */
export function openBusiness(p: PlayerState, typeId: string, capital: Cents, content: Content): Business {
  const business: Business = { id: newId(p, 'business'), typeId, capital, basis: capital, payoutPct: content.business.payouts[Math.floor(content.business.payouts.length / 2)], manager: false, tended: true };
  p.businesses.push(business);
  return business;
}

export type BusinessOrder = Extract<Order, { type: 'startBusiness' | 'investBusiness' | 'setBusiness' | 'tendBusiness' | 'sellBusiness' }>;

/** Executes an order about a business. Returns the reason for rejection, or null. A rejected order changes nothing. */
export function executeBusinessOrder(p: PlayerState, order: BusinessOrder, ctx: OrderContext): RejectReason | null {
  const { content, world } = ctx;
  if (order.type === 'startBusiness') {
    const type = content.business.types.find((x) => x.id === order.typeId);
    if (!type) return 'unknown-business-type';
    if (!isAmount(order.capital)) return 'bad-amount';
    const lock = businessLock(p, type, content);
    if (lock !== null) return lock;
    if (order.capital < indexed(type.minCapital, world)) return 'below-minimum';
    if (order.capital > p.cash) return 'not-enough-cash';
    p.cash -= order.capital;
    // Opening one takes the round's attention, and counts as running it.
    p.life.focusUsed += 1;
    openBusiness(p, type.id, order.capital, content);
    return null;
  }

  const business = p.businesses.find((x) => x.id === order.businessId);
  if (!business) return 'unknown-business';
  switch (order.type) {
    case 'investBusiness':
      if (!isAmount(order.amount)) return 'bad-amount';
      if (order.amount > p.cash) return 'not-enough-cash';
      p.cash -= order.amount;
      business.capital += order.amount;
      business.basis += order.amount;
      return null;
    case 'setBusiness':
      if (order.payoutPct !== undefined) {
        if (!content.business.payouts.includes(order.payoutPct)) return 'bad-payout';
        business.payoutPct = order.payoutPct;
      }
      if (order.manager !== undefined) business.manager = order.manager;
      return null;
    case 'tendBusiness':
      if (business.tended) return 'already-done';
      if (focusLeft(p) < 1) return 'no-focus';
      p.life.focusUsed += 1;
      business.tended = true;
      return null;
    case 'sellBusiness': {
      const price = businessSalePrice(business, content, world);
      p.cash += price;
      // What was made by leaving profit in is a gain like any other, taxed when it is taken.
      ctx.tally.realisedGains += price - business.basis;
      ctx.tally.businessesSold.push({ typeId: business.typeId, capital: business.capital, price });
      p.life.flags[FLAG_SOLD_BUSINESS] = ctx.round;
      p.businesses = p.businesses.filter((x) => x !== business);
      return null;
    }
  }
}

/**
 * What a round does to each business once it has paid out: what it kept goes into it, or what it
 * lost comes out; one nobody ran wears down besides; and what is left follows prices as the round
 * ends. A business with nothing left in it closes. Returns the kinds that closed.
 */
export function growBusinesses(p: PlayerState, content: Content, now: WorldState, after: WorldState): string[] {
  const closed: string[] = [];
  const kept: Business[] = [];
  for (const business of p.businesses) {
    const round = businessRound(business, content, now);
    let capital = business.capital + round.retained;
    if (round.neglected) capital -= applyBp(Math.max(0, capital), content.business.neglectDecayBp);
    capital = capital > 0 ? mulDiv(capital, after.priceLevel, now.priceLevel) : 0;
    if (capital <= 0) closed.push(business.typeId);
    else kept.push({ ...business, capital });
  }
  p.businesses = kept;
  return closed;
}

/** A business that is checked like any other state: used by the invariants and by the start of a life. */
export function businessBreaks(business: unknown, content: Content): string | null {
  const b = business as Partial<Business> | null;
  if (typeof b !== 'object' || b === null || typeof b.id !== 'string') return 'a business is not a record with an id';
  if (!content.business.types.some((type) => type.id === b.typeId)) return `business ${b.id} is of an unknown kind: ${String(b.typeId)}`;
  if (!isAmount(b.capital)) return `business ${b.id} has a capital that is not a positive whole number: ${String(b.capital)}`;
  if (!(typeof b.basis === 'number' && Number.isSafeInteger(b.basis) && b.basis >= 0)) return `business ${b.id} has a basis that is not a non-negative whole number: ${String(b.basis)}`;
  if (!content.business.payouts.includes(b.payoutPct as number)) return `business ${b.id} pays out a share the rules do not allow: ${String(b.payoutPct)}`;
  if (typeof b.manager !== 'boolean' || typeof b.tended !== 'boolean') return `business ${b.id} needs a manager and a tended flag`;
  return null;
}
