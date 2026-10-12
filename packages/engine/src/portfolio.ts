import { applyBp, isAmount, mulDiv } from './money';
import type { Cents } from './money';
import type { Content, Order, PlayerState, WorldState } from './types';

/** Running totals for the round, read later by the tax step. */
export interface RoundTally {
  realisedGains: Cents;
  pensionContribution: Cents;
  propertyPurchases: Cents;
}

export interface OrderContext {
  content: Content;
  /** The world whose prices and rates the player saw when deciding. */
  world: WorldState;
  round: number;
  tally: RoundTally;
}

export type PortfolioOrder = Extract<Order, { type: 'buy' | 'sell' | 'depositIn' | 'depositOut' | 'pensionIn' }>;

export const BAD_AMOUNT = 'amount must be a positive whole number of cents';

/** Returns the reason for rejection, or null when the order was executed. */
export function executePortfolioOrder(p: PlayerState, order: PortfolioOrder, ctx: OrderContext): string | null {
  if (!isAmount(order.amount)) return BAD_AMOUNT;

  switch (order.type) {
    case 'buy': {
      if (!ctx.content.assets.some((a) => a.id === order.assetId)) return `unknown asset: ${order.assetId}`;
      if (order.amount > p.cash) return 'not enough cash';
      const held = Object.hasOwn(p.positions, order.assetId) ? p.positions[order.assetId] : { value: 0, basis: 0 };
      p.positions[order.assetId] = { value: held.value + order.amount, basis: held.basis + order.amount };
      p.cash -= order.amount;
      return null;
    }
    case 'sell': {
      if (!Object.hasOwn(p.positions, order.assetId)) return `no position in ${order.assetId}`;
      const held = p.positions[order.assetId];
      if (order.amount > held.value) return 'cannot sell more than you hold';
      const basisSold =
        order.amount === held.value ? held.basis : Math.min(held.basis, mulDiv(held.basis, order.amount, held.value));
      ctx.tally.realisedGains += order.amount - basisSold;
      p.cash += order.amount;
      if (order.amount === held.value) {
        delete p.positions[order.assetId];
      } else {
        p.positions[order.assetId] = { value: held.value - order.amount, basis: held.basis - basisSold };
      }
      return null;
    }
    case 'depositIn': {
      if (order.amount > p.cash) return 'not enough cash';
      p.cash -= order.amount;
      p.deposit += order.amount;
      return null;
    }
    case 'depositOut': {
      if (order.amount > p.deposit) return 'not enough in the deposit';
      p.deposit -= order.amount;
      p.cash += order.amount;
      return null;
    }
    case 'pensionIn': {
      if (order.amount > p.cash) return 'not enough cash';
      p.cash -= order.amount;
      p.pension += order.amount;
      ctx.tally.pensionContribution += order.amount;
      return null;
    }
  }
}

/** Applies one round of price moves to everything held. */
export function growPortfolio(p: PlayerState, content: Content, after: WorldState): void {
  for (const id of Object.keys(p.positions)) {
    const held = p.positions[id];
    const value = Math.max(0, held.value + applyBp(held.value, after.assetReturnBp[id] ?? 0));
    if (value === 0) delete p.positions[id];
    else p.positions[id] = { value, basis: held.basis };
  }
  p.pension = Math.max(0, p.pension + applyBp(p.pension, after.assetReturnBp[content.pensionAssetId] ?? 0));
}
