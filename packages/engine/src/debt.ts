import { cityOf } from './lookup';
import { applyBp, BP, isAmount, mulDiv } from './money';
import type { Bp, Cents } from './money';
import { newId } from './player';
import { BAD_AMOUNT } from './portfolio';
import type { OrderContext } from './portfolio';
import type { Content, Debt, Order, PlayerState, WorldState } from './types';

/** Annual rate in bp. */
export function debtRateBp(d: Debt, content: Content, world: WorldState): Bp {
  if (d.kind === 'creditCard') return content.debt.creditCardRateBp;
  if (d.kind === 'mortgageVariable') return world.policyRateBp + content.debt.mortgageSpreadBp;
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
    service.interest += applyBp(d.principal, debtRateBp(d, content, world) * years);
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

export function executeBorrow(p: PlayerState, order: Extract<Order, { type: 'borrow' }>, ctx: OrderContext): string | null {
  if (!isAmount(order.amount)) return BAD_AMOUNT;
  if (ctx.round < p.bankruptUntilRound) return 'no credit available after bankruptcy';
  let existing = 0;
  for (const d of p.debts) if (d.kind === 'personalLoan') existing += d.principal;
  const limit = mulDiv(p.salaryAnnual, ctx.content.debt.personalLoanMaxIncomePct, 100);
  if (existing + order.amount > limit) return 'over your personal loan limit';
  p.debts.push({
    id: newId(p, 'debt'),
    kind: 'personalLoan',
    principal: order.amount,
    fixedRateBp: ctx.world.policyRateBp + ctx.content.debt.personalLoanSpreadBp,
    roundsLeft: ctx.content.debt.personalLoanTermRounds,
  });
  p.cash += order.amount;
  return null;
}

export function executeRepay(p: PlayerState, order: Extract<Order, { type: 'repay' }>): string | null {
  if (!isAmount(order.amount)) return BAD_AMOUNT;
  const d = p.debts.find((x) => x.id === order.debtId);
  if (!d) return `unknown debt: ${order.debtId}`;
  if (order.amount > d.principal) return 'cannot repay more than you owe';
  if (order.amount > p.cash) return 'not enough cash';
  d.principal -= order.amount;
  p.cash -= order.amount;
  removePaidDebts(p);
  return null;
}

/** Negative cash becomes credit card debt; spare cash pays the card down. Returns the amount drawn. */
export function settleCash(p: PlayerState): Cents {
  let card = p.debts.find((d) => d.kind === 'creditCard');
  if (p.cash < 0) {
    const draw = -p.cash;
    if (!card) {
      card = { id: newId(p, 'debt'), kind: 'creditCard', principal: 0, fixedRateBp: 0, roundsLeft: 0 };
      p.debts.push(card);
    }
    card.principal += draw;
    p.cash = 0;
    return draw;
  }
  if (card && p.cash > 0) {
    const payment = Math.min(p.cash, card.principal);
    card.principal -= payment;
    p.cash -= payment;
    removePaidDebts(p);
  }
  return 0;
}

/** Returns true if the player went bankrupt. Everything except the pension is sold and all debts are cleared. */
export function checkBankruptcy(p: PlayerState, content: Content, annualIncome: Cents, completedRound: number): boolean {
  const card = p.debts.find((d) => d.kind === 'creditCard');
  if (!card) return false;
  const floor = cityOf(content, p.cityId).livingCostAnnual;
  const threshold = content.debt.bankruptcyIncomeMultiple * Math.max(annualIncome, floor);
  if (card.principal <= threshold) return false;

  const keep = BP - content.debt.fireSaleDiscountBp;
  let proceeds = p.cash + p.deposit;
  for (const held of Object.values(p.positions)) proceeds += applyBp(held.value, keep);
  for (const property of p.properties) proceeds += applyBp(property.value, keep);
  let owed = 0;
  for (const d of p.debts) owed += d.principal;

  p.cash = Math.max(0, proceeds - owed);
  p.deposit = 0;
  p.positions = {};
  p.properties = [];
  p.debts = [];
  p.bankruptUntilRound = completedRound + content.debt.bankruptcyLockRounds;
  return true;
}
