import {
  applyCards,
  applyRound,
  createGame,
  findInvariantBreaks,
  netWorth,
  previewRound,
  stateHash,
} from '@ratrace/engine';
import type { GameEvent, GameState, LedgerLine, Order, PlayerState } from '@ratrace/engine';
import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { content } from './content';
import { lives } from './lives';

// Whole lives by the hundred: a few seconds alone, and past the usual five on a busy machine.
vi.setConfig({ testTimeout: 60_000 });

/** A fixed seed, so a failure here is the same failure on every machine and every run. */
const SEED = 20261013;

const amount = fc.oneof(
  { weight: 8, arbitrary: fc.integer({ min: 1, max: 30_000_000 }) },
  { weight: 1, arbitrary: fc.constantFrom(0, -5, 0.5, NaN, Infinity, 1e300) },
);
const assetId = fc.constantFrom('msci_world', 'sp500', 'treasury_long', 'nvidia', 'santander', 'bitcoin', 'dogecoin', 'gold', 'nope', '__proto__');
const itemId = fc.constantFrom(
  'car_seat_ibiza', 'car_porsche_911', 'watch_casio', 'watch_rolex', 'tech_phone', 'fashion_birkin',
  'travel_ibiza', 'member_gym', 'member_club', 'edu_mba', 'art_stencil', 'jetpack', 'constructor',
);
const ownedId = (prefix: string) => fc.integer({ min: 1, max: 12 }).map((n) => `${prefix}-${n}`);

const order: fc.Arbitrary<Order> = fc.oneof(
  { weight: 3, arbitrary: fc.record({ type: fc.constant('buy' as const), assetId, amount }) },
  { weight: 2, arbitrary: fc.record({ type: fc.constant('sell' as const), assetId, amount }) },
  { weight: 1, arbitrary: fc.record({ type: fc.constant('depositIn' as const), amount }) },
  { weight: 1, arbitrary: fc.record({ type: fc.constant('depositOut' as const), amount }) },
  { weight: 1, arbitrary: fc.record({ type: fc.constant('pensionIn' as const), amount }) },
  { weight: 1, arbitrary: fc.record({ type: fc.constant('borrow' as const), amount }) },
  { weight: 1, arbitrary: fc.record({ type: fc.constant('repay' as const), debtId: ownedId('debt'), amount }) },
  {
    weight: 1,
    arbitrary: fc.record({
      type: fc.constant('buyProperty' as const),
      typeId: fc.constantFrom('studio', 'flat', 'house', 'castle'),
      downPayment: amount,
      mortgage: fc.constantFrom('fixed' as const, 'variable' as const, 'none' as const),
      rented: fc.boolean(),
    }),
  },
  { weight: 1, arbitrary: fc.record({ type: fc.constant('sellProperty' as const), propertyId: ownedId('property') }) },
  { weight: 1, arbitrary: fc.record({ type: fc.constant('setRented' as const), propertyId: ownedId('property'), rented: fc.boolean() }) },
  { weight: 2, arbitrary: fc.record({ type: fc.constant('focus' as const), action: fc.constantFrom('overtime' as const, 'studyCareer' as const, 'jobHunt' as const, 'nap' as never) }) },
  { weight: 3, arbitrary: fc.record({ type: fc.constant('buyItem' as const), itemId }) },
  { weight: 2, arbitrary: fc.record({ type: fc.constant('sellItem' as const), itemId }) },
  { weight: 1, arbitrary: fc.record({ type: fc.constant('setLifestyle' as const), tier: fc.constantFrom(0 as const, 1 as const, 2 as const, 3 as const, 7 as never) }) },
  { weight: 1, arbitrary: fc.record({ type: fc.constant('setRentTier' as const), tier: fc.constantFrom(0 as const, 1 as const, 2 as never) }) },
  {
    weight: 1,
    arbitrary: fc.record({
      type: fc.constant('setInsurance' as const),
      insurance: fc.constantFrom('health' as const, 'home' as const, 'life' as const, 'liability' as const, 'pet' as never),
      on: fc.boolean(),
    }),
  },
  { weight: 1, arbitrary: fc.record({ type: fc.constant('moveCity' as const), cityId: fc.constantFrom('madrid', 'london', 'new_york', 'dubai', 'singapore', 'bangkok', 'atlantis') }) },
);

interface Life {
  life: number;
  seed: string;
  playerKey: string;
  /** One list of answers and one list of orders per round. Answers go to the hand in order. */
  rounds: Array<{ picks: number[]; orders: Order[] }>;
}

const life: fc.Arbitrary<Life> = fc.record({
  life: fc.integer({ min: 0, max: lives.length - 1 }),
  seed: fc.string({ maxLength: 10 }),
  playerKey: fc.constantFrom('', 'ana', 'ben'),
  rounds: fc.array(
    fc.record({
      picks: fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 4, maxLength: 4 }),
      orders: fc.array(order, { maxLength: 6 }),
    }),
    { minLength: 20, maxLength: 20 },
  ),
});

const begin = (input: Life): GameState =>
  createGame({ content, start: lives[input.life].start, playerKey: input.playerKey }, input.seed);

const picksFor = (state: GameState, answers: number[]) => Object.fromEntries(state.hand.map((id, i) => [id, answers[i] ?? 0]));

/** Plays a whole life. `watch` sees each round: the state with the cards answered, the orders, and the result. */
function play(
  input: Life,
  watch: (answered: GameState, orders: Order[], result: { state: GameState; events: GameEvent[] }, cardEvents: GameEvent[]) => void = () => {},
): GameState {
  let state = begin(input);
  for (const round of input.rounds) {
    let answered = state;
    let cardEvents: GameEvent[] = [];
    if (state.phase === 'cards') {
      const hand = state.hand;
      const cards = applyCards(content, state, picksFor(state, round.picks));
      answered = cards.state;
      cardEvents = cards.events;
      expect(cardEvents.filter((e) => e.kind === 'card').map((e) => (e.kind === 'card' ? e.cardId : ''))).toEqual(hand);
    }
    const result = applyRound(content, answered, { orders: round.orders });
    expect(findInvariantBreaks(content, result.state)).toEqual([]);
    watch(answered, round.orders, result, cardEvents);
    state = result.state;
  }
  return state;
}

const ledger = (events: GameEvent[], line: LedgerLine): number => {
  let total = 0;
  for (const e of events) if (e.kind === 'ledger' && e.line === line) total += e.amount;
  return total;
};

/** A charge as a positive amount. */
const paid = (events: GameEvent[], line: LedgerLine): number => 0 - ledger(events, line);

/** Ledger lines that only move money between the player's own pockets. */
const TRANSFERS: ReadonlySet<LedgerLine> = new Set<LedgerLine>(['debtPrincipal', 'depositDraw', 'creditCardDraw', 'creditCardRepay']);

/** The rule for a price move, written out here so the test does not lean on the engine's own helper. */
const moved = (value: number, returnBp: number) => Math.max(0, value + Math.round((value * returnBp) / 10_000)) - value;
const itemsValue = (p: PlayerState) => p.life.items.reduce((sum, item) => sum + item.value, 0);

describe('whole lives on the v1 content', () => {
  it('survive any answers and any orders, in every starting life', () => {
    const played = new Set<number>();
    fc.assert(
      fc.property(life, (input) => {
        const state = play(input);
        expect(state.round).toBe(20);
        expect(state.finished).toBe(true);
        expect(state.hand).toEqual([]);
        played.add(input.life);
      }),
      { numRuns: 150, seed: SEED },
    );
    expect(played.size).toBe(lives.length);
  });

  it('replay to the same state from the same answers and orders', () => {
    fc.assert(
      fc.property(life, (input) => {
        expect(stateHash(play(input))).toBe(stateHash(play(input)));
      }),
      { numRuns: 40, seed: SEED },
    );
  });

  it('survive a save and a load between every step', () => {
    fc.assert(
      fc.property(life, (input) => {
        let state = begin(input);
        for (const round of input.rounds) {
          state = JSON.parse(JSON.stringify(state)) as GameState;
          if (state.phase === 'cards') state = JSON.parse(JSON.stringify(applyCards(content, state, picksFor(state, round.picks)).state)) as GameState;
          state = applyRound(content, state, { orders: round.orders }).state;
        }
        expect(stateHash(state)).toBe(stateHash(play(input)));
      }),
      { numRuns: 25, seed: SEED },
    );
  });

  it('show in the preview exactly what the round then pays and charges', () => {
    let rounds = 0;
    fc.assert(
      fc.property(life, (input) => {
        play(input, (answered, orders, result) => {
          const preview = previewRound(content, answered, { orders });
          const e = result.events;
          expect(ledger(e, 'salary')).toBe(preview.income.salary);
          expect(ledger(e, 'dividends')).toBe(preview.income.dividends);
          expect(ledger(e, 'interest')).toBe(preview.income.interest);
          expect(ledger(e, 'rent')).toBe(preview.income.rent);
          expect(ledger(e, 'otherPassive')).toBe(preview.income.otherPassive);
          expect(paid(e, 'living')).toBe(preview.expenses.living);
          expect(paid(e, 'otherExpenses')).toBe(preview.expenses.other);
          expect(paid(e, 'debtInterest')).toBe(preview.expenses.debtInterest);
          expect(paid(e, 'debtPrincipal')).toBe(preview.expenses.debtPrincipal);
          expect(paid(e, 'incomeTax')).toBe(preview.tax.income);
          expect(paid(e, 'investmentTax')).toBe(preview.tax.investment);
          expect(paid(e, 'propertyTax')).toBe(preview.tax.property);
          expect(paid(e, 'purchaseTax')).toBe(preview.purchaseTaxPaid);
          expect(result.events.filter((x) => x.kind === 'orderRejected')).toHaveLength(preview.rejected.length);
          rounds += 1;
        });
      }),
      { numRuns: 60, seed: SEED },
    );
    expect(rounds).toBe(1_200);
  });

  it('change net worth in a round by exactly the ledger flows, the price moves and the change in item values', () => {
    let checked = 0;
    fc.assert(
      fc.property(life, (input) => {
        play(input, (answered, orders, result) => {
          if (result.events.some((e) => e.kind === 'bankrupt')) return;
          const held = previewRound(content, answered, { orders }).player;
          const after = result.state.timeline[result.state.round];

          let flows = 0;
          for (const e of result.events) if (e.kind === 'ledger' && !TRANSFERS.has(e.line)) flows += e.amount;
          let moves = 0;
          for (const [id, position] of Object.entries(held.positions)) moves += moved(position.value, after.assetReturnBp[id]);
          for (const property of held.properties) moves += moved(property.value, after.propertyReturnBp[property.cityId]);
          // The pension follows the MSCI World fund and reinvests its 1.8% yield for two years.
          moves += moved(held.pension, after.assetReturnBp.msci_world) + Math.round((held.pension * 360) / 10_000);
          // Items: what the orders did to their value, then the rule for a round of ageing, written out here:
          // a durable moves by its own drift and by inflation; nothing else has a value.
          const now = answered.timeline[answered.round];
          let items = itemsValue(held) - itemsValue(answered.player);
          for (const owned of held.life.items) {
            const item = content.items.find((i) => i.id === owned.itemId);
            if (!item || item.kind !== 'durable') continue;
            const drifted = Math.floor((owned.value * (10_000 + item.resaleDriftBp)) / 10_000);
            items += Math.floor((drifted * after.priceLevel) / now.priceLevel) - owned.value;
          }

          expect(netWorth(result.state.player) - netWorth(answered.player)).toBe(flows + moves + items);
          checked += 1;
        });
      }),
      { numRuns: 80, seed: SEED },
    );
    expect(checked).toBeGreaterThan(1_200);
  });

  it('never make the player richer by placing orders: no order creates wealth', () => {
    let rounds = 0;
    fc.assert(
      fc.property(life, (input) => {
        play(input, (answered, orders) => {
          const after = previewRound(content, answered, { orders }).player;
          expect(netWorth(after)).toBeLessThanOrEqual(netWorth(answered.player));
          rounds += 1;
        });
      }),
      { numRuns: 60, seed: SEED },
    );
    expect(rounds).toBe(1_200);
  });

  it('cannot be gamed by buying and selling the same thing in one round, whatever the thing', () => {
    const rich = createGame({ content, start: { ...lives[0].start, cash: 100_000_000_00 } }, 'flip');
    const state = rich.phase === 'cards' ? applyCards(content, rich, {}).state : rich;
    for (const item of content.items) {
      const orders: Order[] = [{ type: 'buyItem', itemId: item.id }, { type: 'sellItem', itemId: item.id }];
      const after = previewRound(content, state, { orders }).player;
      expect(after.cash, item.id).toBeLessThanOrEqual(state.player.cash);
    }
  });

  it('account for every dollar a hand of cards moves in or out of cash', () => {
    let hands = 0;
    fc.assert(
      fc.property(life, (input) => {
        let before = begin(input);
        play(input, (answered, _orders, result, cardEvents) => {
          if (cardEvents.length > 0) {
            let cash = 0;
            for (const e of cardEvents) if (e.kind === 'card') cash += e.cash;
            const covered = ledger(cardEvents, 'depositDraw') + ledger(cardEvents, 'creditCardDraw');
            expect(answered.player.cash - before.player.cash).toBe(cash + covered);
            expect(answered.player.cash).toBeGreaterThanOrEqual(0);
            hands += 1;
          }
          before = result.state;
        });
      }),
      { numRuns: 60, seed: SEED },
    );
    expect(hands).toBeGreaterThan(1_000);
  });

  it('leave Object.prototype untouched', () => {
    expect(Object.keys(Object.prototype)).toEqual([]);
  });
});
