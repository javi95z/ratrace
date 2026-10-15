import { mulDiv } from './money';
import type { Cents } from './money';
import { computeTax } from './tax';
import type { TaxBill, TaxInput } from './tax';
import type { Rng } from './rng';
import type { Content, EvasionState, Evaded, GameEvent, Order, OrderContext, PlayerState, RejectReason, TaxProfile } from './types';

/** Nothing hidden, and nothing suspected: how every life begins. */
export function honestEvasion(): EvasionState {
  return { blackPct: 0, shell: false, hideCrypto: false, suspicion: 0, evaded: [] };
}

/** True while anything at all is being hidden. */
export function hiding(state: EvasionState): boolean {
  return state.blackPct > 0 || state.shell || state.hideCrypto;
}

/**
 * The round's tax as the player declares it, beside the tax they owe. Pay taken under the table is
 * left out of the salary, crypto gains left out of the gains, and an offshore company takes its
 * share off what investment tax is left. What the bill is short of the honest one is the evasion.
 */
export function declaredTax(
  content: Content,
  p: PlayerState,
  tax: TaxProfile,
  median: Cents,
  input: TaxInput,
  cryptoGains: Cents,
): { bill: TaxBill; evaded: Evaded } {
  const years = content.yearsPerRound;
  const state = p.life.evasion;
  const honest = computeTax(tax, median, years, input);
  const salary = state.blackPct > 0 ? mulDiv(input.salary, 100 - state.blackPct, 100) : input.salary;
  const hidden = state.hideCrypto ? Math.max(0, cryptoGains) : 0;
  const declared = computeTax(tax, median, years, { ...input, salary, realisedGains: input.realisedGains - hidden });
  const shell = state.shell ? mulDiv(declared.investment, content.evasion.shellTaxCutPct, 100) : 0;
  const investment = declared.investment - shell;
  const bill: TaxBill = { income: declared.income, investment, property: declared.property, total: declared.income + investment + declared.property };
  const black = Math.max(0, honest.income - declared.income);
  const crypto = Math.max(0, honest.investment - declared.investment);
  return { bill, evaded: { black, shell, crypto, total: black + shell + crypto } };
}

/** Sets what is hidden from this round on. Each part left out of the order stays as it was. */
export function executeSetEvasion(p: PlayerState, order: Extract<Order, { type: 'setEvasion' }>, ctx: OrderContext): RejectReason | null {
  const rules = ctx.content.evasion;
  const state = p.life.evasion;
  if (order.blackPct !== undefined) {
    if (!rules.blackPcts.includes(order.blackPct)) return 'bad-share';
    // Pay under the table needs pay: an employer to hand it over.
    if (order.blackPct > 0 && p.life.career === null) return 'no-job';
  }
  if (order.shell === true && !state.shell && p.life.financeSkill < rules.shellMinFinanceSkill) return 'needs-finance-skill';
  if (order.blackPct !== undefined) state.blackPct = order.blackPct;
  if (order.shell !== undefined) state.shell = order.shell;
  if (order.hideCrypto !== undefined) state.hideCrypto = order.hideCrypto;
  return null;
}

/** What hiding draws in suspicion this round: the pay under the table, the company, the coins, and every question asked at a sale. */
export function suspicionGained(content: Content, p: PlayerState, evaded: Evaded, noInvoiceSold: number, round: number): number {
  const rules = content.evasion;
  const state = p.life.evasion;
  let gained = Math.floor((state.blackPct * rules.blackSuspicionPer100) / 100);
  if (state.shell) gained += rules.shellSuspicion;
  if (evaded.crypto > 0) gained += round >= rules.cryptoReportRound ? rules.cryptoSuspicion * 2 : rules.cryptoSuspicion;
  return gained + noInvoiceSold * rules.noInvoiceSaleSuspicion;
}

/** Suspicion once a round is played: up by what was hidden, or down a little with nothing hidden. Never past 100. */
export function suspicionAfter(content: Content, p: PlayerState, evaded: Evaded, noInvoiceSold: number, round: number): number {
  const state = p.life.evasion;
  const gained = suspicionGained(content, p, evaded, noInvoiceSold, round);
  return Math.min(100, gained > 0 || hiding(state) ? state.suspicion + gained : Math.max(0, state.suspicion - content.evasion.suspicionDecay));
}

/** The chance in percent that the tax office of a city comes, at a given suspicion: a strict office comes more often, a lax one less. */
export function auditChance(content: Content, suspicion: number, cityId: string): number {
  const office = content.cities.find((city) => city.id === cityId)?.taxOfficePct ?? 100;
  return Math.min(content.evasion.auditMaxPct, Math.max(0, Math.round((suspicion * office) / 100)));
}

/** What an inspection would take today: the tax evaded and not yet past the limit, its fine, and a share of what was bought without an invoice. */
export function auditBill(content: Content, p: PlayerState): { evaded: Cents; fine: Cents; goods: Cents; total: Cents } {
  const rules = content.evasion;
  let evaded = 0;
  for (const entry of p.life.evasion.evaded) evaded += entry.amount;
  let goods = 0;
  for (const owned of p.life.items) if (owned.noInvoice === true) goods += mulDiv(owned.value, rules.auditGoodsPct, 100);
  const fine = mulDiv(evaded, rules.auditFinePct, 100);
  return { evaded, fine, goods, total: evaded + fine + goods };
}

/**
 * The tax office's part of a round, once its bills are paid: what was evaded is written down,
 * suspicion rises with what was hidden or eases with nothing hidden, and the dice say whether an
 * inspection comes. One that comes takes its bill from cash, ends every way of hiding, marks the
 * goods as known and costs the player status. What is past the time limit is forgotten.
 * Returns what an inspection took, or nothing. The dice are rolled only with something suspected.
 */
export function settleEvasion(content: Content, p: PlayerState, evaded: Evaded, noInvoiceSold: number, round: number, rng: Rng, events: GameEvent[]): Cents {
  const rules = content.evasion;
  const state = p.life.evasion;
  // A job lost is pay no longer taken under the table.
  if (p.life.career === null) state.blackPct = 0;
  if (evaded.total > 0) state.evaded.push({ round, amount: evaded.total });
  state.suspicion = suspicionAfter(content, p, evaded, noInvoiceSold, round);

  let taken = 0;
  if (state.suspicion > 0 && rng.chance(auditChance(content, state.suspicion, p.cityId))) {
    const bill = auditBill(content, p);
    if (bill.total > 0 || hiding(state)) {
      taken = bill.total;
      p.cash -= taken;
      events.push({ kind: 'audit', evaded: bill.evaded, fine: bill.fine, goods: bill.goods });
      // So much hidden that the office takes it to court: a trial is dealt from the next round.
      if (bill.evaded >= rules.chargedFromEvaded) {
        p.life.flags.charged = round;
        events.push({ kind: 'charged' });
      }
      p.life.bonusStatus += rules.auditStatus;
      Object.assign(state, honestEvasion());
      for (const owned of p.life.items) delete owned.noInvoice;
    }
  }
  // What was hidden in a round can be claimed in that round and the next ones up to the limit: then it is forgotten.
  state.evaded = state.evaded.filter((entry) => entry.round + rules.limitationRounds > round + 1);
  return taken;
}
