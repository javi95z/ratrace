// Regression tests for what the second whole-branch review found.
/* eslint-disable @typescript-eslint/no-explicit-any */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { applyCard, applyCards, applyRound, createGame, previewRound } from '../game';
import { findInvariantBreaks } from '../invariants';
import { headlineHeld } from '../news';
import { netWorth } from '../selectors';
import { fixtureContent, fixtureStart } from '../testing/fixture';
import { withPlayer } from '../testing/patch';
import type { CardDef, Content, GameEvent, GameState, LifeStart, Order, Regime } from '../types';
import { validateContent } from '../validate';
import { generateTimeline } from '../world';
import { previewCard } from './cards';
import { applyEffects } from './effects';

const office: LifeStart = { lifeId: 'tester', career: { id: 'office', level: 0 }, careerSkill: 0, financeSkill: 0, focus: 3 };
const card = (id: string, over: Partial<CardDef> = {}): CardDef => ({ id, category: 'luck', weight: 10, cooldown: 0, options: [{}, { effects: { cash: 100_000 } }], ...over });

function contentWith(cards: CardDef[], change: (c: Content) => void = () => {}): Content {
  const content = fixtureContent();
  content.cards = cards;
  change(content);
  return content;
}
const start = (content: Content, cash = 1_000_000, seed = 'review'): GameState =>
  createGame({ content, start: { ...fixtureStart(), cash, life: office } }, seed);
const cardEvents = (events: GameEvent[]) => events.filter((e): e is Extract<GameEvent, { kind: 'card' }> => e.kind === 'card');

describe('C1: no order creates wealth', () => {
  it('refuses content in which an item is worth more the moment it is bought than it cost', () => {
    const content = fixtureContent();
    content.items = content.items.map((item) => (item.id === 'watch_gold' ? { ...item, resaleStartPct: 105 } : item));
    expect(validateContent(content)).toEqual(['item watch_gold has a resale percentage outside 0..100']);
  });

  it('never leaves the player worth more after their orders than before, whatever they order', () => {
    const content = fixtureContent();
    const amount = fc.integer({ min: 1, max: 30_000_000 });
    const order: fc.Arbitrary<Order> = fc.oneof(
      fc.record({ type: fc.constant('buy' as const), assetId: fc.constantFrom('fund_world', 'gold', 'coin_meme', 'bond_long'), amount }),
      fc.record({ type: fc.constant('sell' as const), assetId: fc.constantFrom('fund_world', 'gold', 'coin_meme', 'bond_long'), amount }),
      fc.record({ type: fc.constant('depositIn' as const), amount }),
      fc.record({ type: fc.constant('depositOut' as const), amount }),
      fc.record({ type: fc.constant('pensionIn' as const), amount }),
      fc.record({ type: fc.constant('borrow' as const), amount }),
      fc.record({ type: fc.constant('buyItem' as const), itemId: fc.constantFrom('car_basic', 'car_sports', 'watch_gold', 'club', 'trip') }),
      fc.record({ type: fc.constant('sellItem' as const), itemId: fc.constantFrom('car_basic', 'car_sports', 'watch_gold', 'club', 'trip') }),
      fc.record({ type: fc.constant('buyProperty' as const), typeId: fc.constantFrom('studio', 'flat'), downPayment: amount, mortgage: fc.constantFrom('fixed' as const, 'none' as const), rented: fc.boolean() }),
      fc.record({ type: fc.constant('sellProperty' as const), propertyId: fc.constantFrom('property-1', 'property-2', 'property-3') }),
      fc.record({ type: fc.constant('moveCity' as const), cityId: fc.constantFrom('home', 'haven') }),
      fc.record({ type: fc.constant('focus' as const), action: fc.constantFrom('overtime' as const, 'studyCareer' as const) }),
    );
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 80_000_000 }), fc.array(fc.array(order, { maxLength: 8 }), { minLength: 4, maxLength: 4 }), (cash, rounds) => {
        let state = start(content, cash, 'wealth');
        for (const orders of rounds) {
          const after = previewRound(content, state, { orders }).player;
          expect(netWorth(after)).toBeLessThanOrEqual(netWorth(state.player));
          state = applyRound(content, state, { orders }).state;
        }
      }),
      { numRuns: 200, seed: 20261013 },
    );
  });
});

describe('I4: what a card buys is worth what was paid for it', () => {
  const at = (content: Content, state: GameState) => ({ content, world: state.timeline[0], round: 0 });

  it('values a property bought below the market at the price paid, so it cannot be sold on at once for more', () => {
    const content = fixtureContent();
    const state = start(content, 10_000_000);
    const p = structuredClone(state.player);
    applyEffects(p, { property: { typeId: 'studio', pricePct: 85, downPct: 20, rented: false } }, at(content, state));
    // Market 15,000,000; bought for 12,750,000.
    expect(p.properties[0]).toMatchObject({ value: 12_750_000, basis: 12_750_000 });
    expect(netWorth(p)).toBe(10_000_000 - 1_020_000);
  });

  it('adds a fixed amount to the home, at the price level of the round, instead of a share of its value', () => {
    const content = fixtureContent();
    const state = createGame({ content, start: { ...fixtureStart(), cash: 5_000_000, life: { ...office, properties: [{ typeId: 'villa', rented: false }] } } }, 'home');
    const p = structuredClone(state.player);
    applyEffects(p, { cash: -1_800_000, homeValue: 1_400_000 }, at(content, state));
    expect(p.properties[0].value).toBe(200_000_000 + 1_400_000);
    expect(netWorth(p)).toBe(netWorth(state.player) - 400_000);
    applyEffects(p, { homeValue: 1_000_000 }, { ...at(content, state), world: { ...state.timeline[0], priceLevel: 2_000_000 } });
    expect(p.properties[0].value).toBe(200_000_000 + 1_400_000 + 2_000_000);
    const tenant = structuredClone(start(content).player);
    applyEffects(tenant, { homeValue: 1_000_000 }, at(content, state));
    expect(tenant.properties).toEqual([]);
  });

  it('no longer knows the old percentage effect', () => {
    const content = contentWith([card('reno', { options: [{}, { effects: { homeValuePct: 9 } as any }] })]);
    expect(validateContent(content)).toEqual(['card reno option 1 has an unknown effect: homeValuePct']);
    const bad = contentWith([card('reno', { options: [{}, { effects: { homeValue: 0 } }] })]);
    expect(validateContent(bad)).toEqual(['card reno option 1 needs a positive whole number for homeValue']);
  });
});

describe('I5: a card can ask whether the player is insured', () => {
  it('opens an option only to someone who holds the insurance', () => {
    const claim = card('claim', { options: [{}, { when: { insured: 'life' }, effects: { cash: 1_000_000 } }] });
    const content = contentWith([claim]);
    const state = start(content);
    expect(previewCard(content, state, 'claim')[1].available).toBe(false);
    const insured = withPlayer(content, state, {}, { insurance: { health: false, home: false, life: true, liability: false } });
    expect(previewCard(content, insured, 'claim')[1].available).toBe(true);
    expect(validateContent(contentWith([{ ...claim, when: { insured: 'pet' as any } }]))).toEqual(['card claim condition names an unknown insurance: pet']);
  });
});

describe('I6: cards are answered one at a time', () => {
  const study = card('study', { options: [{}, { effects: { focus: 2, careerSkill: 3 } }] });
  const rest = card('rest', { options: [{ effects: { cash: -180_000 } }, { effects: { focus: 2 } }] });
  const content = contentWith([study, rest], (c) => {
    c.life.cardsPerRound = 2;
  });
  const hand = (): GameState => ({ ...start(content), hand: ['study', 'rest'] });

  it('answers the next card only, and says how far through the hand the player is', () => {
    const state = hand();
    expect(state.answered).toBe(0);
    const first = applyCard(content, state, 1);
    expect(first.state.answered).toBe(1);
    expect(first.state.phase).toBe('cards');
    expect(cardEvents(first.events)).toEqual([{ kind: 'card', cardId: 'study', picked: 1, option: 1, outcome: null, cash: 0 }]);
    expect(state.answered).toBe(0);
    const second = applyCard(content, first.state, 0);
    expect(second.state.answered).toBe(2);
    expect(second.state.phase).toBe('finance');
    expect(cardEvents(second.events)).toEqual([{ kind: 'card', cardId: 'rest', picked: 0, option: 0, outcome: null, cash: -180_000 }]);
  });

  it('previews the next card as the player now stands, so an option shown as open is open', () => {
    const state = hand();
    expect(previewCard(content, state, 'rest')[1].available).toBe(true);
    const after = applyCard(content, state, 1).state;
    expect(after.player.life.focusUsed).toBe(2);
    expect(previewCard(content, after, 'rest')[1].available).toBe(false);
    expect(() => previewCard(content, after, 'study')).toThrow('previewCard: study is already answered');
  });

  it('takes the first option for an answer that is missing, malformed or locked', () => {
    const state = hand();
    for (const option of [null, undefined, 7, -1, 1.5, '1']) {
      expect(cardEvents(applyCard(content, state, option as never).events)[0]).toMatchObject({ picked: null, option: 0 });
    }
    const tired = applyCard(content, state, 1).state;
    expect(cardEvents(applyCard(content, tired, 1).events)[0]).toMatchObject({ cardId: 'rest', picked: 1, option: 0, cash: -180_000 });
  });

  it('settles a bill as soon as its card is answered', () => {
    const broke = withPlayer(content, hand(), { cash: 0, deposit: 100_000 });
    const { state, events } = applyCard(content, applyCard(content, broke, 0).state, 0);
    expect(events).toEqual([
      { kind: 'card', cardId: 'rest', picked: 0, option: 0, outcome: null, cash: -180_000 },
      { kind: 'ledger', line: 'depositDraw', amount: 100_000 },
      { kind: 'ledger', line: 'creditCardDraw', amount: 80_000 },
    ]);
    expect(state.player.cash).toBe(0);
    expect(findInvariantBreaks(content, state)).toEqual([]);
  });

  it('lets applyCards answer whatever is left of the hand, and applyRound do the same with first options', () => {
    const state = hand();
    const one = applyCard(content, state, 1).state;
    const all = applyCards(content, one, { study: 0, rest: 1 });
    expect(cardEvents(all.events).map((e) => e.cardId)).toEqual(['rest']);
    expect(all.state.answered).toBe(2);
    const played = applyRound(content, one, { orders: [] });
    expect(cardEvents(played.events)).toEqual([{ kind: 'card', cardId: 'rest', picked: null, option: 0, outcome: null, cash: -180_000 }]);
    expect(played.state.answered).toBe(0);
    expect(played.state.round).toBe(1);
  });

  it('refuses a card when none is waiting, and checks the count it keeps', () => {
    const done = applyCards(content, hand(), {}).state;
    expect(() => applyCard(content, done, 0)).toThrow('applyCard: the cards of this round are already answered');
    expect(findInvariantBreaks(content, { ...hand(), answered: 3 })).toEqual(['answered is 3 but the hand holds 2 cards']);
    expect(findInvariantBreaks(content, { ...hand(), answered: 1.5 })).toEqual(['answered is 1.5 but the hand holds 2 cards']);
    expect(findInvariantBreaks(content, { ...hand(), answered: 2 })).toEqual(['phase is cards but every card is answered']);
    expect(findInvariantBreaks(content, { ...done, answered: 1 })).toEqual(['phase is finance but a card is still unanswered']);
  });

  it('survives a save and a load in the middle of a hand', () => {
    const one = applyCard(content, hand(), 1).state;
    const loaded = JSON.parse(JSON.stringify(one)) as GameState;
    expect(applyCard(content, loaded, 0)).toEqual(applyCard(content, one, 0));
  });
});

describe('I7: cards keep to the rules of bankruptcy', () => {
  it('locks an option that pays into the pension for a player it would leave owing more than they own', () => {
    const topup = card('topup', { options: [{}, { effects: { cash: -200_000, pension: 400_000 } }] });
    const content = contentWith([topup]);
    const state = start(content, 600_000);
    expect(previewCard(content, state, 'topup')[1].available).toBe(true);
    const owing = withPlayer(content, state, { debts: [{ id: 'debt-1', kind: 'personalLoan', principal: 500_000, fixedRateBp: 700, roundsLeft: 2 }], nextId: 1 });
    expect(previewCard(content, owing, 'topup')[1].available).toBe(false);
    expect(applyCards(content, owing, { topup: 1 }).state.player.pension).toBe(0);
  });

  it('locks an option that may end in a loan while the bankruptcy lock lasts', () => {
    const cosign = card('cosign', { options: [{}, { outcomes: [{ weight: 1, effects: { status: 1 } }, { weight: 1, effects: { loan: 1_200_000, cash: -1_200_000 } }] }] });
    const content = contentWith([cosign]);
    const state = start(content);
    expect(previewCard(content, state, 'cosign')[1].available).toBe(true);
    expect(previewCard(content, withPlayer(content, state, { bankruptUntilRound: 3 }), 'cosign')[1].available).toBe(false);
  });
});

describe('what was raised from Minor', () => {
  it('refuses content numbers that would break an invariant later', () => {
    const swing = fixtureContent();
    swing.life.unstablePayPct = 12.5;
    expect(validateContent(swing)).toEqual(['life.unstablePayPct must be a whole number from 0 to 100']);
    const partner = contentWith([card('date', { options: [{}, { effects: { partner: { salaryPct: 82.5 } } }] })]);
    expect(validateContent(partner)).toEqual(['card date option 1 needs a whole, non-negative partner salary']);
  });

  it('does not take a degree in bankruptcy, nor let it be thrown away', () => {
    const content = fixtureContent();
    content.items = [...content.items, { id: 'degree', ladder: 'education', kind: 'durable', price: 9_000_000, upkeepAnnual: 0, status: 15, resaleStartPct: 0, resaleDriftBp: 0, boostRounds: 0, cardOnly: true }];
    const broke = withPlayer(
      content,
      createGame({ content, start: { ...fixtureStart(), salaryAnnual: 0 } }, 'degree'),
      { debts: [{ id: 'debt-1', kind: 'creditCard', principal: 9_000_000, fixedRateBp: 0, roundsLeft: 0 }], nextId: 1 },
      { items: [{ itemId: 'degree', value: 0, roundsLeft: null, paid: 0, age: 0 }, { itemId: 'watch_gold', value: 500_000, roundsLeft: null, paid: 0, age: 0 }], collection: ['degree', 'watch_gold'] },
    );
    const refused = applyRound(content, broke, { orders: [{ type: 'sellItem', itemId: 'degree' }] });
    expect(refused.events).toContainEqual({ kind: 'orderRejected', order: { type: 'sellItem', itemId: 'degree' }, reason: 'cannot-sell' });
    expect(refused.events.some((e) => e.kind === 'bankrupt')).toBe(true);
    expect(refused.state.player.life.items).toEqual([{ itemId: 'degree', value: 0, roundsLeft: null, paid: 0, age: 1 }]);
  });

  it('writes a false regime headline about a regime that could have followed', () => {
    const content = fixtureContent();
    content.world.newsTruthPct = 0;
    const reachable = (from: Regime) => content.market.regimeTransitions[from].filter(([, weight]) => weight > 0).map(([to]) => to);
    let checked = 0;
    for (let i = 0; i < 60; i++) {
      const timeline = generateTimeline(`false-${i}`, content);
      for (let r = 0; r < 20; r++) {
        for (const headline of timeline[r].news) {
          if (headline.topic !== 'regime') continue;
          expect(headlineHeld(content, headline, timeline[r], timeline[r + 1])).toBe(false);
          // From a recession only recovery or more recession can follow; when the truth is one, the lie is the other.
          expect(reachable(timeline[r].regime), `${timeline[r].regime} → ${headline.regime}`).toContain(headline.regime);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(300);
  });
});
