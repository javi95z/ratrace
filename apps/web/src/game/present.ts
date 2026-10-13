import { cityIcon, START_AGE } from '@ratrace/content';
import type { ContentText, Names } from '@ratrace/content';
import { indexed } from '@ratrace/engine';
import type { Content, Effects, GameEvent, GameView, Headline, InsuranceKind, Order, PlayerState, WorldState } from '@ratrace/engine';
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
  // A tag is read at a glance: the amount is given in round figures, and the exact one is on the ledger.
  const dollars = (amount: number) => fmt.brief(indexed(amount, world));
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
  if (effects.buyItem) {
    // A thing is taken for what it gives: the name alone says nothing of the status, how long it lasts, or the bargain.
    const { itemId, pricePct } = effects.buyItem;
    const item = content.items.find((x) => x.id === itemId);
    add('plain', t('get', { item: names.items[itemId] }));
    if (item) {
      if (item.status > 0) add('good', item.kind === 'experience' ? t('itemStatusFor', { n: item.status, years: item.boostRounds * content.yearsPerRound }) : t('itemStatus', { n: item.status }));
      if (item.upkeepAnnual > 0) add('bad', t('yearlyCost', { amount: dollars(item.upkeepAnnual) }));
      if (pricePct < 100) add('plain', t('itemUsual', { amount: dollars(item.price) }));
    }
  }
  if (effects.invest) add('plain', t('invest', { amount: dollars(effects.invest.amount), asset: names.assets[effects.invest.assetId].name }));
  if (effects.pension) add('good', t('pension', { amount: dollars(effects.pension) }));
  if (effects.loan) add('bad', t('loan', { amount: dollars(effects.loan) }));
  if (effects.property) add('plain', t(effects.property.rented ? 'buyRental' : 'buyHome', { home: text.propertyTypes[effects.property.typeId] }));
  if (effects.refinance) add('plain', t(effects.refinance === 'fixed' ? 'refinanceFixed' : 'refinanceVariable'));
  if (effects.sellHome) add('plain', t('sellHome'));
  if (effects.homeValue) add(toneOf(effects.homeValue), t('homeValue', { amount: fmt.briefSigned(indexed(effects.homeValue, world)) }));
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
      return t(order.financed === true ? 'financeItem' : 'buyItem', { item: names.items[order.itemId] });
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

/** Something that happened in a round besides the money. */
export interface RoundNote {
  /** Gold is kept for the escape. */
  tone: Tone | 'gold';
  /** The sprite shown beside it. */
  icon: string;
  title: string;
  hint?: string;
}

/** The order the news of a round is told in: what changes the life first, what was merely not done last. */
const TOLD: ReadonlyArray<GameEvent['kind']> = ['escaped', 'escapeLost', 'bankrupt', 'promoted', 'financeSkill', 'jobHunt', 'moved', 'lapsed', 'orderRejected'];

/** What happened in a round besides the money, the biggest news first. `t` translates the `resolve` section. */
export function roundNotes({ text, names }: Words, t: Translate, events: GameEvent[]): RoundNote[] {
  const told: Array<{ rank: number; note: RoundNote }> = [];
  const add = (event: GameEvent, note: RoundNote) => told.push({ rank: TOLD.indexOf(event.kind), note });
  for (const event of events) {
    switch (event.kind) {
      case 'escaped':
        add(event, { tone: 'gold', icon: 'icon.exit_door', title: t('escaped'), hint: t('escapedHint') });
        break;
      case 'escapeLost':
        add(event, { tone: 'bad', icon: 'icon.cashflow', title: t('escapeLost'), hint: t('escapeLostHint') });
        break;
      case 'bankrupt':
        add(event, { tone: 'bad', icon: 'icon.loan', title: t('bankrupt'), hint: t('bankruptHint') });
        break;
      case 'promoted':
        add(event, { tone: 'good', icon: 'icon.job', title: t('promoted', { title: text.careers[event.careerId].levels[event.level] }) });
        break;
      case 'financeSkill':
        add(event, { tone: 'good', icon: 'icon.skill', title: t('financeSkill', { level: event.level }) });
        break;
      case 'jobHunt':
        add(event, { tone: event.success ? 'good' : 'plain', icon: 'icon.job', title: t(event.success ? 'jobHuntYes' : 'jobHuntNo') });
        break;
      case 'moved':
        add(event, { tone: 'plain', icon: cityIcon(event.cityId), title: t('moved', { city: names.cities[event.cityId] }) });
        break;
      case 'lapsed':
        add(event, { tone: 'bad', icon: 'icon.city', title: t('lapsed', { item: names.items[event.itemId] }), hint: t('lapsedHint') });
        break;
      case 'orderRejected':
        add(event, { tone: 'bad', icon: 'icon.locked', title: t('refused', { reason: text.reasons[event.reason] }) });
        break;
      default:
        break;
    }
  }
  // A stable sort: two events of a kind stay in the order they happened.
  return told.sort((a, b) => a.rank - b.rank).map((entry) => entry.note);
}

/**
 * The net-worth graph: one bar a round. Each bar is given as shares of the graph's height, `y`
 * from the top and `h` tall, with `zero` the line that nothing owned and nothing owed sits on.
 * A round spent in debt hangs below that line.
 */
export function worthBars(history: number[]): { zero: number; bars: Array<{ y: number; h: number; negative: boolean }> } {
  const top = Math.max(0, ...history);
  const bottom = Math.min(0, ...history);
  const span = top - bottom || 1;
  const zero = top / span;
  return {
    zero,
    bars: history.map((value) => (value >= 0 ? { y: (top - value) / span, h: value / span, negative: false } : { y: zero, h: -value / span, negative: true })),
  };
}

/** What an insurance does for whoever holds it, read from the cards themselves so that it is never out of date. */
export interface InsuranceCover {
  /** Cards whose bill it pays part of, with the largest share it pays on that card, in percent. */
  pays: Array<{ cardId: string; pct: number }>;
  /** Cards on which it opens an option that is closed to the uninsured. */
  opens: string[];
}

export function insuranceCover(content: Content, kind: InsuranceKind): InsuranceCover {
  const pays = new Map<string, number>();
  const opens = new Set<string>();
  for (const card of content.cards) {
    for (const option of card.options) {
      if (option.when?.insured === kind) opens.add(card.id);
      for (const effects of [option.effects, ...(option.outcomes ?? []).map((outcome) => outcome.effects)]) {
        const cover = effects?.protection;
        if (cover?.insurance === kind) pays.set(card.id, Math.max(pays.get(card.id) ?? 0, cover.coverPct));
      }
    }
  }
  return { pays: [...pays].map(([cardId, pct]) => ({ cardId, pct })), opens: [...opens] };
}

