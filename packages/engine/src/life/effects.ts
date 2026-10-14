import { openBusiness } from '../business';
import { honestEvasion } from '../evasion';
import { mortgageSpreadBp, removePaidDebts, takePersonalLoan } from '../debt';
import { newId } from '../ids';
import { careerOf, cityOf, itemOf } from '../lookup';
import { clamp, mulDiv } from '../money';
import type { Cents } from '../money';
import { propertyPrice } from '../property';
import { indexed, PRICE_LEVEL_START } from '../rates';
import { netWorth } from '../selectors';
import { effectiveTax, purchaseTax } from '../tax';
import type { Effects, FinanceSkill, LifestyleTier, PlayerState } from '../types';
import type { Situation } from './conditions';
import { homeOf, refreshDerived } from './derive';
import { FLAG_SOLD_BUSINESS, hasFlag } from './flags';
import { retire } from './orders';
import { addSkillPoints, maxBusinessesOf, pointsOfLevel } from './skills';

/** The one-off money of an effect, in the dollars of the round, after any protection the player holds. */
function moneyOf(p: PlayerState, effects: Effects, at: Situation): Cents {
  let amount = indexed(effects.cash ?? 0, at.world);
  if (effects.cashSalaryPct !== undefined) {
    amount += mulDiv(indexed(p.salaryAnnual, at.world), effects.cashSalaryPct, 100);
  }
  if (effects.cashNetWorthPct !== undefined) {
    const worth = netWorth(p);
    if (worth > 0) amount += mulDiv(worth, effects.cashNetWorthPct, 100);
  }
  const shield = effects.protection;
  if (amount < 0 && shield !== undefined) {
    const insured = shield.insurance !== undefined && p.life.insurance[shield.insurance];
    const flagged = shield.flag !== undefined && hasFlag(p.life.flags, shield.flag);
    if (insured || flagged) amount += mulDiv(-amount, shield.coverPct, 100);
  }
  return amount;
}

function changeJob(p: PlayerState, job: NonNullable<Effects['job']>, at: Situation): void {
  const life = p.life;
  if (job.leave) {
    life.career = null;
    life.baseSalaryAnnual = 0;
    return;
  }
  if (job.career !== undefined) life.career = { id: job.career, level: job.level ?? 0 };
  else if (life.career === null) return;
  else if (job.level !== undefined) life.career.level = job.level;
  if (life.career === null) return;

  const levels = careerOf(at.content, life.career.id).levels;
  life.career.level = clamp(life.career.level + (job.levelDelta ?? 0), 0, levels.length - 1);
  // Whoever holds a level has the skill for it, so the next promotion is earned from there.
  life.careerSkill = Math.max(life.careerSkill, levels[life.career.level].minSkill);
}

function buyItem(p: PlayerState, order: NonNullable<Effects['buyItem']>, at: Situation): void {
  if (p.life.items.some((owned) => owned.itemId === order.itemId)) return;
  const item = itemOf(at.content, order.itemId);
  const price = indexed(item.price, at.world);
  const paid = mulDiv(price, order.pricePct, 100);
  p.cash -= paid;
  p.life.items.push({
    itemId: item.id,
    value: item.kind === 'durable' ? mulDiv(price, item.resaleStartPct, 100) : 0,
    roundsLeft: item.kind === 'experience' ? item.boostRounds : null,
    paid,
    age: 0,
  });
  if (!p.life.collection.includes(item.id)) p.life.collection.push(item.id);
}

function buyProperty(p: PlayerState, deal: NonNullable<Effects['property']>, at: Situation): void {
  const { content, world } = at;
  const market = propertyPrice(content, world, p.cityId, deal.typeId);
  const price = mulDiv(market, deal.pricePct, 100);
  const down = mulDiv(price, deal.downPct, 100);
  p.cash -= down + purchaseTax(effectiveTax(cityOf(content, p.cityId), world), price);

  let mortgageId: string | null = null;
  if (price > down) {
    mortgageId = newId(p, 'debt');
    p.debts.push({
      id: mortgageId,
      kind: 'mortgageFixed',
      principal: price - down,
      fixedRateBp: world.policyRateBp + mortgageSpreadBp(p, content),
      roundsLeft: content.debt.mortgageTermRounds,
    });
  }
  // Worth what was paid: a discount is a cheaper way in, not equity to cash out the same day.
  p.properties.push({
    id: newId(p, 'property'),
    cityId: p.cityId,
    typeId: deal.typeId,
    value: price,
    basis: price,
    rented: deal.rented,
    mortgageId,
  });
}

function sellHome(p: PlayerState, at: Situation): void {
  const home = homeOf(p, at.content);
  if (home === null) return;
  const mortgage = p.debts.find((d) => d.id === home.mortgageId);
  p.cash += home.value - (mortgage ? mortgage.principal : 0);
  if (mortgage) p.debts = p.debts.filter((d) => d.id !== mortgage.id);
  p.properties = p.properties.filter((x) => x.id !== home.id);
  p.life.rentTier = 1;
}

function lose(p: PlayerState, loss: NonNullable<Effects['lose']>, at: Situation): void {
  if (loss.what === 'deposit') {
    p.deposit -= mulDiv(p.deposit, loss.pct, 100);
    return;
  }
  for (const asset of at.content.assets) {
    if (asset.class !== loss.what || !Object.hasOwn(p.positions, asset.id)) continue;
    const held = p.positions[asset.id];
    const value = held.value - mulDiv(held.value, loss.pct, 100);
    if (value <= 0) delete p.positions[asset.id];
    else p.positions[asset.id] = { value, basis: held.basis };
  }
}

/**
 * Gives to the children: a share of the cash and savings, cash first, and every business at what is
 * in it. The gift tax is taken from what is given; the rest is the family's, kept in the dollars of
 * the start so that it counts as it would have on the day.
 */
function giveToChildren(p: PlayerState, gift: NonNullable<Effects['gift']>, at: Situation): void {
  let given = 0;
  if (gift.liquidPct !== undefined) {
    const amount = mulDiv(Math.max(0, p.cash) + p.deposit, gift.liquidPct, 100);
    const fromCash = Math.min(amount, Math.max(0, p.cash));
    p.cash -= fromCash;
    p.deposit -= amount - fromCash;
    given += amount;
  }
  if (gift.businesses === true) {
    for (const business of p.businesses) given += business.capital;
    p.businesses = [];
  }
  const kept = given - mulDiv(given, at.content.life.giftTaxPct, 100);
  p.life.legacy += mulDiv(kept, PRICE_LEVEL_START, at.world.priceLevel);
}

/**
 * Applies the effects of a card option or of one of its outcomes to the player.
 * Cash may go negative here; the caller settles it once the whole hand is answered.
 * The derived fields are back in step when this returns.
 */
export function applyEffects(p: PlayerState, effects: Effects | undefined, at: Situation): void {
  if (effects === undefined) return;
  const { content, world, round } = at;
  const life = p.life;

  p.cash += moneyOf(p, effects, at);

  if (effects.loan !== undefined) {
    takePersonalLoan(p, indexed(effects.loan, world), content, world);
  }
  if (effects.pension !== undefined) p.pension += indexed(effects.pension, world);
  if (effects.sellBusinesses !== undefined) {
    for (const business of p.businesses) p.cash += mulDiv(business.capital, effects.sellBusinesses.pricePct, 100);
    if (p.businesses.length > 0) life.flags[FLAG_SOLD_BUSINESS] = round;
    p.businesses = [];
  }
  if (effects.business !== undefined && p.businesses.length < maxBusinessesOf(p, content)) {
    openBusiness(p, effects.business.typeId, indexed(effects.business.capital, world), content);
  }
  if (effects.lose !== undefined) lose(p, effects.lose, at);

  life.salaryModPct += effects.salaryModPct ?? 0;
  life.salaryBoostPct += effects.salaryBoostPct ?? 0;
  life.careerSkill = Math.max(0, life.careerSkill + (effects.careerSkill ?? 0));
  // A course or a book takes someone as far as the third level; the fourth comes only from years of investing.
  life.financeSkill = clamp(life.financeSkill + (effects.financeSkill ?? 0), 0, Math.max(2, life.financeSkill)) as FinanceSkill;
  // The points follow a level a card gives, so the next is counted from where it begins.
  life.financePoints = Math.max(life.financePoints, pointsOfLevel(life.financeSkill, content));
  // A level reached by a card shows in the skill itself; the card already told of it.
  if (effects.skills !== undefined) addSkillPoints(p, content, effects.skills, []);
  life.bonusStatus += effects.status ?? 0;
  life.focusUsed += effects.focus ?? 0;

  if (effects.endRecurring !== undefined) {
    const ended = effects.endRecurring;
    life.recurring = life.recurring.filter((entry) => !ended.includes(entry.tag));
  }
  for (const entry of effects.recurring ?? []) {
    life.recurring = life.recurring.filter((existing) => existing.tag !== entry.tag);
    life.recurring.push({ ...entry });
  }
  for (const flag of effects.setFlags ?? []) life.flags[flag] = round;
  for (const flag of effects.clearFlags ?? []) delete life.flags[flag];

  if (effects.job !== undefined) changeJob(p, effects.job, at);
  if (effects.retire === true && life.career !== null) retire(p, round);
  if (effects.focusBase !== undefined) life.focusBase = Math.max(1, life.focusBase + effects.focusBase);
  if (effects.businessesPct !== undefined) {
    for (const business of p.businesses) business.capital = Math.max(0, business.capital + mulDiv(business.capital, effects.businessesPct, 100));
  }
  if (effects.suspicion !== undefined) life.evasion.suspicion = clamp(life.evasion.suspicion + effects.suspicion, 0, 100);
  if (effects.amnesty !== undefined) {
    // What is owed is paid in part, and the slate is clean: nothing hidden, nothing owed, nothing suspected.
    let owed = 0;
    for (const entry of life.evasion.evaded) owed += entry.amount;
    p.cash -= mulDiv(owed, effects.amnesty.pct, 100);
    life.evasion = honestEvasion();
  }
  if (effects.gift !== undefined) giveToChildren(p, effects.gift, at);
  if (effects.moveCity !== undefined && effects.moveCity !== p.cityId) {
    life.movingTo = effects.moveCity;
    // A move a card offers comes with a place to go to.
    life.movingTransfer = true;
  }

  if (effects.partner !== undefined) {
    life.partner = effects.partner !== null;
    life.partnerSalaryPct = effects.partner === null ? 0 : effects.partner.salaryPct;
  }
  for (let i = 0; i < (effects.children ?? 0); i++) life.children.push(content.life.childRounds);
  if (effects.lifestyleFloor !== undefined) {
    life.minLifestyleTier = Math.max(life.minLifestyleTier, effects.lifestyleFloor) as LifestyleTier;
    p.lifestyleTier = Math.max(p.lifestyleTier, life.minLifestyleTier) as LifestyleTier;
  }

  if (effects.buyItem !== undefined) buyItem(p, effects.buyItem, at);
  if (effects.invest !== undefined) {
    const { assetId, bonusPct } = effects.invest;
    const amount = indexed(effects.invest.amount, world);
    const held = Object.hasOwn(p.positions, assetId) ? p.positions[assetId] : { value: 0, basis: 0 };
    p.cash -= amount;
    p.positions[assetId] = { value: held.value + amount + mulDiv(amount, bonusPct ?? 0, 100), basis: held.basis + amount };
  }
  if (effects.property !== undefined) buyProperty(p, effects.property, at);

  if (effects.refinance !== undefined) {
    for (const debt of p.debts) {
      if (debt.kind !== 'mortgageFixed' && debt.kind !== 'mortgageVariable') continue;
      debt.kind = effects.refinance === 'fixed' ? 'mortgageFixed' : 'mortgageVariable';
      debt.fixedRateBp = effects.refinance === 'fixed' ? world.policyRateBp + mortgageSpreadBp(p, content) : 0;
    }
  }
  if (effects.homeValue !== undefined) {
    const home = homeOf(p, content);
    if (home !== null) home.value += indexed(effects.homeValue, world);
  }
  if (effects.sellHome) sellHome(p, at);

  removePaidDebts(p);
  refreshDerived(p, content, at.round);
}
