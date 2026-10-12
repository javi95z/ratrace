import { applyBp, isAmount, mulDiv } from './money';
import { assetYieldBp, indexed } from './rates';
import type { Content, Order, OrderContext, PlayerState, RejectReason, WorldState } from './types';

export type PortfolioOrder = Extract<Order, { type: 'buy' | 'sell' | 'depositIn' | 'depositOut' | 'pensionIn' }>;

/**
 * Returns the reason for rejection, or null when the order was executed.
 * A rejected order leaves the player and the tally untouched.
 */
export function executePortfolioOrder(p: PlayerState, order: PortfolioOrder, ctx: OrderContext): RejectReason | null {
  if (!isAmount(order.amount)) return 'bad-amount';

  switch (order.type) {
    case 'buy': {
      if (!ctx.content.assets.some((a) => a.id === order.assetId)) return 'unknown-asset';
      if (order.amount > p.cash) return 'not-enough-cash';
      const held = Object.hasOwn(p.positions, order.assetId) ? p.positions[order.assetId] : { value: 0, basis: 0 };
      p.positions[order.assetId] = { value: held.value + order.amount, basis: held.basis + order.amount };
      p.cash -= order.amount;
      return null;
    }
    case 'sell': {
      if (!Object.hasOwn(p.positions, order.assetId)) return 'no-position';
      const held = p.positions[order.assetId];
      if (order.amount > held.value) return 'exceeds-position';
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
      if (order.amount > p.cash) return 'not-enough-cash';
      p.cash -= order.amount;
      p.deposit += order.amount;
      return null;
    }
    case 'depositOut': {
      if (order.amount > p.deposit) return 'exceeds-deposit';
      p.deposit -= order.amount;
      p.cash += order.amount;
      return null;
    }
    case 'pensionIn': {
      if (order.amount > p.cash) return 'not-enough-cash';
      const roundSalary = indexed(p.salaryAnnual, ctx.world) * ctx.content.yearsPerRound;
      const cap = applyBp(roundSalary, ctx.content.pensionContributionCapBp);
      if (ctx.tally.pensionContribution + order.amount > cap) return 'over-pension-limit';
      p.cash -= order.amount;
      p.pension += order.amount;
      ctx.tally.pensionContribution += order.amount;
      return null;
    }
  }
}

/**
 * Applies one round of price moves to everything held.
 * The pension also reinvests the yield its asset paid at the rates of `now`, untaxed.
 */
export function growPortfolio(p: PlayerState, content: Content, now: WorldState, after: WorldState): void {
  for (const id of Object.keys(p.positions)) {
    const held = p.positions[id];
    const value = Math.max(0, held.value + applyBp(held.value, after.assetReturnBp[id] ?? 0));
    if (value === 0) delete p.positions[id];
    else p.positions[id] = { value, basis: held.basis };
  }

  const pensionAsset = content.assets.find((a) => a.id === content.pensionAssetId);
  const yieldBp = pensionAsset ? assetYieldBp(pensionAsset, now) * content.yearsPerRound : 0;
  const priceMove = applyBp(p.pension, after.assetReturnBp[content.pensionAssetId] ?? 0);
  p.pension = Math.max(0, p.pension + priceMove + applyBp(p.pension, yieldBp));
}
