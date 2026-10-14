import { describe, expect, it } from 'vitest';
import { applyRound, createGame } from '../game';
import { findInvariantBreaks } from '../invariants';
import { mulDiv } from '../money';
import { quoteItem } from '../quotes';
import { indexed } from '../rates';
import { fixtureContent, fixtureStart } from '../testing/fixture';
import { withPlayer } from '../testing/patch';
import type { Content, GameEvent, GameState, Order } from '../types';
import { validateContent } from '../validate';
import { viewOf } from '../view';
import { itemStatus } from './derive';

/** The fixture with cars sold second hand, at half price, two rounds old, and a repair as often as asked. */
function contentWith(repairChancePct = 0, change: (c: Content) => void = () => {}): Content {
  const content = fixtureContent();
  content.life.used = { car: { pricePct: 50, ageRounds: 2, repairChancePct, repairPct: 10 } };
  content.life.agingLadders = ['car'];
  change(content);
  return content;
}

const game = (content: Content, cash = 5_000_000): GameState => createGame({ content, start: { ...fixtureStart(), cash } }, 'used');
const buyUsed: Order = { type: 'buyItem', itemId: 'car_basic', used: true };
const rejected = (events: GameEvent[]) => events.flatMap((e) => (e.kind === 'orderRejected' ? [e.reason] : []));
const ledger = (events: GameEvent[], line: string) => events.flatMap((e) => (e.kind === 'ledger' && e.line === line ? [e.amount] : []));

describe('the second-hand shop', () => {
  it('quotes a used car at its share of a new one, worth what a dealer pays, and as old as it is', () => {
    const content = contentWith(30);
    const state = game(content);
    const quote = quoteItem(content, viewOf(state), 'car_basic');
    const car = content.items.find((item) => item.id === 'car_basic');
    if (!car) throw new Error('no car in the fixture');
    const price = mulDiv(indexed(car.price, state.timeline[0]), 50, 100);
    expect(quote.used).toEqual({
      price,
      // The dealer keeps the same margin as on a new one.
      resale: mulDiv(price, car.resaleStartPct, 100),
      // Two rounds of a car's loss of value come off its status too.
      status: itemStatus(car, 2, content),
      ageRounds: 2,
      repairChancePct: 30,
      repairCost: mulDiv(quote.price, 10, 100),
      lock: null,
    });
    expect(quote.used?.status).toBeLessThan(quote.statusNew);
    expect(quote.ownedUsed).toBe(false);
    // Nothing else is sold second hand, and a player short of the cash is told why.
    expect(quoteItem(content, viewOf(state), 'watch_gold').used).toBeNull();
    expect(quoteItem(content, viewOf(game(content, 100)), 'car_basic').used?.lock).toBe('not-enough-cash');
  });

  it('sells it for cash, marked second hand and already some rounds old, as quoted', () => {
    const content = contentWith();
    const state = game(content);
    const quote = quoteItem(content, viewOf(state), 'car_basic');
    const { state: after, events } = applyRound(content, state, { orders: [buyUsed] });
    expect(rejected(events)).toEqual([]);
    expect(ledger(events, 'itemPurchases')).toEqual([-(quote.used?.price ?? 0)]);
    const owned = after.player.life.items.find((x) => x.itemId === 'car_basic');
    // Bought two rounds old, and a round older now the round has been lived.
    expect(owned).toMatchObject({ used: true, paid: quote.used?.price, age: 3 });
    expect(after.player.life.collection).toContain('car_basic');
    expect(findInvariantBreaks(content, after)).toEqual([]);
    const later = quoteItem(content, viewOf(after), 'car_basic');
    expect(later).toMatchObject({ owned: true, ownedUsed: true, used: null });
  });

  it('cannot be bought and sold again the same round for more than it cost', () => {
    const content = contentWith();
    const state = game(content);
    const { state: after } = applyRound(content, state, { orders: [buyUsed, { type: 'sellItem', itemId: 'car_basic' }] });
    expect(after.player.life.items).toEqual([]);
    expect(after.player.cash).toBeLessThan(applyRound(content, state, { orders: [] }).state.player.cash);
  });

  it('refuses what is not sold second hand, a loan for it, cash the player does not have, and a second one', () => {
    const content = contentWith();
    const state = game(content);
    const tried = (orders: Order[], s = state) => rejected(applyRound(content, s, { orders }).events);
    expect(tried([{ type: 'buyItem', itemId: 'watch_gold', used: true }])).toEqual(['not-sold-used']);
    expect(tried([{ ...buyUsed, financed: true } as Order])).toEqual(['cannot-finance']);
    expect(tried([buyUsed], game(content, 100))).toEqual(['not-enough-cash']);
    expect(tried([buyUsed, buyUsed])).toEqual(['already-owned']);
    expect(tried([{ type: 'buyItem', itemId: 'car_basic' }, buyUsed])).toEqual(['already-owned']);
  });

  it('charges a repair now and then to what was bought second hand, after the round of the warranty, and never to what was bought new', () => {
    const content = contentWith(100);
    const state = game(content);
    const bought = applyRound(content, state, { orders: [buyUsed] });
    const car = content.items.find((item) => item.id === 'car_basic');
    if (!car) throw new Error('no car in the fixture');
    // The round it is bought in, the dealer's warranty covers it.
    expect(bought.events.some((e) => e.kind === 'repair')).toBe(false);
    // From the next, a repair is priced on a new one at the prices of its round.
    const next = applyRound(content, bought.state, { orders: [] });
    const cost = mulDiv(indexed(car.price, bought.state.timeline[1]), 10, 100);
    expect(next.events).toContainEqual({ kind: 'repair', itemId: 'car_basic', amount: cost });
    expect(ledger(next.events, 'repairs')).toEqual([-cost]);
    // The same two rounds where nothing ever breaks leave exactly the repair more in cash.
    const sound = contentWith(0);
    const unbroken = applyRound(sound, applyRound(sound, game(sound), { orders: [buyUsed] }).state, { orders: [] });
    expect(unbroken.state.player.cash - next.state.player.cash).toBe(cost);

    const fresh = applyRound(content, state, { orders: [{ type: 'buyItem', itemId: 'car_basic' }] });
    expect(fresh.events.some((e) => e.kind === 'repair')).toBe(false);
    expect(ledger(fresh.events, 'repairs')).toEqual([]);
    // Without a chance of it, nothing breaks.
    expect(unbroken.events.some((e) => e.kind === 'repair')).toBe(false);
  });

  it('leaves the dice of a life with nothing second hand exactly as they were', () => {
    const plain = fixtureContent();
    const used = contentWith(50);
    // The same life with and without a used shop to ignore: the same rounds, card for card.
    let a = game(plain);
    let b = game(used);
    for (let round = 0; round < 5; round++) {
      a = applyRound(plain, a, { orders: [] }).state;
      b = applyRound(used, b, { orders: [] }).state;
      expect(b.hand).toEqual(a.hand);
      expect(b.rng).toEqual(a.rng);
    }
  });

  it('is checked: a used mark only on what is sold second hand, and rules that make sense', () => {
    const content = contentWith();
    const marked = withPlayer(content, game(content), {}, { items: [{ itemId: 'watch_gold', value: 1, roundsLeft: null, paid: 1, age: 0, used: true }], collection: ['watch_gold'] });
    expect(findInvariantBreaks(content, marked)).toContain('item watch_gold is marked used, and nothing of its kind is sold second hand');
    const bad = fixtureContent();
    bad.life.used = { membership: { pricePct: 100, ageRounds: -1, repairChancePct: 101, repairPct: 1.5 } };
    expect(validateContent(bad)).toEqual(
      expect.arrayContaining([
        'life.used names a ladder that is not one of durables: membership',
        'life.used.membership.pricePct must be a whole number from 1 to 99',
        'life.used.membership.ageRounds must be a whole, non-negative number',
        'life.used.membership.repairChancePct must be a whole number from 0 to 100',
        'life.used.membership.repairPct must be a whole number from 0 to 100',
      ]),
    );
  });
});
