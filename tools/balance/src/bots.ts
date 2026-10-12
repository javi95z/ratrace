import { cashflow, focusLeft, homeOf, indexed, previewCard, propertyPrice } from '@ratrace/engine';
import type { CardDef, CardPicks, Content, Effects, FocusAction, GameState, LifestyleTier, OptionPreview, Order } from '@ratrace/engine';

/**
 * A bot plays a life the way one kind of player would. It sees what a player sees:
 * the state up to the current round, and what each card option would do. It never reads a future world.
 */
export interface Bot {
  id: string;
  /** Answers to the cards in the hand. */
  picks(content: Content, state: GameState): CardPicks;
  /** Orders for the finance phase. They run in order, with the cash the player holds after the cards. */
  orders(content: Content, state: GameState): Order[];
}

const usd = (dollars: number) => dollars * 100;

/** An amount in start-of-game dollars, at today's prices. */
const today = (state: GameState, dollars: number) => indexed(usd(dollars), state.timeline[state.round]);

// ---------------------------------------------------------------------------------------------
// Answering cards

type Judge = (card: CardDef, index: number, preview: OptionPreview, state: GameState) => number;

/** Picks, for each card, the open option the judge scores highest. Ties go to the earlier option. */
function answer(content: Content, state: GameState, judge: Judge): CardPicks {
  const picks: CardPicks = {};
  for (const cardId of state.hand) {
    const card = content.cards.find((c) => c.id === cardId);
    if (!card) continue;
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
    picks[cardId] = best;
  }
  return picks;
}

/** Every effect an option can have: its fixed effects and each of its outcomes. */
const allEffects = (card: CardDef, index: number): Effects[] => {
  const option = card.options[index];
  return [option.effects ?? {}, ...(option.outcomes ?? []).map((o) => o.effects)];
};
const any = (card: CardDef, index: number, test: (effects: Effects) => boolean) => allEffects(card, index).some(test);
const rolls = (card: CardDef, index: number) => (card.options[index].outcomes?.length ?? 0) > 0;

/** Cash the option brings on average, weighing each outcome by its chance. */
function expectedCash(preview: OptionPreview): number {
  let total = 0;
  for (const outcome of preview.outcomes) total += outcome.weight;
  let expected = preview.cash;
  for (const outcome of preview.outcomes) expected += (outcome.cash * outcome.weight) / total;
  return expected;
}

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

/** Takes the gamble with the best average, and anything with crypto in it. */
const reckless: Judge = (card, index, preview, state) => {
  if (any(card, index, (e) => e.invest !== undefined && ['bitcoin', 'ethereum', 'dogecoin', 'tesla'].includes(e.invest.assetId))) return 100 + index;
  if (any(card, index, (e) => (e.financeSkill ?? 0) > 0) && state.player.life.financeSkill < 2) return 90;
  if (rolls(card, index)) return 50 + expectedCash(preview) / 1e9;
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
function work(state: GameState, actions: FocusAction[]): Order[] {
  if (state.player.life.career === null) return [];
  return actions.slice(0, focusLeft(state.player)).map((action) => ({ type: 'focus', action }));
}

/** The lowest lifestyle tier the life allows. Where the player rents is left as the life began. */
function frugal(state: GameState): Order[] {
  const p = state.player;
  return p.lifestyleTier === p.life.minLifestyleTier ? [] : [{ type: 'setLifestyle', tier: p.life.minLifestyleTier }];
}

/** Pays the credit card down first: nothing a bot can buy earns what the card costs. */
function clearCard(state: GameState): { orders: Order[]; cash: number } {
  const p = state.player;
  const card = p.debts.find((d) => d.kind === 'creditCard');
  if (!card || p.cash <= 0) return { orders: [], cash: p.cash };
  const amount = Math.min(p.cash, card.principal);
  return { orders: [{ type: 'repay', debtId: card.id, amount }], cash: p.cash - amount };
}

/** Keeps a cushion in the savings deposit, so a bad card does not land on the credit card. */
function cushion(state: GameState, cash: number, dollars: number): { orders: Order[]; cash: number } {
  const missing = today(state, dollars) - state.player.deposit;
  const amount = Math.min(cash, Math.max(0, missing));
  return amount > 0 ? { orders: [{ type: 'depositIn', amount }], cash: cash - amount } : { orders: [], cash };
}

/** The highest lifestyle tier whose yearly cost leaves a third of income for tax and for shopping. */
function grandestAffordable(content: Content, state: GameState): LifestyleTier {
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
  picks: (content, state) => answer(content, state, ambitious),
  orders: (_content, state) => {
    const card = clearCard(state);
    const orders = [...frugal(state), ...work(state, ['studyCareer', 'overtime', 'jobHunt']), ...card.orders];
    if (card.cash > 0) orders.push({ type: 'depositIn', amount: card.cash });
    return orders;
  },
};

const indexer: Bot = {
  id: 'indexer',
  picks: (content, state) => answer(content, state, ambitious),
  orders: (_content, state) => {
    const card = clearCard(state);
    const safe = cushion(state, card.cash, 3_000);
    const orders = [...frugal(state), ...work(state, ['studyCareer', 'overtime', 'jobHunt']), ...card.orders, ...safe.orders];
    if (safe.cash > 0) orders.push({ type: 'buy', assetId: 'msci_world', amount: safe.cash });
    return orders;
  },
};

/** What the player's coins are worth today. */
function coins(content: Content, state: GameState): number {
  let total = 0;
  for (const asset of content.assets) {
    if (asset.class === 'crypto' && Object.hasOwn(state.player.positions, asset.id)) total += state.player.positions[asset.id].value;
  }
  return total;
}

/**
 * The tier a gambler feels rich enough for: the highest one that the coins could pay for five years of.
 * Scaling all yearly expenses by the tier multiplier is a fair first guess for a tenant.
 */
function paperRichTier(content: Content, state: GameState): LifestyleTier {
  const p = state.player;
  const held = coins(content, state);
  const flow = cashflow(content, state);
  const multipliers = content.lifestyleMultiplierPct;
  for (const tier of [3, 2] as const) {
    const cost = Math.floor((flow.expensesAnnual * multipliers[tier]) / multipliers[p.lifestyleTier]);
    if (held >= cost * 5) return tier;
  }
  return 0;
}

/**
 * Four rules, none of them tuned to a result:
 * borrow the maximum; put everything into coins; live up to paper gains and never back down;
 * sell coins only when the credit card demands it.
 */
const gambler: Bot = {
  id: 'gambler',
  picks: (content, state) => answer(content, state, reckless),
  orders: (content, state) => {
    const p = state.player;
    const world = state.timeline[state.round];
    const orders: Order[] = [...work(state, ['overtime', 'jobHunt', 'studyCareer'])];
    const tier = Math.max(p.lifestyleTier, paperRichTier(content, state)) as LifestyleTier;
    if (tier !== p.lifestyleTier) orders.push({ type: 'setLifestyle', tier });
    let cash = p.cash;

    const card = p.debts.find((d) => d.kind === 'creditCard');
    if (card) {
      let needed = card.principal - cash;
      for (const [assetId, held] of Object.entries(p.positions)) {
        if (needed <= 0) break;
        const amount = Math.min(held.value, needed);
        orders.push({ type: 'sell', assetId, amount });
        cash += amount;
        needed -= amount;
      }
      const paid = Math.min(cash, card.principal);
      if (paid > 0) {
        orders.push({ type: 'repay', debtId: card.id, amount: paid });
        cash -= paid;
      }
    }

    if (state.round >= p.bankruptUntilRound) {
      let loans = 0;
      for (const d of p.debts) if (d.kind === 'personalLoan') loans += d.principal;
      const room = Math.floor((indexed(p.salaryAnnual, world) * content.debt.personalLoanMaxIncomePct) / 100) - loans;
      if (room > today(state, 1_000)) {
        orders.push({ type: 'borrow', amount: room });
        cash += room;
      }
    }
    if (cash <= 0) return orders;

    if (p.life.financeSkill < 2) {
      // Not allowed near crypto yet. Holding anything for three rounds teaches one level.
      orders.push({ type: 'buy', assetId: 'sp500', amount: cash });
      return orders;
    }
    if (!card) {
      for (const [assetId, held] of Object.entries(p.positions)) {
        const asset = content.assets.find((a) => a.id === assetId);
        if (asset && asset.class !== 'crypto') {
          orders.push({ type: 'sell', assetId, amount: held.value });
          cash += held.value;
        }
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
  picks: (content, state) => answer(content, state, showy),
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
  picks: (content, state) => answer(content, state, builder),
  orders: (content, state) => {
    const p = state.player;
    const world = state.timeline[state.round];
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
      const price = propertyPrice(content, world, p.cityId, 'studio');
      const down = price - Math.floor((price * content.debt.mortgageMaxLtvBp) / 10_000);
      const tax = Math.ceil((price * 1_000) / 10_000);
      if (cash < down + tax + reserve) break;
      orders.push({ type: 'buyProperty', typeId: 'studio', downPayment: down, mortgage: 'fixed', rented });
      cash -= down + tax;
      if (!hasHome && bought === 0 && !canRentOut) break;
    }
    if (cash > 0) orders.push({ type: 'depositIn', amount: cash });
    return orders;
  },
};

/** A small generator seeded from the game, so the random bot is the same on every run. */
function dice(state: GameState): () => number {
  let h = 2166136261;
  for (const ch of `${state.seed}:${state.round}:${state.phase}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const random: Bot = {
  id: 'random',
  picks: (_content, state) => {
    const roll = dice(state);
    return Object.fromEntries(state.hand.map((id) => [id, Math.floor(roll() * 3)]));
  },
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
