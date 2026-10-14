import { describe, expect, it } from 'vitest';
import { applyCard, applyRound, createGame } from './game';
import { optionLock } from './life/cards';
import { fixtureContent, fixtureStart } from './testing/fixture';
import type { CardDef, Content, GameEvent, GameLimits, GameState, Order } from './types';
import { validateStart } from './validate';
import { viewOf } from './view';

const rejected = (events: GameEvent[]) => events.flatMap((e) => (e.kind === 'orderRejected' ? [e.reason] : []));
const game = (content: Content, limits?: GameLimits): GameState =>
  createGame({ content, start: { ...fixtureStart(), cash: 50_000_000, ...(limits ? { limits } : {}) } }, 'limits');
const play = (content: Content, state: GameState, orders: Order[]) => applyRound(content, state, { orders });

describe('the limits a game is started under', () => {
  it('are kept for the whole game, and shown in its view, and an ordinary game has none', () => {
    const content = fixtureContent();
    expect(game(content).limits).toEqual({});
    const limited = game(content, { noMoving: true });
    expect(viewOf(limited).limits).toEqual({ noMoving: true });
    expect(play(content, limited, []).state.limits).toEqual({ noMoving: true });
  });

  it('are refused when they name an asset that does not exist, are not flags, or are not limits at all', () => {
    const content = fixtureContent();
    const errors = (limits: unknown) => validateStart(content, { ...fixtureStart(), limits: limits as GameLimits });
    expect(errors({ onlyAssets: ['fund_world'], noBorrowing: true, noMoving: false, noProperty: true })).toEqual([]);
    expect(errors({ onlyAssets: ['fund_world', 'gold_bar'] })).toEqual(['limits.onlyAssets must name assets that exist']);
    expect(errors({ onlyAssets: [] })).toEqual(['limits.onlyAssets must name assets that exist']);
    expect(errors({ noMoving: 'yes' })).toEqual(['limits.noMoving must be true or false']);
    expect(errors({ noTaxes: true })).toEqual(['limits has an unknown limit: noTaxes']);
    expect(errors([])).toEqual(['limits must be a record']);
  });

  it('refuse buying, or planning to buy, any asset but those allowed, and let everything else through', () => {
    const content = fixtureContent();
    const state = game(content, { onlyAssets: ['fund_world'] });
    const { events, state: after } = play(content, state, [
      { type: 'buy', assetId: 'stock_growth', amount: 100_000 },
      { type: 'setPlan', assetId: 'coin_major', amount: 100_000 },
      { type: 'buy', assetId: 'fund_world', amount: 100_000 },
      { type: 'setPlan', assetId: 'fund_world', amount: 50_000 },
      { type: 'depositIn', amount: 100_000 },
    ]);
    expect(rejected(events)).toEqual(['not-in-challenge', 'not-in-challenge']);
    expect(Object.keys(after.player.positions)).toEqual(['fund_world']);
    // A plan of nothing ends a plan, and that is always allowed.
    expect(rejected(play(content, after, [{ type: 'setPlan', assetId: 'coin_major', amount: 0 }]).events)).toEqual([]);
  });

  it('refuse every kind of borrowing without borrowing: loans, margin, mortgages and instalments', () => {
    const content = fixtureContent();
    const state = game(content, { noBorrowing: true });
    const { events, state: after } = play(content, state, [
      { type: 'borrow', amount: 100_000 },
      { type: 'buy', assetId: 'fund_world', amount: 100_000, margin: 100_000 },
      { type: 'buyProperty', typeId: 'studio', downPayment: 1_000_000, mortgage: 'fixed', rented: false },
      { type: 'buyItem', itemId: 'car_basic', financed: true },
      { type: 'buy', assetId: 'fund_world', amount: 100_000 },
      { type: 'buyItem', itemId: 'car_basic' },
    ]);
    expect(rejected(events)).toEqual(['not-in-challenge', 'not-in-challenge', 'not-in-challenge', 'not-in-challenge']);
    expect(after.player.debts).toEqual([]);
  });

  it('refuse a move, and property, each under its own limit', () => {
    const content = fixtureContent();
    expect(rejected(play(content, game(content, { noMoving: true }), [{ type: 'moveCity', cityId: 'haven' }]).events)).toEqual(['not-in-challenge']);
    expect(rejected(play(content, game(content, { noProperty: true }), [{ type: 'buyProperty', typeId: 'studio', downPayment: 50_000_000, mortgage: 'none', rented: false }]).events)).toEqual([
      'not-in-challenge',
    ]);
    // A game with no limits takes the same orders.
    expect(rejected(play(content, game(content), [{ type: 'moveCity', cityId: 'haven' }]).events)).toEqual([]);
  });

  it('close a card option that could do what the game forbids, in its effects or in any outcome, and play the default instead', () => {
    const content = fixtureContent();
    const card: CardDef = {
      id: 'offer',
      category: 'investing',
      weight: 10,
      cooldown: 0,
      options: [
        {},
        { effects: { invest: { assetId: 'stock_growth', amount: 100_000 } } },
        { outcomes: [{ weight: 1, effects: {} }, { weight: 1, effects: { moveCity: 'haven' } }] },
        // A fourth option needs a condition; this one holds for everyone with money.
        { when: { minNetWorth: 0 }, effects: { invest: { assetId: 'fund_world', amount: 100_000 } } },
      ],
    };
    content.cards = [card];
    const state = game(content, { onlyAssets: ['fund_world'], noMoving: true });
    const at = { content, world: state.timeline[0], round: 0, limits: state.limits };
    expect(card.options.map((_, i) => optionLock(state.player, card, i, at))).toEqual([null, 'challenge', 'challenge', null]);
    // Without limits every option is open.
    expect(card.options.map((_, i) => optionLock(state.player, card, i, { content, world: state.timeline[0], round: 0 }))).toEqual([null, null, null, null]);
    // Asked for a closed option, the game plays the first.
    const dealt = { ...state, hand: ['offer'], answered: 0, phase: 'cards' as const };
    const { events } = applyCard(content, dealt, 1);
    expect(events.find((e) => e.kind === 'card')).toMatchObject({ cardId: 'offer', picked: 1, option: 0 });
  });
});
