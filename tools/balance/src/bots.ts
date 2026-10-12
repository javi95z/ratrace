import { cashflow, focusLeft, homeOf, indexed, previewCard, quoteProperty, stateHash } from '@ratrace/engine';
import type { CardDef, Content, Effects, FocusAction, GameView, LifestyleTier, OptionPreview, Order } from '@ratrace/engine';

/**
 * A bot plays a life the way one kind of player would. It is handed a view of the game, which is
 * all a player ever has: no seed, no dice, no world after the current round. So a bot cannot peek
 * even by mistake.
 */
export interface Bot {
  id: string;
  /** The option to take on the next card of the hand. */
  pick(content: Content, view: GameView): number;
  /** Orders for the finance phase. They run in order, with the cash the player holds after the cards. */
  orders(content: Content, view: GameView): Order[];
}

const usd = (dollars: number) => dollars * 100;

/** An amount in start-of-game dollars, at today's prices. */
const today = (state: GameView, dollars: number) => indexed(usd(dollars), state.timeline[state.round]);

// ---------------------------------------------------------------------------------------------
// Answering cards

type Judge = (card: CardDef, index: number, preview: OptionPreview, state: GameView) => number;

/** Picks, for the next card of the hand, the open option the judge scores highest. Ties go to the earlier option. */
function answer(content: Content, state: GameView, judge: Judge): number {
  const cardId = state.hand[state.answered];
  const card = content.cards.find((c) => c.id === cardId);
  if (!card) return 0;
  const previews = previewCard(content, state, cardId);
  let best = 0;
  let bestScore = judge(card, 0, previews[0], state);
  for (let i = 1; i < card.options.length; i++) {
    if (!previews[i].available) continue;
    const score = judge(card, i, previews[i], state);
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  return best;
}

/** Every effect an option can have: its fixed effects and each of its outcomes. */
const allEffects = (card: CardDef, index: number): Effects[] => {
  const option = card.options[index];
  return [option.effects ?? {}, ...(option.outcomes ?? []).map((o) => o.effects)];
};
const any = (card: CardDef, index: number, test: (effects: Effects) => boolean) => allEffects(card, index).some(test);
const rolls = (card: CardDef, index: number) => (card.options[index].outcomes?.length ?? 0) > 0;

/** Takes what is certain and free; never rolls dice, never spends. */
const cautious: Judge = (card, index, preview) => {
  if (rolls(card, index)) return -1;
  if (any(card, index, (e) => e.loan !== undefined || e.buyItem !== undefined || e.invest !== undefined || e.property !== undefined)) return -1;
  return preview.cash >= 0 ? 1 + preview.cash / 1e9 : preview.cash / 1e9;
};

/** Invests in skills and pay; otherwise cautious. */
const ambitious: Judge = (card, index, preview, state) => {
  const builds = any(card, index, (e) => (e.careerSkill ?? 0) > 0 || (e.financeSkill ?? 0) > 0 || (e.salaryModPct ?? 0) > 0 || (e.job?.levelDelta ?? 0) > 0);
  const hurts = any(card, index, (e) => (e.salaryModPct ?? 0) < 0 || e.loan !== undefined || e.moveCity !== undefined || e.job?.career !== undefined);
  if (builds && !hurts && -preview.cash <= state.player.cash / 2) return 10;
  return cautious(card, index, preview, state);
};

/** Like the ambitious one, and also takes any coins a card offers and whatever teaches the finance to buy more. */
const believer: Judge = (card, index, preview, state) => {
  if (any(card, index, (e) => e.invest !== undefined && ['bitcoin', 'ethereum', 'dogecoin'].includes(e.invest.assetId))) return 100 + index;
  if (any(card, index, (e) => (e.financeSkill ?? 0) > 0) && state.player.life.financeSkill < 2) return 90;
  return ambitious(card, index, preview, state);
};

/** Takes whatever buys an item or grants status. */
const showy: Judge = (card, index, preview, state) => {
  if (any(card, index, (e) => e.buyItem !== undefined || (e.status ?? 0) > 0)) return 100 + index;
  return ambitious(card, index, preview, state);
};

/** Takes a home when one is offered, and the finance skill that renting out needs. */
const builder: Judge = (card, index, preview, state) => {
  if (any(card, index, (e) => e.property !== undefined)) return 100 + index;
  if (any(card, index, (e) => (e.financeSkill ?? 0) > 0) && state.player.life.financeSkill < 2) return 90;
  return ambitious(card, index, preview, state);
};

// ---------------------------------------------------------------------------------------------
// Writing orders

/** Focus actions for the round, in the order given, as far as focus allows. */
function work(state: GameView, actions: FocusAction[]): Order[] {
  if (state.player.life.career === null) return [];
  return actions.slice(0, focusLeft(state.player)).map((action) => ({ type: 'focus', action }));
}

/** The lowest lifestyle tier the life allows. Where the player rents is left as the life began. */
function frugal(state: GameView): Order[] {
  const p = state.player;
  return p.lifestyleTier === p.life.minLifestyleTier ? [] : [{ type: 'setLifestyle', tier: p.life.minLifestyleTier }];
}

/** Pays the credit card down first: nothing a bot can buy earns what the card costs. */
function clearCard(state: GameView): { orders: Order[]; cash: number } {
  const p = state.player;
  const card = p.debts.find((d) => d.kind === 'creditCard');
  if (!card || p.cash <= 0) return { orders: [], cash: p.cash };
  const amount = Math.min(p.cash, card.principal);
  return { orders: [{ type: 'repay', debtId: card.id, amount }], cash: p.cash - amount };
}

/** Keeps a cushion in the savings deposit, so a bad card does not land on the credit card. */
function cushion(state: GameView, cash: number, dollars: number): { orders: Order[]; cash: number } {
  const missing = today(state, dollars) - state.player.deposit;
  const amount = Math.min(cash, Math.max(0, missing));
  return amount > 0 ? { orders: [{ type: 'depositIn', amount }], cash: cash - amount } : { orders: [], cash };
}

/** The highest lifestyle tier whose yearly cost leaves a third of income for tax and for shopping. */
function grandestAffordable(content: Content, state: GameView): LifestyleTier {
  const p = state.player;
  const flow = cashflow(content, state);
  const income = flow.salaryAnnual + flow.passiveAnnual;
  const multipliers = content.lifestyleMultiplierPct;
  // Living cost is not broken out of the yearly expenses, so scale all of them: a fair first guess for a tenant.
  for (const tier of [3, 2, 1] as const) {
    if (tier < p.life.minLifestyleTier) break;
    const cost = Math.floor((flow.expensesAnnual * multipliers[tier]) / multipliers[p.lifestyleTier]);
    if (cost * 3 <= income * 2) return tier;
  }
  return p.life.minLifestyleTier;
}

const saver: Bot = {
  id: 'saver',
  pick: (content, state) => answer(content, state, ambitious),
  orders: (_content, state) => {
    const card = clearCard(state);
    const orders = [...frugal(state), ...work(state, ['studyCareer', 'overtime', 'jobHunt']), ...card.orders];
    if (card.cash > 0) orders.push({ type: 'depositIn', amount: card.cash });
    return orders;
  },
};

const indexer: Bot = {
  id: 'indexer',
  pick: (content, state) => answer(content, state, ambitious),
  orders: (_content, state) => {
    const card = clearCard(state);
    const safe = cushion(state, card.cash, 3_000);
    const orders = [...frugal(state), ...work(state, ['studyCareer', 'overtime', 'jobHunt']), ...card.orders, ...safe.orders];
    if (safe.cash > 0) orders.push({ type: 'buy', assetId: 'msci_world', amount: safe.cash });
    return orders;
  },
};

/**
 * The indexer's twin, who believes in coins instead. It lives as cheaply, works as hard and keeps
 * the same cushion; it never borrows and never sells a coin. So the only thing that sets the two
 * apart is what they hold, and what happens to the gambler is what crypto does.
 *
 * Coins need finance skill, so until it has enough it holds the index fund, which is also what
 * teaches the first level, and it moves everything across the day it is allowed to.
 */
const gambler: Bot = {
  id: 'gambler',
  pick: (content, state) => answer(content, state, believer),
  orders: (content, state) => {
    const p = state.player;
    const card = clearCard(state);
    const safe = cushion(state, card.cash, 3_000);
    const orders = [...frugal(state), ...work(state, ['studyCareer', 'overtime', 'jobHunt']), ...card.orders, ...safe.orders];
    let cash = safe.cash;

    if (p.life.financeSkill < 2) {
      if (cash > 0) orders.push({ type: 'buy', assetId: 'msci_world', amount: cash });
      return orders;
    }
    for (const [assetId, held] of Object.entries(p.positions)) {
      const asset = content.assets.find((a) => a.id === assetId);
      if (asset && asset.class !== 'crypto') {
        orders.push({ type: 'sell', assetId, amount: held.value });
        cash += held.value;
      }
    }
    const half = Math.floor(cash / 2);
    const quarter = Math.floor(cash / 4);
    if (half > 0) orders.push({ type: 'buy', assetId: 'bitcoin', amount: half });
    if (quarter > 0) orders.push({ type: 'buy', assetId: 'ethereum', amount: quarter }, { type: 'buy', assetId: 'dogecoin', amount: quarter });
    return orders;
  },
};

const chaser: Bot = {
  id: 'chaser',
  pick: (content, state) => answer(content, state, showy),
  orders: (content, state) => {
    const p = state.player;
    const world = state.timeline[state.round];
    const orders: Order[] = [...work(state, ['overtime', 'jobHunt', 'studyCareer'])];
    const tier = grandestAffordable(content, state);
    if (p.lifestyleTier !== tier) orders.push({ type: 'setLifestyle', tier });
    if (p.life.rentTier !== 1) orders.push({ type: 'setRentTier', tier: 1 });

    // The card comes first; then the grandest things, as long as the money lasts.
    const card = clearCard(state);
    orders.push(...card.orders);
    let cash = card.cash;
    const wanted = content.items
      .filter((item) => item.cardOnly !== true && !p.life.items.some((owned) => owned.itemId === item.id))
      .sort((a, b) => b.status - a.status);
    for (const item of wanted) {
      const price = indexed(item.price, world);
      if (price <= cash) {
        orders.push({ type: 'buyItem', itemId: item.id });
        cash -= price;
      }
    }
    return orders;
  },
};

const landlord: Bot = {
  id: 'landlord',
  pick: (content, state) => answer(content, state, builder),
  orders: (content, state) => {
    const p = state.player;
    const card = clearCard(state);
    const orders: Order[] = [...frugal(state), ...work(state, ['studyCareer', 'overtime', 'jobHunt']), ...card.orders];
    let cash = card.cash + p.deposit;
    if (p.deposit > 0) orders.push({ type: 'depositOut', amount: p.deposit });

    const canBorrow = state.round >= p.bankruptUntilRound;
    const canRentOut = p.life.financeSkill >= content.life.rentOutMinFinanceSkill;
    const hasHome = homeOf(p, content) !== null;
    const yearly = cashflow(content, state);
    const reserve = Math.floor(yearly.expensesAnnual / 2);

    // A home of one's own first; then one more to rent out whenever the money is there.
    for (let bought = 0; bought < 2 && canBorrow && (!hasHome || canRentOut); bought++) {
      const rented = hasHome || bought > 0;
      if (rented && !canRentOut) break;
      const quote = quoteProperty(content, state, 'studio');
      if (cash < quote.minDown + quote.purchaseTax + reserve) break;
      orders.push({ type: 'buyProperty', typeId: 'studio', downPayment: quote.minDown, mortgage: 'fixed', rented });
      cash -= quote.minDown + quote.purchaseTax;
      if (!hasHome && bought === 0 && !canRentOut) break;
    }
    if (cash > 0) orders.push({ type: 'depositIn', amount: cash });
    return orders;
  },
};

/** A small generator seeded from what the bot can see, so the random bot plays the same life the same way on every run. */
function dice(state: GameView): () => number {
  let h = 2166136261;
  for (const ch of stateHash(state)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const random: Bot = {
  id: 'random',
  pick: (_content, state) => Math.floor(dice(state)() * 3),
  orders: (content, state) => {
    const roll = dice(state);
    const p = state.player;
    const pick = <T>(list: readonly T[]): T => list[Math.floor(roll() * list.length)];
    const part = () => Math.max(1, Math.floor(p.cash * roll() * 0.5));
    const orders: Order[] = [];
    for (let i = 0; i < 4; i++) {
      switch (Math.floor(roll() * 9)) {
        case 0:
          orders.push({ type: 'buy', assetId: pick(content.assets).id, amount: part() });
          break;
        case 1: {
          const held = Object.entries(p.positions);
          if (held.length > 0) {
            const [assetId, position] = pick(held);
            orders.push({ type: 'sell', assetId, amount: Math.max(1, Math.floor(position.value * roll())) });
          }
          break;
        }
        case 2:
          orders.push({ type: 'depositIn', amount: part() });
          break;
        case 3:
          orders.push({ type: 'focus', action: pick(['overtime', 'studyCareer', 'jobHunt'] as const) });
          break;
        case 4:
          orders.push({ type: 'buyItem', itemId: pick(content.items).id });
          break;
        case 5:
          orders.push({ type: 'setLifestyle', tier: pick([0, 1, 2, 3] as const) });
          break;
        case 6:
          orders.push({ type: 'borrow', amount: part() });
          break;
        case 7:
          orders.push({ type: 'pensionIn', amount: part() });
          break;
        default:
          orders.push({ type: 'setInsurance', insurance: pick(['health', 'home', 'life', 'liability'] as const), on: roll() < 0.5 });
      }
    }
    return orders;
  },
};

export const bots: Bot[] = [saver, indexer, gambler, chaser, landlord, random];
