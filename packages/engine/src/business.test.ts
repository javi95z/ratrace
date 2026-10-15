import { describe, expect, it } from 'vitest';
import { businessRound, businessSalePrice } from './business';
import { applyCard, applyRound, createGame, previewRound } from './game';
import { findInvariantBreaks } from './invariants';
import { quoteBusinesses, quotePortfolio } from './quotes';
import { netWorth } from './selectors';
import { fixtureContent, fixtureStart } from './testing/fixture';
import { withPlayer } from './testing/patch';
import type { Business, CardDef, Content, FinanceSkill, GameEvent, GameState, LedgerLine, Order, Regime } from './types';
import { validateContent, validateStart } from './validate';
import { viewOf } from './view';

const content = fixtureContent();
const game = (cash: number, financeSkill: FinanceSkill = 2, c: Content = content, seed = 'business'): GameState =>
  createGame({ content: c, start: { ...fixtureStart(), cash, life: { lifeId: 'tester', career: { id: 'office', level: 0 }, careerSkill: 0, financeSkill, focus: 3 } } }, seed);
const start = (capital: number, typeId = 'stall'): Order => ({ type: 'startBusiness', typeId, capital });
const stall = (over: Partial<Business> = {}): Business => ({ id: 'business-9', typeId: 'stall', capital: 10_000_000, basis: 10_000_000, payoutPct: 50, manager: false, tended: true, ...over });
const owning = (state: GameState, ...businesses: Business[]) => withPlayer(content, state, { businesses });
const after = (state: GameState, orders: Order[], c: Content = content) => previewRound(c, viewOf(state), { orders });
const reasons = (state: GameState, orders: Order[], c: Content = content) => after(state, orders, c).rejected.map((r) => r.reason);
const ledger = (events: GameEvent[], line: LedgerLine) => {
  const found = events.find((e) => e.kind === 'ledger' && e.line === line);
  return found && found.kind === 'ledger' ? found.amount : 0;
};
/** The first world of a game, in the state of the economy asked for. */
const worldIn = (regime: Regime) => ({ ...game(0).timeline[0], regime });

describe('opening a business', () => {
  it('moves cash into it, takes a point of focus, and leaves the player worth what they were', () => {
    const state = game(5_000_000);
    const { player, rejected } = after(state, [start(2_000_000)]);
    expect(rejected).toEqual([]);
    expect(player.cash).toBe(3_000_000);
    expect(player.businesses).toEqual([{ id: player.businesses[0].id, typeId: 'stall', capital: 2_000_000, basis: 2_000_000, payoutPct: 50, manager: false, tended: true, age: 0 }]);
    expect(player.life.focusUsed).toBe(1);
    expect(netWorth(player)).toBe(netWorth(state.player));
  });

  it('asks for the least capital of its kind, the cash, the skill, a point of focus and room for one more', () => {
    expect(reasons(game(5_000_000), [start(99_999)])).toEqual(['below-minimum']);
    expect(reasons(game(5_000_000), [start(100_000)])).toEqual([]);
    expect(reasons(game(50_000), [start(100_000)])).toEqual(['not-enough-cash']);
    expect(reasons(game(50_000_000, 1), [start(2_000_000, 'firm')])).toEqual(['needs-finance-skill']);
    expect(reasons(game(50_000_000), [start(100_000, 'casino')])).toEqual(['unknown-business-type']);
    expect(reasons(game(50_000_000), [start(100_000, '__proto__')])).toEqual(['unknown-business-type']);
    for (const bad of [0, -5, 0.5]) expect(reasons(game(5_000_000), [start(bad)])).toEqual(['bad-amount']);
    expect(reasons(game(5_000_000), [{ type: 'startBusiness', typeId: 7, capital: 100_000 } as never])).toEqual(['bad-order']);
    // Two at most here, and each opening takes a point of the three there are.
    expect(reasons(game(50_000_000), [start(100_000), start(100_000), start(100_000)])).toEqual(['too-many-businesses']);
    const tired = withPlayer(content, game(5_000_000), {}, { focusUsed: 3 });
    expect(reasons(tired, [start(100_000)])).toEqual(['no-focus']);
    expect(after(tired, [start(100_000)]).player.businesses).toEqual([]);
  });
});

describe('what a business makes in a round', () => {
  it('is a yield on the capital at work, which is less and less of each dollar as the business outgrows its kind', () => {
    const world = worldIn('expansion');
    const at = (capital: number) => businessRound(stall({ capital, payoutPct: 100 }), content, world).profit;
    // 10% a year for two years on what works: of 100,000 in a business made for 100,000, half works.
    expect(at(10_000_000)).toBe(Math.floor((5_000_000 * 2_000) / 10_000));
    // Ten times the capital makes less than twice the profit.
    expect(at(100_000_000)).toBeLessThan(at(10_000_000) * 2);
    expect(at(100_000_000)).toBeGreaterThan(at(10_000_000));
    // A small one works nearly whole.
    expect(Math.abs(at(100_000) - (100_000 * (10_000_000 / 10_100_000) * 2_000) / 10_000)).toBeLessThanOrEqual(1);
  });

  it('rises and falls with the economy, and loses money in a year bad enough', () => {
    const plain = businessRound(stall(), content, worldIn('expansion'));
    const boom = businessRound(stall(), content, worldIn('boom'));
    const bust = businessRound(stall(), content, worldIn('recession'));
    expect(plain).toMatchObject({ cyclePct: 0, neglected: false });
    expect(boom.cyclePct).toBe(50);
    expect(boom.profit).toBe(Math.floor((plain.profit * 150) / 100));
    expect(bust.profit).toBe(-Math.floor(plain.profit / 2));
    // A loss pays nothing out, and all of it comes out of the business.
    expect(bust).toMatchObject({ payout: 0, retained: bust.profit });
  });

  it('is split between what is taken out and what is left in, as the owner has set', () => {
    for (const payoutPct of [0, 50, 100]) {
      const round = businessRound(stall({ payoutPct }), content, worldIn('expansion'));
      expect(round.payout).toBe(Math.floor((round.profit * payoutPct) / 100));
      expect(round.payout + round.retained).toBe(round.profit);
    }
  });

  it('is halved when nobody runs it, and shared with a manager when one does', () => {
    const run = businessRound(stall(), content, worldIn('expansion')).profit;
    const neglected = businessRound(stall({ tended: false }), content, worldIn('expansion'));
    expect(neglected).toMatchObject({ neglected: true, profit: Math.floor(run / 2) });
    const managed = businessRound(stall({ tended: false, manager: true }), content, worldIn('expansion'));
    expect(managed).toMatchObject({ neglected: false, profit: run - Math.floor((run * 40) / 100) });
    // A manager's share of nothing is nothing: a loss is the owner's alone, and neglect makes it no smaller.
    const bust = businessRound(stall(), content, worldIn('recession')).profit;
    expect(businessRound(stall({ tended: false, manager: true }), content, worldIn('recession')).profit).toBe(bust);
    expect(businessRound(stall({ tended: false }), content, worldIn('recession')).profit).toBe(bust);
  });
});

describe('a round with a business', () => {
  it('pays what it pays out as income, taxed like a salary, and grows by what it kept, as previewed', () => {
    const state = owning(game(1_000_000), stall());
    const world = state.timeline[0];
    const round = businessRound(state.player.businesses[0], content, world);
    const preview = previewRound(content, viewOf(state), { orders: [] });
    const played = applyRound(content, state, { orders: [] });
    expect(preview.income.business).toBe(round.payout);
    expect(ledger(played.events, 'business')).toBe(round.payout);
    const without = previewRound(content, viewOf(game(1_000_000)), { orders: [] });
    if (round.payout > 0) expect(preview.tax.income).toBeGreaterThan(without.tax.income);
    // What it kept went in, and what is in it followed prices to the end of the round.
    const next = state.timeline[1];
    expect(played.state.player.businesses[0].capital).toBe(Math.floor(((10_000_000 + round.retained) * next.priceLevel) / world.priceLevel));
    expect(played.state.player.businesses[0].basis).toBe(10_000_000);
    expect(findInvariantBreaks(content, played.state)).toEqual([]);
  });

  it('needs its owner\'s focus every round, or a manager: left alone it makes half and wears down', () => {
    const state = owning(game(1_000_000), stall({ tended: false }));
    const tended = applyRound(content, state, { orders: [{ type: 'tendBusiness', businessId: 'business-9' }] });
    const left = applyRound(content, state, { orders: [] });
    expect(tended.state.player.businesses[0].capital).toBeGreaterThan(left.state.player.businesses[0].capital);
    expect(Math.abs(ledger(left.events, 'business') * 2 - ledger(tended.events, 'business'))).toBeLessThanOrEqual(1);
    // Yesterday's attention is not today's: the next round starts untended again.
    expect(tended.state.player.businesses[0].tended).toBe(false);
    expect(tended.state.player.life.focusUsed).toBe(0);
    // Tending costs a point, once a business, and takes one to give.
    expect(reasons(state, [{ type: 'tendBusiness', businessId: 'business-9' }, { type: 'tendBusiness', businessId: 'business-9' }])).toEqual(['already-done']);
    expect(after(state, [{ type: 'tendBusiness', businessId: 'business-9' }]).player.life.focusUsed).toBe(1);
    expect(reasons(withPlayer(content, state, {}, { focusUsed: 3 }), [{ type: 'tendBusiness', businessId: 'business-9' }])).toEqual(['no-focus']);
    expect(reasons(state, [{ type: 'tendBusiness', businessId: 'nope' }])).toEqual(['unknown-business']);
    // With a manager it runs itself, round after round, for the manager's share.
    const managed = applyRound(content, state, { orders: [{ type: 'setBusiness', businessId: 'business-9', manager: true }] });
    expect(managed.state.player.businesses[0]).toMatchObject({ manager: true, tended: false });
    expect(businessRound(managed.state.player.businesses[0], content, managed.state.timeline[1]).neglected).toBe(false);
  });

  it('closes when a loss or neglect leaves nothing in it', () => {
    // A stall with a few dollars in it, in a recession, with nobody running it.
    const recession = fixtureContent();
    recession.business.types = recession.business.types.map((type) => ({ ...type, cyclePct: { expansion: -100_000, boom: -100_000, slowdown: -100_000, recession: -100_000, recovery: -100_000 } }));
    const state = withPlayer(recession, game(1_000_000, 2, recession), { businesses: [stall({ capital: 100_000 })] });
    const played = applyRound(recession, state, { orders: [] });
    expect(played.events).toContainEqual({ kind: 'businessClosed', typeId: 'stall' });
    expect(played.state.player.businesses).toEqual([]);
    expect(findInvariantBreaks(recession, played.state)).toEqual([]);
  });
});

describe('running a business', () => {
  it('takes more money in, sets what is paid out, and refuses a share the rules do not have', () => {
    const state = owning(game(5_000_000), stall());
    const more = after(state, [{ type: 'investBusiness', businessId: 'business-9', amount: 1_000_000 }]).player;
    expect(more.businesses[0]).toMatchObject({ capital: 11_000_000, basis: 11_000_000 });
    expect(more.cash).toBe(4_000_000);
    expect(reasons(state, [{ type: 'investBusiness', businessId: 'business-9', amount: 9_000_000 }])).toEqual(['not-enough-cash']);
    expect(reasons(state, [{ type: 'investBusiness', businessId: 'business-9', amount: -1 }])).toEqual(['bad-amount']);
    expect(after(state, [{ type: 'setBusiness', businessId: 'business-9', payoutPct: 100 }]).player.businesses[0].payoutPct).toBe(100);
    expect(after(state, [{ type: 'setBusiness', businessId: 'business-9', payoutPct: 0, manager: true }]).player.businesses[0]).toMatchObject({ payoutPct: 0, manager: true });
    expect(reasons(state, [{ type: 'setBusiness', businessId: 'business-9', payoutPct: 75 }])).toEqual(['bad-payout']);
    expect(reasons(state, [{ type: 'setBusiness', businessId: 'business-9', manager: 'yes' } as never])).toEqual(['bad-order']);
    expect(reasons(state, [{ type: 'setBusiness', businessId: 'nope', manager: true }])).toEqual(['unknown-business']);
  });

  it('sells for what is in it, less what a buyer takes off in a poor economy, and never for more', () => {
    for (const regime of ['expansion', 'boom', 'slowdown', 'recession', 'recovery'] as const) {
      const price = businessSalePrice(stall(), content, worldIn(regime));
      expect(price).toBe(Math.floor((10_000_000 * content.business.salePct[regime]) / 100));
      expect(price).toBeLessThanOrEqual(10_000_000);
    }
    const state = owning(game(1_000_000), stall({ basis: 4_000_000 }));
    const price = businessSalePrice(state.player.businesses[0], content, state.timeline[0]);
    const played = applyRound(content, state, { orders: [{ type: 'sellBusiness', businessId: 'business-9' }] });
    expect(played.events).toContainEqual({ kind: 'businessSold', typeId: 'stall', capital: 10_000_000, price });
    expect(played.state.player.businesses).toEqual([]);
    // The profit left in over the years is a gain, taxed the round it is taken.
    const sold = previewRound(content, viewOf(state), { orders: [{ type: 'sellBusiness', businessId: 'business-9' }] });
    const kept = previewRound(content, viewOf(state), { orders: [] });
    expect(sold.player.cash).toBe(state.player.cash + price);
    expect(sold.tax.investment).toBeGreaterThan(kept.tax.investment);
    expect(reasons(state, [{ type: 'sellBusiness', businessId: 'nope' }])).toEqual(['unknown-business']);
  });

  it('can never be opened and sold in one round for a profit, in any economy', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const state = game(50_000_000, 2, content, seed);
      const opened = after(state, [start(20_000_000)]).player;
      const flipped = after(state, [start(20_000_000), { type: 'sellBusiness', businessId: opened.businesses[0].id }]).player;
      expect(netWorth(flipped), seed).toBeLessThanOrEqual(netWorth(state.player));
    }
  });
});

describe('a business and the rest of a life', () => {
  it('counts in net worth and in the portfolio, and is lost with everything else in a bankruptcy', () => {
    const state = owning(game(1_000_000), stall());
    expect(netWorth(state.player)).toBe(netWorth(game(1_000_000).player) + 10_000_000);
    const glance = quotePortfolio(content, viewOf(state));
    expect(glance.slices[0]).toMatchObject({ kind: 'business', value: 10_000_000 });
    expect(glance.largest).toMatchObject({ kind: 'business', id: 'business-9' });
    const ruined = withPlayer(content, state, { cash: 0, debts: [{ id: 'd', kind: 'creditCard', principal: 900_000_000, fixedRateBp: 0, roundsLeft: 0 }] });
    const played = applyRound(content, ruined, { orders: [] });
    expect(played.events.some((e) => e.kind === 'bankrupt')).toBe(true);
    expect(played.state.player.businesses).toEqual([]);
  });

  it('can be opened and sold by a card, and can be what a card asks for', () => {
    const open: CardDef = { id: 'open', category: 'business', weight: 10, cooldown: 0, when: { hasBusiness: false }, options: [{}, { effects: { cash: -500_000, business: { typeId: 'stall', capital: 500_000 } } }] };
    const offer: CardDef = { id: 'offer', category: 'business', weight: 10, cooldown: 0, when: { hasBusiness: true }, options: [{}, { effects: { sellBusiness: { pricePct: 180 } } }] };
    const cards = fixtureContent();
    cards.cards = [open, offer];
    const state = game(5_000_000, 0, cards);
    expect(state.hand).toEqual(['open']);
    const opened = applyCard(cards, state, 1).state;
    expect(opened.player.businesses).toMatchObject([{ typeId: 'stall', capital: 500_000, basis: 500_000 }]);
    expect(opened.player.cash).toBe(4_500_000);
    // The next round only the offer is open to them, and it pays its premium on what is then in the business.
    const next = applyRound(cards, opened, { orders: [] }).state;
    expect(next.hand).toEqual(['offer']);
    const capital = next.player.businesses[0].capital;
    const sold = applyCard(cards, next, 1).state;
    expect(sold.player.businesses).toEqual([]);
    expect(sold.player.cash).toBe(next.player.cash + Math.floor((capital * 180) / 100));
    expect(validateContent(cards)).toEqual([]);
    // With more than one, the buyer takes the largest and leaves the rest.
    const two = withPlayer(cards, next, {
      businesses: [
        { id: 'small', typeId: 'stall', capital: 100_000, basis: 100_000, payoutPct: 50, manager: false, tended: false },
        { id: 'big', typeId: 'stall', capital: 900_000, basis: 900_000, payoutPct: 50, manager: false, tended: false },
      ],
    });
    const one = applyCard(cards, two, 1).state;
    expect(one.player.businesses.map((business) => business.id)).toEqual(['small']);
    expect(one.player.cash).toBe(two.player.cash + 1_620_000);
    cards.cards = [{ ...open, options: [{}, { effects: { business: { typeId: 'casino', capital: 1 } } }] }];
    expect(validateContent(cards)).toContain('card open option 1 opens a business of an unknown kind: casino');
  });

  it('is one at most of a kind there may be only one of, opened by order or by a card', () => {
    const only = fixtureContent();
    only.business.types = only.business.types.map((type) => (type.id === 'stall' ? { ...type, onlyOne: true } : type));
    only.cards = [{ id: 'gig', category: 'business', weight: 10, cooldown: 0, options: [{}, { effects: { business: { typeId: 'stall', capital: 100_000 } } }] }];
    const state = withPlayer(only, game(5_000_000, 0, only), {
      businesses: [{ id: 'mine', typeId: 'stall', capital: 200_000, basis: 200_000, payoutPct: 50, manager: false, tended: false }],
    });
    const { events } = applyRound(only, { ...state, phase: 'finance', hand: [], answered: 0 }, { orders: [{ type: 'startBusiness', typeId: 'stall', capital: 200_000 }] });
    expect(events.flatMap((e) => (e.kind === 'orderRejected' ? [e.reason] : []))).toEqual(['already-owned']);
    const dealt = { ...state, phase: 'cards' as const, hand: ['gig'], answered: 0 };
    expect(applyCard(only, dealt, 1).state.player.businesses.map((business) => business.id)).toEqual(['mine']);
  });

  it('can be what a life starts with, at the prices of the first day', () => {
    const life = { lifeId: 'tester', career: { id: 'office', level: 0 }, careerSkill: 0, financeSkill: 0 as const, focus: 3, businesses: [{ typeId: 'stall', capital: 2_000_000 }] };
    const owner = createGame({ content, start: { ...fixtureStart(), cash: 0, life } }, 'owner');
    expect(owner.player.businesses).toMatchObject([{ typeId: 'stall', capital: 2_000_000, basis: 2_000_000, tended: true, manager: false }]);
    expect(validateStart(content, { ...fixtureStart(), life: { ...life, businesses: [{ typeId: 'casino', capital: 0 }] } })).toEqual(['life business 0 is of an unknown kind: casino', 'life business 0 needs a positive whole capital']);
  });
});

describe('the businesses, quoted', () => {
  it('says of each one what the round makes of it, what it would sell for, and of each kind whether it can be opened', () => {
    const state = owning(game(5_000_000), stall({ basis: 4_000_000, tended: false }));
    const quote = quoteBusinesses(content, viewOf(state));
    const world = state.timeline[0];
    const round = businessRound(state.player.businesses[0], content, world);
    expect(quote.owned).toEqual([
      { id: 'business-9', typeId: 'stall', capital: 10_000_000, basis: 4_000_000, payoutPct: 50, manager: false, tended: false, ...round, salePrice: businessSalePrice(state.player.businesses[0], content, world), managerPct: 40 },
    ]);
    expect(quote).toMatchObject({ max: 2, payouts: [0, 50, 100], focusLeft: 3 });
    expect(quote.kinds.map((kind) => [kind.typeId, kind.lock, kind.minCapital])).toEqual([['stall', null, 100_000], ['firm', null, 2_000_000]]);
    expect(quote.kinds[0]).toMatchObject({ yieldBp: 1_000, managerPct: 40, cyclePct: content.business.types[0].cyclePct[world.regime] ?? 0 });
    // Without the skill for one, or the room for another, the quote says which.
    expect(quoteBusinesses(content, viewOf(game(5_000_000, 0))).kinds.map((kind) => kind.lock)).toEqual([null, 'needs-finance-skill']);
    expect(quoteBusinesses(content, viewOf(owning(game(5_000_000), stall(), stall({ id: 'business-10' })))).kinds.map((kind) => kind.lock)).toEqual(['too-many-businesses', 'too-many-businesses']);
  });
});

describe('the rules of business, checked', () => {
  it('refuses a sale above what is in a business, a share that is not one, and a kind that does not add up', () => {
    const bad = (change: (c: Content) => void) => {
      const c = fixtureContent();
      change(c);
      return validateContent(c);
    };
    expect(bad(() => {})).toEqual([]);
    expect(bad((c) => (c.business.salePct.boom = 130))).toContain('business.salePct needs a whole percentage up to 100 for boom');
    expect(bad((c) => (c.business.payouts = [50, 0]))).toContain('business.payouts must be whole percentages from 0 to 100, rising');
    expect(bad((c) => (c.business.maxBusinesses = 0))).toContain('business.maxBusinesses must be a positive whole number');
    expect(bad((c) => (c.business.types = [{ ...c.business.types[0], scale: 0 }]))).toContain('business stall needs a positive whole least capital and scale');
    expect(bad((c) => (c.business.types = [c.business.types[0], c.business.types[0]]))).toContain('two business types have the same id');
  });
});
