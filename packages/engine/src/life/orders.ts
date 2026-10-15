import { loanRoom, takePersonalLoan } from '../debt';
import { careerOf } from '../lookup';
import { mulDiv } from '../money';
import { indexed } from '../rates';
import type { Cents } from '../money';
import type { Rng } from '../rng';
import type { CityDef, Content, FocusAction, InsuranceKind, ItemDef, Order, OrderContext, OwnedItem, PlayerState, RejectReason, UsedRule, WorldState } from '../types';
import { INSURANCE_KINDS, perksOf } from './derive';
import { FLAG_HAD_ILLNESS, hasFlag } from './flags';
import { isStudy, skillLevel, STUDY_OF } from './skills';

export const FOCUS_ACTIONS: readonly FocusAction[] = ['overtime', 'studyCareer', 'jobHunt', 'studyFinance', 'studyNegotiation', 'studyLanguages', 'networking', 'exercise'];

export type LifeOrder = Extract<
  Order,
  { type: 'focus' | 'buyItem' | 'sellItem' | 'setLifestyle' | 'setRentTier' | 'setInsurance' | 'moveCity' | 'retire' }
>;

/** Focus points the player can still spend this round. */
export function focusLeft(p: PlayerState): number {
  return Math.max(0, focusTotal(p) - p.life.focusUsed);
}

/**
 * Focus points the player has for this round in all: their own, and what a rest gave them, less
 * what a burnout took. A burnout never leaves the player with none.
 */
export function focusTotal(p: PlayerState): number {
  const total = p.life.focusBase + p.life.focusBonus;
  return p.life.focusLost > 0 ? Math.max(Math.min(1, total), total - p.life.focusLost) : total;
}

/**
 * Why a use of focus is closed to the player as they stand, whatever focus is left, or null. A skill
 * at its top has nothing more to learn; study for the career needs a rung above and counts for
 * so much at each rung; and a job hunt that just worked needs a rest.
 */
export function focusLock(p: PlayerState, action: FocusAction, content: Content): RejectReason | null {
  if (!FOCUS_ACTIONS.includes(action)) return 'unknown-action';
  // A skill of one's own can be studied without a job; overtime, the career and a job hunt need one.
  if (p.life.career === null && !isStudy(action) && action !== 'studyFinance') return 'no-job';
  if (isStudy(action) && skillLevel(p, STUDY_OF[action], content) >= 3) return 'skill-maxed';
  if (action === 'studyFinance' && p.life.financeSkill >= 3) return 'skill-maxed';
  if (action === 'studyCareer' && p.life.career !== null) {
    if (careerOf(content, p.life.career.id).levels[p.life.career.level + 1] === undefined) return 'career-top';
    if (p.life.rungStudy >= content.life.focusLimits.studyPerRung) return 'studied-enough';
  }
  if (action === 'jobHunt' && p.life.huntRest > 0) return 'hunt-resting';
  return null;
}

function executeFocus(p: PlayerState, action: FocusAction, ctx: OrderContext): RejectReason | null {
  const lock = focusLock(p, action, ctx.content);
  if (lock !== null) return lock;
  if (ctx.tally.focusActions.includes(action)) return 'already-done';
  if (focusLeft(p) < 1) return 'no-focus';
  p.life.focusUsed += 1;
  ctx.tally.focusActions.push(action);
  // Study and job hunting pay off when the round has resolved. Overtime is paid in this round.
  if (action === 'overtime' && p.life.career !== null) p.life.salaryBoostPct += overtimeOf(p, ctx.content);
  return null;
}

/** What a round of overtime adds to this round's pay, in percent. Nothing without a career. */
export function overtimeOf(p: PlayerState, content: Content): number {
  return p.life.career === null ? 0 : careerOf(content, p.life.career.id).overtimePct;
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
  // Someone who speaks the language finds a flat and a removal firm for less.
  const off = perksOf(p, content).moveCostOffPct + skillLevel(p, 'languages', content) * content.life.skills.languagesMoveOffPct;
  return mulDiv(full, Math.max(0, 100 - off), 100);
}

/** The rule for buying a thing second hand, or null for what is only sold new: every rule is for durables. */
export function usedRuleOf(item: ItemDef, content: Content): UsedRule | null {
  return item.kind === 'durable' && item.cardOnly !== true ? (content.life.used[item.ladder] ?? null) : null;
}

/**
 * What a thing costs second hand today and what it is worth the moment it is bought, or null where
 * it is only sold new. The dealer keeps the same margin as on a new one, so nothing can be bought
 * second hand and sold the same round for more.
 */
export function usedTerms(item: ItemDef, content: Content, world: WorldState): { price: Cents; resale: Cents; rule: UsedRule } | null {
  const rule = usedRuleOf(item, content);
  if (rule === null) return null;
  const price = mulDiv(itemTerms(item, world).price, rule.pricePct, 100);
  return { price, resale: mulDiv(price, item.resaleStartPct, 100), rule };
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
  if (order.used === true) return order.noInvoice === true ? 'not-sold-without-invoice' : buyUsed(p, item, ctx, order.financed === true);
  if (order.noInvoice === true) return buyWithoutInvoice(p, item, ctx, order.financed === true);
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

/** True where a thing is sold without an invoice: only new, only in the ladders the rules name. */
export function soldWithoutInvoice(item: ItemDef, content: Content): boolean {
  return item.kind === 'durable' && item.cardOnly !== true && content.evasion.noInvoiceLadders.includes(item.ladder);
}

/**
 * What a thing costs without an invoice today, and what it is worth the moment it is bought, or
 * null where it is not sold so. Worth the same share of what it cost as one bought properly.
 */
export function noInvoiceTerms(item: ItemDef, content: Content, world: WorldState): { price: Cents; resale: Cents } | null {
  if (!soldWithoutInvoice(item, content)) return null;
  const price = mulDiv(itemTerms(item, world).price, 100 - content.evasion.noInvoiceDiscountPct, 100);
  return { price, resale: mulDiv(price, item.resaleStartPct, 100) };
}

/** Buys a thing without an invoice: in cash, cheaper, and marked, so that a sale or an inspection asks about it. */
function buyWithoutInvoice(p: PlayerState, item: ItemDef, ctx: OrderContext, financed: boolean): RejectReason | null {
  const terms = noInvoiceTerms(item, ctx.content, ctx.world);
  if (terms === null) return 'not-sold-without-invoice';
  if (financed) return 'cannot-finance';
  if (terms.price > p.cash) return 'not-enough-cash';
  p.cash -= terms.price;
  ctx.tally.itemsBought += terms.price;
  p.life.items.push({ itemId: item.id, value: terms.resale, roundsLeft: null, paid: terms.price, age: 0, noInvoice: true });
  if (!p.life.collection.includes(item.id)) p.life.collection.push(item.id);
  return null;
}

/** Buys a thing second hand: in cash only, older on the day, and marked so that its repairs come round. */
function buyUsed(p: PlayerState, item: ItemDef, ctx: OrderContext, financed: boolean): RejectReason | null {
  const terms = usedTerms(item, ctx.content, ctx.world);
  if (terms === null) return 'not-sold-used';
  if (financed) return 'cannot-finance';
  if (terms.price > p.cash) return 'not-enough-cash';
  p.cash -= terms.price;
  ctx.tally.itemsBought += terms.price;
  p.life.items.push({ itemId: item.id, value: terms.resale, roundsLeft: null, paid: terms.price, age: terms.rule.ageRounds, used: true });
  if (!p.life.collection.includes(item.id)) p.life.collection.push(item.id);
  return null;
}

/**
 * What the things bought second hand cost in repairs this round, each its own roll of the dice. A
 * repair is priced on what a new one costs today. Taken from cash with the round's other bills. The
 * round it is bought in, the dealer's warranty covers it: it is still as old as it was sold.
 */
export function repairUsed(p: PlayerState, content: Content, world: WorldState, rng: Rng): Array<{ itemId: string; amount: Cents }> {
  const repairs: Array<{ itemId: string; amount: Cents }> = [];
  for (const owned of p.life.items) {
    if (owned.used !== true) continue;
    const item = content.items.find((x) => x.id === owned.itemId);
    const rule = item ? usedRuleOf(item, content) : null;
    if (!item || rule === null || owned.age <= rule.ageRounds || !rng.chance(rule.repairChancePct)) continue;
    const amount = mulDiv(itemTerms(item, world).price, rule.repairPct, 100);
    if (amount > 0) repairs.push({ itemId: owned.itemId, amount });
  }
  for (const repair of repairs) p.cash -= repair.amount;
  return repairs;
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
  // A buyer asks where something bought without an invoice came from.
  if (owned.noInvoice === true) ctx.tally.noInvoiceSold += 1;
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
 * Takes out or ends a cover. Health cover is priced by the age it is taken out at, for as long as it
 * is kept: ending it and taking it out again later costs the premium of the later age. And no insurer
 * takes on an illness it would already be paying for.
 */
function executeSetInsurance(p: PlayerState, order: Extract<Order, { type: 'setInsurance' }>, ctx: OrderContext): RejectReason | null {
  if (!INSURANCE_KINDS.includes(order.insurance as InsuranceKind)) return 'unknown-insurance';
  const life = p.life;
  if (order.insurance === 'health' && order.on !== life.insurance.health) {
    if (order.on && hasFlag(life.flags, FLAG_HAD_ILLNESS)) return 'preexisting-condition';
    life.healthCoverSince = order.on ? ctx.round : null;
  }
  life.insurance[order.insurance] = order.on;
  return null;
}

/** Leaves the career for good. The pay of the round ends with it, as when a card ends a job. */
export function retire(p: PlayerState, round: number): void {
  p.life.career = null;
  p.life.baseSalaryAnnual = 0;
  p.life.retiredAtRound = round;
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
      return executeSetInsurance(p, order, ctx);
    case 'moveCity':
      return executeMoveCity(p, order.cityId, ctx);
    case 'retire':
      if (p.life.career === null) return 'no-job';
      if (ctx.round < ctx.content.life.retireFromRound) return 'too-young-to-retire';
      retire(p, ctx.round);
      return null;
  }
}
