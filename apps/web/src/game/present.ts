import type { ContentText, Names } from '@ratrace/content';
import { indexed } from '@ratrace/engine';
import type { Content, Effects, GameView, Headline, Order, PlayerState, WorldState } from '@ratrace/engine';
import type { Format } from '@/lib/format';

/** A translator for one section of the interface text, as next-intl gives it. */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

/** Everything a presenter needs to turn game data into words. */
export interface Words {
  content: Content;
  text: ContentText;
  names: Names;
  fmt: Format;
}

export const START_AGE = 22;

export const ageAt = (content: Content, round: number): number => START_AGE + round * content.yearsPerRound;

/** Which of the four portraits of a life to show at an age. */
export function portraitAge(age: number): 22 | 32 | 45 | 58 {
  if (age < 30) return 22;
  if (age < 42) return 32;
  if (age < 55) return 45;
  return 58;
}

/** A headline as a sentence. */
export function headlineText({ text, names }: Words, h: Headline): string {
  switch (h.topic) {
    case 'regime':
      return text.headlines.regime[h.regime];
    case 'crypto':
      return text.headlines.crypto[h.phase];
    case 'rates':
      return text.headlines.rates[h.trend];
    case 'inflation':
      return text.headlines.inflation[h.trend];
    case 'property':
      return text.headlines.property[h.trend].replace('{city}', names.cities[h.cityId]);
  }
}

export type Tone = 'good' | 'bad' | 'plain';

export interface EffectTag {
  tone: Tone;
  text: string;
}

const signed = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);
const toneOf = (n: number): Tone => (n > 0 ? 'good' : 'bad');

/**
 * What a card option does, as short tags. Cash is not here: the caller shows the exact figure the
 * engine's preview gives, which already counts insurance, discounts and purchase tax.
 * `t` translates the `effects` section.
 */
export function effectTags(words: Words, t: Translate, world: WorldState, effects: Effects | undefined): EffectTag[] {
  if (effects === undefined) return [];
  const { content, text, names, fmt } = words;
  const dollars = (amount: number) => fmt.money(indexed(amount, world));
  const tags: EffectTag[] = [];
  const add = (tone: Tone, label: string) => tags.push({ tone, text: label });

  if (effects.salaryModPct) add(toneOf(effects.salaryModPct), t('salaryMod', { value: signed(effects.salaryModPct) }));
  if (effects.salaryBoostPct) add(toneOf(effects.salaryBoostPct), t('salaryBoost', { value: signed(effects.salaryBoostPct) }));
  if (effects.careerSkill) add(toneOf(effects.careerSkill), t('careerSkill', { value: signed(effects.careerSkill) }));
  if (effects.financeSkill) add(toneOf(effects.financeSkill), t('financeSkill', { value: signed(effects.financeSkill) }));
  if (effects.status) add(toneOf(effects.status), t('status', { value: signed(effects.status) }));
  if (effects.focus) add('bad', t('focus', { value: signed(-effects.focus) }));
  for (const entry of effects.recurring ?? []) {
    const income = entry.kind === 'passive';
    const amount = dollars(entry.annual);
    if (entry.roundsLeft === null) add(income ? 'good' : 'bad', t(income ? 'yearlyIncome' : 'yearlyCost', { amount }));
    else add(income ? 'good' : 'bad', t(income ? 'yearlyIncomeFor' : 'yearlyCostFor', { amount, years: entry.roundsLeft * content.yearsPerRound }));
  }
  if (effects.job?.leave) add('plain', t('leaveJob'));
  else if (effects.job?.career) add('plain', t('newCareer', { career: text.careers[effects.job.career].name }));
  else if ((effects.job?.levelDelta ?? 0) > 0) add('good', t('promotion'));
  else if ((effects.job?.levelDelta ?? 0) < 0) add('bad', t('demotion'));
  if (effects.moveCity) add('plain', t('moveTo', { city: names.cities[effects.moveCity] }));
  if (effects.partner === null) add('plain', t('partnerOut'));
  else if (effects.partner !== undefined) add('plain', t('partnerIn'));
  if (effects.children) add('plain', t('children', { count: effects.children }));
  if (effects.buyItem) add('plain', t('get', { item: names.items[effects.buyItem.itemId] }));
  if (effects.invest) add('plain', t('invest', { amount: dollars(effects.invest.amount), asset: names.assets[effects.invest.assetId].name }));
  if (effects.pension) add('good', t('pension', { amount: dollars(effects.pension) }));
  if (effects.loan) add('bad', t('loan', { amount: dollars(effects.loan) }));
  if (effects.property) add('plain', t(effects.property.rented ? 'buyRental' : 'buyHome', { home: text.propertyTypes[effects.property.typeId] }));
  if (effects.refinance) add('plain', t(effects.refinance === 'fixed' ? 'refinanceFixed' : 'refinanceVariable'));
  if (effects.sellHome) add('plain', t('sellHome'));
  if (effects.homeValuePct) add(toneOf(effects.homeValuePct), t('homeValue', { value: signed(effects.homeValuePct) }));
  if (effects.lose) {
    const what = effects.lose.what === 'deposit' ? t('savings') : text.assetClasses[effects.lose.what].toLowerCase();
    add('bad', t('lose', { pct: effects.lose.pct, what }));
  }
  if (effects.lifestyleFloor !== undefined) add('bad', t('lifestyleFloor', { tier: text.lifestyleTiers[effects.lifestyleFloor] }));
  return tags;
}

/** A chance as a percentage a person can read: 50, 9.5, 0.002. */
export function chancePct(weight: number, total: number): string {
  const share = (weight * 100) / total;
  if (share >= 10) return String(Math.round(share));
  if (share >= 1) return String(Math.round(share * 10) / 10);
  return String(Number(share.toPrecision(1)));
}

/** An order in the basket, as a line of text. `t` translates the `orders` section. */
export function orderLabel(words: Words, t: Translate, player: PlayerState, order: Order): string {
  const { text, names, fmt, content } = words;
  const home = (propertyId: string) => {
    const property = player.properties.find((p) => p.id === propertyId);
    return property ? text.propertyTypes[property.typeId] : '';
  };
  switch (order.type) {
    case 'buy':
    case 'sell':
      return t(order.type, { name: names.assets[order.assetId]?.name ?? order.assetId, amount: fmt.money(order.amount) });
    case 'depositIn':
      return t('save', { amount: fmt.money(order.amount) });
    case 'depositOut':
      return t('withdraw', { amount: fmt.money(order.amount) });
    case 'pensionIn':
      return t('pension', { amount: fmt.money(order.amount) });
    case 'borrow':
      return t('borrow', { amount: fmt.money(order.amount) });
    case 'repay': {
      const debt = player.debts.find((d) => d.id === order.debtId);
      return t('repay', { name: debt ? text.debts[debt.kind] : '', amount: fmt.money(order.amount) });
    }
    case 'buyProperty':
      return t(order.rented ? 'buyRental' : 'buyHome', { home: text.propertyTypes[order.typeId] });
    case 'sellProperty':
      return t('sellHome', { home: home(order.propertyId) });
    case 'setRented':
      return t(order.rented ? 'rentOn' : 'rentOff', { home: home(order.propertyId) });
    case 'focus':
      return t(order.action === 'overtime' ? 'overtime' : order.action === 'studyCareer' ? 'study' : 'hunt');
    case 'buyItem':
      return t('buyItem', { item: names.items[order.itemId] });
    case 'sellItem': {
      const kind = content.items.find((item) => item.id === order.itemId)?.kind;
      return t(kind === 'membership' ? 'cancelItem' : 'sellItem', { item: names.items[order.itemId] });
    }
    case 'setLifestyle':
      return t('lifestyle', { tier: text.lifestyleTiers[order.tier] });
    case 'setRentTier':
      return t('rentTier', { tier: text.rentTiers[order.tier] });
    case 'setInsurance':
      return t(order.on ? 'insureOn' : 'insureOff', { kind: text.insurance[order.insurance] });
    case 'moveCity':
      return t('move', { city: names.cities[order.cityId] });
  }
}

/** The price of an asset at each round so far, as a share of its price at the start. For the sparkline. */
export function priceHistory(view: GameView, assetId: string): number[] {
  const first = view.timeline[0].assetIndex[assetId];
  return view.timeline.map((world) => world.assetIndex[assetId] / first);
}
