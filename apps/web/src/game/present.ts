import { badges, businessArt, homeName, careerArt, cityIcon, focusArt, RARITIES, rarityOf, repairArt, skillArt, START_AGE } from '@ratrace/content';
import type { BadgeDef, CityLight, ContentText, Ending, Names } from '@ratrace/content';
import { indexed, isStudy, ITEM_PERKS, SKILLS } from '@ratrace/engine';
import type { CardDef, Content, Debt, Effects, GameEvent, ItemPerks, GameView, Headline, InsuranceKind, Order, PlayerState, Property, WorldState } from '@ratrace/engine';
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

/** One of the ways a forecast is said, the `n`th going round. */
const way = (ways: readonly string[], n: number): string => ways[((n % ways.length) + ways.length) % ways.length];

/** A headline as a sentence. `n` picks among the ways it can be said: the screen passes something that changes each round. */
export function headlineText({ text, names }: Words, h: Headline, n = 0): string {
  switch (h.topic) {
    case 'regime':
      return way(text.headlines.regime[h.regime], n);
    case 'crypto':
      return way(text.headlines.crypto[h.phase], n);
    case 'rates':
      return way(text.headlines.rates[h.trend], n);
    case 'inflation':
      return way(text.headlines.inflation[h.trend], n);
    case 'property':
      return text.headlines.property[h.trend].replace('{city}', names.cities[h.cityId]);
    case 'asset':
      return text.headlines.asset[h.trend].replace('{asset}', names.assets[h.assetId]?.name ?? h.assetId);
    case 'taxes':
      return text.headlines.taxes[h.trend].replace('{city}', names.cities[h.cityId]);
    case 'noise':
      return text.headlines.noise[h.id] ?? '';
    case 'government':
      return text.headlines.government[h.id] ?? '';
  }
}

export type Tone = 'good' | 'bad' | 'plain';

export interface EffectTag {
  tone: Tone;
  text: string;
}

const signed = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);
const toneOf = (n: number): Tone => (n > 0 ? 'good' : 'bad');

/** How a life ended, for its last picture: out of the rat race, with nothing, or simply retired. */
export function endingOf(escaped: boolean, worth: number): Ending {
  return escaped ? 'escaped' : worth <= 0 ? 'ruined' : 'retired';
}

/**
 * How the player's city is drawn in a round: under the rain in a crisis or a recession, with cranes
 * and fireworks in a boom, and otherwise by day while the news is read and by night after.
 */
export function cityLight(world: Pick<WorldState, 'regime' | 'crisis'>, reading: boolean): CityLight {
  if (world.crisis || world.regime === 'recession') return 'crisis';
  if (world.regime === 'boom') return 'boom';
  return reading ? 'day' : 'night';
}

/** What a thing is good for beyond its status, a line for each use. `t` translates the `effects` section. */
export function perkLines(t: Translate, perks: ItemPerks | undefined): string[] {
  if (perks === undefined) return [];
  return ITEM_PERKS.filter((perk) => (perks[perk] ?? 0) > 0).map((perk) => t(`perks.${perk}`, { n: perks[perk] ?? 0 }));
}

/**
 * What a debt is called: its kind, and what it bought. A mortgage is named for the home it is on,
 * found among the properties given; a loan taken to buy a thing, for the thing.
 */
export function debtLabel(words: Words, debt: Pick<Debt, 'kind' | 'forItem' | 'forAsset'> & { id?: string }, properties: ReadonlyArray<Property> = []): string {
  const kind = words.text.debts[debt.kind];
  const home = debt.id === undefined ? undefined : properties.find((property) => property.mortgageId === debt.id);
  if (home) return `${kind} · ${homeName(words.text, home.typeId, home.cityId)}, ${words.names.cities[home.cityId]}`;
  if (debt.forAsset !== undefined && words.names.assets[debt.forAsset] !== undefined) return `${kind} · ${words.names.assets[debt.forAsset].name}`;
  return debt.forItem !== undefined && words.names.items[debt.forItem] !== undefined ? `${kind} · ${words.names.items[debt.forItem]}` : kind;
}

/**
 * What a card option does, as short tags. Cash is not here: the caller shows the exact figure the
 * engine's preview gives, which already counts insurance, discounts and purchase tax.
 * `t` translates the `effects` section.
 */
export function effectTags(words: Words, t: Translate, world: WorldState, effects: Effects | undefined, partnered = false): EffectTag[] {
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
  for (const skill of SKILLS) {
    const points = effects.skills?.[skill];
    if (points) add(toneOf(points), t('skill', { skill: text.skills[skill], value: signed(points) }));
  }
  if (effects.status) add(toneOf(effects.status), t('status', { value: signed(effects.status) }));
  // A flag that a later card's bill is paid from, such as having a tax advisor, is said with the share it pays.
  for (const flag of effects.setFlags ?? []) {
    const pct = flagCover(content, flag);
    if (pct > 0) add('good', t('coversInspection', { pct }));
  }
  if (effects.focus) add('bad', t('focus', { value: signed(-effects.focus) }));
  for (const entry of effects.recurring ?? []) {
    const income = entry.kind === 'passive';
    const amount = dollars(entry.annual);
    if (entry.roundsLeft === null) add(income ? 'good' : 'bad', t(income ? 'yearlyIncome' : 'yearlyCost', { amount }));
    else add(income ? 'good' : 'bad', t(income ? 'yearlyIncomeFor' : 'yearlyCostFor', { amount, years: entry.roundsLeft * content.yearsPerRound }));
  }
  if (effects.retire) add('plain', t('retire'));
  if (effects.focusBase) add(toneOf(effects.focusBase), t('focusBase', { value: signed(effects.focusBase) }));
  if (effects.businessesPct) add(toneOf(effects.businessesPct), t('businessesPct', { value: signed(effects.businessesPct) }));
  if (effects.suspicion) add(toneOf(-effects.suspicion), t('suspicion', { value: signed(effects.suspicion) }));
  if (effects.amnesty) add('plain', t('amnesty', { pct: effects.amnesty.pct }));
  if (effects.launder) add('plain', t('launder', { pct: effects.launder.feePct }));
  if (effects.jail) add('bad', t('jail', { n: effects.jail.rounds }));
  if (effects.workMode === 'remote') add('good', t('remote'));
  if (effects.endLodger) add('plain', t('endLodger'));
  if (effects.gift?.liquidPct) add('bad', t('giftSavings', { pct: effects.gift.liquidPct }));
  if (effects.gift?.business) add('bad', t('giftBusiness'));
  if (effects.gift) add('good', t('giftCounts', { pct: content.life.giftTaxPct }));
  if (effects.job?.leave) add('plain', t('leaveJob'));
  else if (effects.job?.career) add('plain', t('newCareer', { career: text.careers[effects.job.career].name }));
  else if ((effects.job?.levelDelta ?? 0) > 0) add('good', t('promotion'));
  else if ((effects.job?.levelDelta ?? 0) < 0) add('bad', t('demotion'));
  if (effects.moveCity) add('plain', t('moveTo', { city: names.cities[effects.moveCity] }));
  if (effects.partner === null) add('plain', t('partnerOut'));
  // Someone already with a partner is told what it does to their pay; someone without, that a life is shared.
  else if (effects.partner !== undefined) add(partnered ? (effects.partner.salaryPct >= 100 ? 'good' : 'bad') : 'plain', partnered ? t('partnerPay', { pct: effects.partner.salaryPct }) : t('partnerIn'));
  if (effects.children) add('plain', t('children', { count: effects.children }));
  if (effects.buyItem) {
    // A thing is taken for what it gives: the name alone says nothing of the status, how long it lasts, or the bargain.
    const { itemId, pricePct } = effects.buyItem;
    const item = content.items.find((x) => x.id === itemId);
    add('plain', t('get', { item: names.items[itemId] }));
    if (item) {
      if (item.status > 0) add('good', item.kind === 'experience' ? t('itemStatusFor', { n: item.status, years: item.boostRounds * content.yearsPerRound }) : t('itemStatus', { n: item.status }));
      if (item.upkeepAnnual > 0) add('bad', t('yearlyCost', { amount: dollars(item.upkeepAnnual) }));
      for (const line of perkLines(t, item.perks)) add('good', line);
      if (pricePct < 100) add('plain', t('itemUsual', { amount: dollars(item.price) }));
    }
  }
  if (effects.business) add('plain', t('openBusiness', { name: text.businessTypes[effects.business.typeId]?.name ?? effects.business.typeId }));
  if (effects.sellBusiness) add('good', t('sellBusiness', { pct: effects.sellBusiness.pricePct }));
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
    return property ? homeName(text, property.typeId, property.cityId) : '';
  };
  const business = (businessId: string) => {
    const owned = player.businesses.find((b) => b.id === businessId);
    return owned ? (text.businessTypes[owned.typeId]?.name ?? owned.typeId) : '';
  };
  switch (order.type) {
    case 'buy':
      if ((order.margin ?? 0) > 0) return t('buyMargin', { name: names.assets[order.assetId]?.name ?? order.assetId, amount: fmt.money(order.amount + (order.margin ?? 0)), own: fmt.money(order.amount) });
      return t('buy', { name: names.assets[order.assetId]?.name ?? order.assetId, amount: fmt.money(order.amount) });
    case 'sell':
      return t('sell', { name: names.assets[order.assetId]?.name ?? order.assetId, amount: fmt.money(order.amount) });
    case 'depositIn':
      return t('save', { amount: fmt.money(order.amount) });
    case 'depositOut':
      return t('withdraw', { amount: fmt.money(order.amount) });
    case 'pensionIn':
      return t('pension', { amount: fmt.money(order.amount) });
    case 'setReinvest':
      return t(order.on ? 'reinvestOn' : 'reinvestOff');
    case 'startBusiness':
      return t('startBusiness', { name: text.businessTypes[order.typeId]?.name ?? order.typeId, amount: fmt.money(order.capital) });
    case 'investBusiness':
      return t('investBusiness', { name: business(order.businessId), amount: fmt.money(order.amount) });
    case 'setBusiness':
      return t('setBusiness', { name: business(order.businessId) });
    case 'tendBusiness':
      return t('tendBusiness', { name: business(order.businessId) });
    case 'sellBusiness':
      return t('sellBusiness', { name: business(order.businessId) });
    case 'setPlan':
      return t(order.amount > 0 ? 'planOn' : 'planOff', { name: names.assets[order.assetId]?.name ?? order.assetId, amount: fmt.money(order.amount) });
    case 'borrow':
      return t('borrow', { amount: fmt.money(order.amount) });
    case 'repay': {
      const debt = player.debts.find((d) => d.id === order.debtId);
      return t('repay', { name: debt ? debtLabel(words, debt, player.properties) : '', amount: fmt.money(order.amount) });
    }
    case 'buyProperty':
      return t(order.rented ? 'buyRental' : 'buyHome', { home: homeName(text, order.typeId, player.cityId) });
    case 'sellProperty':
      return t('sellHome', { home: home(order.propertyId) });
    case 'setRented':
      return t(order.rented ? 'rentOn' : 'rentOff', { home: home(order.propertyId) });
    case 'focus':
      return isStudy(order.action) ? text.focusActions[order.action] : t(order.action === 'overtime' ? 'overtime' : order.action === 'studyCareer' ? 'study' : order.action === 'askRaise' ? 'raise' : 'hunt');
    case 'setWorkMode':
      return t(`work.${order.mode}`);
    case 'goFullTime':
      return t('goFullTime', { name: business(order.businessId) });
    case 'backToWork':
      return t('backToWork');
    case 'setLodger':
      return t(order.on ? 'lodgerOn' : 'lodgerOff');
    case 'buyItem':
      return t(order.noInvoice === true ? 'buyNoInvoiceItem' : order.used === true ? 'buyUsedItem' : order.financed === true ? 'financeItem' : 'buyItem', { item: names.items[order.itemId] });
    case 'setEvasion': {
      // One line for each part the order changes.
      const parts: string[] = [];
      if (order.blackPct !== undefined) parts.push(t('evasionBlack', { pct: order.blackPct }));
      if (order.shell !== undefined) parts.push(t(order.shell ? 'evasionShellOn' : 'evasionShellOff'));
      if (order.hideCrypto !== undefined) parts.push(t(order.hideCrypto ? 'evasionCryptoOn' : 'evasionCryptoOff'));
      return parts.join(' · ');
    }
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
    case 'retire':
      return t('retire');
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
  /** Something to celebrate: drawn with a burst of confetti in place of its sprite. */
  cheer?: boolean;
}

/** The order the news of a round is told in: what changes the life first, what was merely not done last. */
const TOLD: ReadonlyArray<GameEvent['kind']> = ['escaped', 'escapeLost', 'bankrupt', 'audit', 'charged', 'released', 'promoted', 'financeSkill', 'skill', 'repair', 'marginCall', 'businessClosed', 'businessSold', 'jobHunt', 'raise', 'overworked', 'planRan', 'moved', 'homecoming', 'lapsed', 'orderRejected'];

/** What happened in a round besides the money, the biggest news first. `t` translates the `resolve` section. */
export function roundNotes({ content, text, names, fmt }: Words, t: Translate, events: GameEvent[]): RoundNote[] {
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
        add(event, { tone: 'good', icon: careerArt(event.careerId), title: t('promoted', { title: text.careers[event.careerId].levels[event.level] }), cheer: true });
        break;
      case 'financeSkill':
        add(event, { tone: 'good', icon: skillArt.finance, title: t('financeSkill', { level: event.level }) });
        break;
      case 'charged':
        add(event, { tone: 'bad', icon: 'icon.tax', title: t('charged'), hint: t('chargedHint') });
        break;
      case 'released':
        add(event, { tone: 'good', icon: 'icon.exit_door', title: t('released'), hint: event.rungsLost > 0 ? t('releasedRung') : undefined });
        break;
      case 'audit':
        add(event, {
          tone: 'bad',
          icon: 'icon.tax',
          title: t('audit', { amount: fmt.money(event.evaded + event.fine + event.goods) }),
          hint: t('auditHint', { evaded: fmt.money(event.evaded), fine: fmt.money(event.fine), goods: fmt.money(event.goods) }),
        });
        break;
      case 'repair':
        add(event, { tone: 'bad', icon: repairArt(content.items.find((item) => item.id === event.itemId)?.ladder ?? ''), title: t('repair', { item: names.items[event.itemId], amount: fmt.money(event.amount) }) });
        break;
      case 'skill':
        add(event, { tone: 'good', icon: skillArt[event.skill], title: t('skill', { skill: text.skills[event.skill], level: event.level }) });
        break;
      case 'businessSold':
        add(event, { tone: 'good', icon: businessArt(event.typeId), title: t('businessSold', { name: text.businessTypes[event.typeId]?.name ?? event.typeId, amount: fmt.money(event.price) }) });
        break;
      case 'businessClosed':
        add(event, { tone: 'bad', icon: businessArt(event.typeId), title: t('businessClosed', { name: text.businessTypes[event.typeId]?.name ?? event.typeId }), hint: t('businessClosedHint') });
        break;
      case 'marginCall':
        add(event, {
          tone: 'bad',
          icon: 'icon.loan',
          title: t('marginCall', { name: names.assets[event.assetId]?.name ?? event.assetId }),
          hint: t(event.sold >= event.repaid ? 'marginCallHint' : 'marginCallShort', { sold: fmt.money(event.sold), repaid: fmt.money(event.repaid), short: fmt.money(Math.max(0, event.repaid - event.sold)) }),
        });
        break;
      case 'planRan':
        // A plan that bought is in the ledger with every other purchase. One that could not is news.
        if (event.reason !== null) {
          add(event, { tone: 'bad', icon: 'icon.fund', title: t('planMissed', { name: names.assets[event.assetId]?.name ?? event.assetId, amount: fmt.money(event.amount) }), hint: text.reasons[event.reason] });
        }
        break;
      case 'homecoming':
        add(event, {
          tone: event.triumphant ? 'gold' : 'good',
          icon: 'icon.family',
          title: t(event.triumphant ? 'homeTriumph' : 'homeAgain'),
          hint: [event.gift > 0 ? t('homeHelped', { amount: fmt.money(event.gift) }) : '', t('homeFriends')].filter(Boolean).join(' '),
        });
        break;
      case 'jobHunt':
        add(event, { tone: event.success ? 'good' : 'plain', icon: 'icon.job', title: t(event.success ? 'jobHuntYes' : 'jobHuntNo') });
        break;
      case 'raise':
        add(event, { tone: event.success ? 'good' : 'plain', icon: focusArt.askRaise, title: event.success ? t('raiseYes', { pct: event.pct }) : t('raiseNo') });
        break;
      case 'overworked':
        // Overtime round after round: the health it cost, and a burnout that takes focus from the next round too.
        add(event, {
          tone: 'bad',
          icon: event.burnout ? focusArt.overtime : skillArt.health,
          title: t(event.burnout ? 'burnout' : 'overworked', { n: event.streak }),
          hint: event.burnout ? t('burnoutHint', { health: event.healthLost, focus: event.focusLost }) : event.healthLost > 0 ? t('overworkedHint', { health: event.healthLost }) : undefined,
        });
        break;
      case 'moved':
        add(event, {
          tone: 'plain',
          icon: cityIcon(event.cityId),
          title: t('moved', { city: names.cities[event.cityId] }),
          // What the move cost besides its price, said once it has happened.
          hint: [event.rungsLost > 0 ? t('movedRung') : '', event.partnerIdle ? t('movedPartner') : ''].filter(Boolean).join(' ') || undefined,
        });
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

/** The largest share of a card's bill that a flag pays, in percent: none for a flag that pays nothing. */
export function flagCover(content: Content, flag: string): number {
  let best = 0;
  for (const card of content.cards)
    for (const option of card.options)
      for (const effects of [option.effects, ...(option.outcomes ?? []).map((outcome) => outcome.effects)])
        if (effects?.protection?.flag === flag) best = Math.max(best, effects.protection.coverPct);
  return best;
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


/** The rarest of the badges a life won for the first time, if any of them was rare or legendary: the one the end of the life cheers. */
export function prizedBadge(won: readonly string[]): BadgeDef | undefined {
  return badges
    .filter((badge) => won.includes(badge.id) && (rarityOf(badge.id) === 'rare' || rarityOf(badge.id) === 'legendary'))
    .sort((a, b) => RARITIES.indexOf(rarityOf(b.id)) - RARITIES.indexOf(rarityOf(a.id)))[0];
}

/**
 * What a personal loan of `amount` costs, round by round, as the engine charges it: an even slice
 * of what was lent each round, plus the interest of that round on what is still owed.
 */
export function loanPlan(amount: number, rateBp: number, termRounds: number, yearsPerRound: number): { payments: number[]; interest: number } {
  const payments: number[] = [];
  let owed = amount;
  let interest = 0;
  for (let left = termRounds; left >= 1 && owed > 0; left -= 1) {
    const charged = Math.round((owed * rateBp * yearsPerRound) / 10_000);
    const slice = left <= 1 ? owed : Math.ceil(owed / left);
    payments.push(slice + charged);
    interest += charged;
    owed -= slice;
  }
  return { payments, interest };
}

/**
 * How rare a card is to be dealt, for how it is shown: one that comes up in one life out of many
 * shines. World cards are the same for everyone and are never rare.
 */
export function cardRarity(def: Pick<CardDef, 'category' | 'weight'>): 'legendary' | 'rare' | null {
  if (def.category === 'world') return null;
  if (def.weight <= 2) return 'legendary';
  if (def.weight <= 3) return 'rare';
  return null;
}
