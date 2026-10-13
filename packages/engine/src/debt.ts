import { newId } from './ids';
import { FLAG_CHEAP_MORTGAGE, hasFlag } from './life/flags';
import { cityOf } from './lookup';
import { applyBp, BP, isAmount, mulDiv } from './money';
import type { Bp, Cents } from './money';
import { indexed } from './rates';
import { ownedOutsidePension, totalOwed } from './solvency';
import type { Content, Debt, Order, OrderContext, PlayerState, RejectReason, WorldState } from './types';

/** What this player pays above the policy rate on a mortgage, in bp. */
export function mortgageSpreadBp(p: PlayerState, content: Content): Bp {
  const discount = hasFlag(p.life.flags, FLAG_CHEAP_MORTGAGE) ? content.life.cheapMortgageBp : 0;
  return Math.max(0, content.debt.mortgageSpreadBp - discount);
}

/** Annual rate in bp. */
export function debtRateBp(d: Debt, content: Content, world: WorldState, p: PlayerState): Bp {
  if (d.kind === 'creditCard') return content.debt.creditCardRateBp;
  if (d.kind === 'mortgageVariable') return world.policyRateBp + mortgageSpreadBp(p, content);
  return d.fixedRateBp;
}

export interface DebtService {
  interest: Cents;
  principal: Cents;
  perDebt: Array<{ id: string; principal: Cents }>;
}

/** What the player's debts cost this round: interest, plus the scheduled principal slice. */
export function debtServiceForRound(p: PlayerState, content: Content, world: WorldState): DebtService {
  const years = content.yearsPerRound;
  const service: DebtService = { interest: 0, principal: 0, perDebt: [] };
  for (const d of p.debts) {
    service.interest += applyBp(d.principal, debtRateBp(d, content, world, p) * years);
    let due = 0;
    if (d.kind !== 'creditCard') due = d.roundsLeft <= 1 ? d.principal : Math.ceil(d.principal / d.roundsLeft);
    service.principal += due;
    service.perDebt.push({ id: d.id, principal: due });
  }
  return service;
}

export function removePaidDebts(p: PlayerState): void {
  const paid = new Set(p.debts.filter((d) => d.principal <= 0).map((d) => d.id));
  if (paid.size === 0) return;
  p.debts = p.debts.filter((d) => !paid.has(d.id));
  for (const property of p.properties) {
    if (property.mortgageId !== null && paid.has(property.mortgageId)) property.mortgageId = null;
  }
}

export function applyDebtPayments(p: PlayerState, service: DebtService): void {
  for (const payment of service.perDebt) {
    const d = p.debts.find((x) => x.id === payment.id);
    if (!d) continue;
    d.principal -= payment.principal;
    if (d.kind !== 'creditCard') d.roundsLeft = Math.max(0, d.roundsLeft - 1);
  }
  removePaidDebts(p);
}

/** How much more this player may borrow in personal loans today: a share of the yearly salary, less what is already owed. */
export function loanRoom(p: PlayerState, content: Content, world: WorldState): Cents {
  let existing = 0;
  for (const d of p.debts) if (d.kind === 'personalLoan') existing += d.principal;
  const limit = mulDiv(indexed(p.salaryAnnual, world), content.debt.personalLoanMaxIncomePct, 100);
  return Math.max(0, limit - existing);
}

/** The yearly rate a personal loan taken today carries for its whole term. */
export function personalLoanRateBp(content: Content, world: WorldState): Bp {
  return world.policyRateBp + content.debt.personalLoanSpreadBp;
}

/** Pays a personal loan out in cash, at today's rate and for the usual term. Whether the player may have it is the caller's to judge. */
export function takePersonalLoan(p: PlayerState, amount: Cents, content: Content, world: WorldState): void {
  p.debts.push({
    id: newId(p, 'debt'),
    kind: 'personalLoan',
    principal: amount,
    fixedRateBp: personalLoanRateBp(content, world),
    roundsLeft: content.debt.personalLoanTermRounds,
  });
  p.cash += amount;
}

export function executeBorrow(
  p: PlayerState,
  order: Extract<Order, { type: 'borrow' }>,
  ctx: OrderContext,
): RejectReason | null {
  if (!isAmount(order.amount)) return 'bad-amount';
  if (ctx.round < p.bankruptUntilRound) return 'no-credit';
  if (order.amount > loanRoom(p, ctx.content, ctx.world)) return 'over-loan-limit';
  takePersonalLoan(p, order.amount, ctx.content, ctx.world);
  return null;
}

export function executeRepay(p: PlayerState, order: Extract<Order, { type: 'repay' }>): RejectReason | null {
  if (!isAmount(order.amount)) return 'bad-amount';
  const d = p.debts.find((x) => x.id === order.debtId);
  if (!d) return 'unknown-debt';
  if (order.amount > d.principal) return 'exceeds-debt';
  if (order.amount > p.cash) return 'not-enough-cash';
  d.principal -= order.amount;
  p.cash -= order.amount;
  removePaidDebts(p);
  return null;
}

/** Brings negative cash back to zero: from the deposit first, then on the credit card. Spare cash is left alone. */
export function coverShortfall(p: PlayerState): Pick<Settlement, 'fromDeposit' | 'drawn'> {
  if (p.cash >= 0) return { fromDeposit: 0, drawn: 0 };
  let shortfall = -p.cash;
  const fromDeposit = Math.min(p.deposit, shortfall);
  p.deposit -= fromDeposit;
  shortfall -= fromDeposit;
  if (shortfall > 0) {
    let card = p.debts.find((d) => d.kind === 'creditCard');
    if (!card) {
      card = { id: newId(p, 'debt'), kind: 'creditCard', principal: 0, fixedRateBp: 0, roundsLeft: 0 };
      p.debts.push(card);
    }
    card.principal += shortfall;
  }
  p.cash = 0;
  return { fromDeposit, drawn: shortfall };
}

export interface Settlement {
  /** Taken from the deposit to cover a shortfall. */
  fromDeposit: Cents;
  /** Put on the credit card after the deposit ran out. */
  drawn: Cents;
  /** Paid off the credit card from spare cash. */
  repaid: Cents;
}

/**
 * Brings cash back to zero or above at the end of a round.
 * A shortfall is covered by the deposit first and the credit card second.
 * Spare cash pays the credit card down; the deposit is never used for that.
 */
export function settleCash(p: PlayerState): Settlement {
  if (p.cash < 0) return { ...coverShortfall(p), repaid: 0 };

  const result: Settlement = { fromDeposit: 0, drawn: 0, repaid: 0 };
  const card = p.debts.find((d) => d.kind === 'creditCard');
  if (card && p.cash > 0) {
    result.repaid = Math.min(p.cash, card.principal);
    card.principal -= result.repaid;
    p.cash -= result.repaid;
    removePaidDebts(p);
  }
  return result;
}

export interface Bankruptcy {
  /** What the forced sale raised, all of which went to creditors. */
  proceeds: Cents;
  debtsCleared: Cents;
}

/**
 * A player goes bankrupt when both are true:
 * credit card debt is above the limit (a multiple of annual income, with living cost as the floor),
 * and everything they own outside the pension is worth less than everything they owe.
 *
 * A solvent player is never liquidated; they keep paying the card rate until they sell something.
 * In bankruptcy everything outside the pension is sold at a discount, status items included,
 * every debt is cleared, memberships lapse, the lifestyle falls to the lowest tier the life allows,
 * some standing is lost for good, and loans and mortgages are refused for a number of rounds.
 * The credit card keeps working.
 */
export function checkBankruptcy(
  p: PlayerState,
  content: Content,
  world: WorldState,
  annualIncome: Cents,
  completedRound: number,
): Bankruptcy | null {
  const card = p.debts.find((d) => d.kind === 'creditCard');
  if (!card) return null;
  const floor = indexed(cityOf(content, p.cityId).livingCostAnnual, world);
  const limit = content.debt.bankruptcyIncomeMultiple * Math.max(annualIncome, floor);
  if (card.principal <= limit) return null;

  const owed = totalOwed(p);
  if (ownedOutsidePension(p) >= owed) return null;

  const keep = BP - content.debt.fireSaleDiscountBp;
  let proceeds = p.cash + p.deposit;
  for (const held of Object.values(p.positions)) proceeds += applyBp(held.value, keep);
  for (const property of p.properties) proceeds += applyBp(property.value, keep);
  for (const item of p.life.items) proceeds += applyBp(item.value, keep);

  p.cash = 0;
  p.deposit = 0;
  p.positions = {};
  p.properties = [];
  p.debts = [];
  // What has no sale value and is not a subscription stays: nobody repossesses a degree.
  p.life.items = p.life.items.filter(
    (owned) => owned.value === 0 && content.items.some((item) => item.id === owned.itemId && item.kind === 'durable'),
  );
  p.lifestyleTier = p.life.minLifestyleTier;
  p.life.bonusStatus -= content.debt.bankruptcyStatusPenalty;
  p.bankruptUntilRound = completedRound + content.debt.bankruptcyLockRounds;
  return { proceeds, debtsCleared: owed };
}
