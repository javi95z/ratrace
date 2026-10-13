import { applyBp, isAmount, mulDiv } from './money';
import type { Cents } from './money';
import { assetYieldBp, indexed } from './rates';
import { ownedOutsidePension, totalOwed } from './solvency';
import type { Content, Order, OrderContext, PlayerState, RejectReason, WorldState } from './types';

export type PortfolioOrder = Extract<Order, { type: 'buy' | 'sell' | 'depositIn' | 'depositOut' | 'pensionIn' }>;

/**
 * Sets, changes or ends the plan to buy an asset every round. Whether the asset may be bought is
 * judged as for a purchase; whether there will be cash for it is each round's to find out.
 */
export function executeSetPlan(p: PlayerState, order: Extract<Order, { type: 'setPlan' }>, ctx: OrderContext): RejectReason | null {
  if (order.amount !== 0 && !isAmount(order.amount)) return 'bad-amount';
  const at = p.plans.findIndex((plan) => plan.assetId === order.assetId);
  if (order.amount === 0) {
    if (at >= 0) p.plans.splice(at, 1);
    return null;
  }
  const asset = ctx.content.assets.find((a) => a.id === order.assetId);
  if (!asset) return 'unknown-asset';
  if ((asset.minFinanceSkill ?? 0) > p.life.financeSkill) return 'needs-finance-skill';
  if (at >= 0) p.plans[at].amount = order.amount;
  else p.plans.push({ assetId: order.assetId, amount: order.amount, invested: 0, rounds: 0 });
  return null;
}

/**
 * Runs the player's plans for the round, in the order they were made, each as a purchase like any
 * other. A plan the round cannot pay for buys nothing this once and stays: nothing is borrowed for it.
 */
export function runPlans(p: PlayerState, ctx: OrderContext): Array<{ assetId: string; amount: Cents; reason: RejectReason | null }> {
  return p.plans.map((plan) => {
    const reason = executePortfolioOrder(p, { type: 'buy', assetId: plan.assetId, amount: plan.amount }, ctx);
    if (reason === null) {
      plan.invested += plan.amount;
      plan.rounds += 1;
    }
    return { assetId: plan.assetId, amount: plan.amount, reason };
  });
}

/**
 * Returns the reason for rejection, or null when the order was executed.
 * A rejected order leaves the player and the tally untouched.
 */
export function executePortfolioOrder(p: PlayerState, order: PortfolioOrder, ctx: OrderContext): RejectReason | null {
  if (!isAmount(order.amount)) return 'bad-amount';

  switch (order.type) {
    case 'buy': {
      const asset = ctx.content.assets.find((a) => a.id === order.assetId);
      if (!asset) return 'unknown-asset';
      if ((asset.minFinanceSkill ?? 0) > p.life.financeSkill) return 'needs-finance-skill';
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
      const limits = pensionLimits(p, ctx.content, ctx.world, ctx.tally.pensionContribution);
      if (order.amount > p.cash) return 'not-enough-cash';
      if (order.amount > limits.underCap) return 'over-pension-limit';
      // The pension is protected in bankruptcy, so it may not be filled with money the player owes.
      if (order.amount > limits.solvent) return 'would-be-insolvent';
      p.cash -= order.amount;
      p.pension += order.amount;
      ctx.tally.pensionContribution += order.amount;
      return null;
    }
  }
}

/** The two limits on a pension contribution besides cash: what the round's cap still allows, and what leaves the player solvent outside the pension. */
function pensionLimits(p: PlayerState, content: Content, world: WorldState, paidIn: number): { underCap: number; solvent: number } {
  const roundSalary = indexed(p.salaryAnnual, world) * content.yearsPerRound;
  const cap = applyBp(roundSalary, content.pensionContributionCapBp);
  return { underCap: cap - paidIn, solvent: ownedOutsidePension(p) - totalOwed(p) };
}

/**
 * How much more may be paid into the pension this round, given what has already gone in.
 * It is worked out from the same limits the order is judged by, so the two cannot disagree:
 * exactly this much is accepted, and a cent more is refused.
 */
export function pensionRoom(p: PlayerState, content: Content, world: WorldState, paidIn: number): number {
  const limits = pensionLimits(p, content, world, paidIn);
  return Math.max(0, Math.min(p.cash, limits.underCap, limits.solvent));
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
