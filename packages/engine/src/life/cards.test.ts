import { describe, expect, it } from 'vitest';
import { applyCard, applyCards, applyRound, createGame, previewRound } from '../game';
import { fixtureContent, fixtureStart } from '../testing/fixture';
import { withPlayer } from '../testing/patch';
import type { CardDef, Content, GameEvent, GameState, LedgerLine, LifeStart, StartConfig } from '../types';
import { previewCard } from './cards';

const office: LifeStart = { lifeId: 'tester', career: { id: 'office', level: 0 }, careerSkill: 0, financeSkill: 0, focus: 3 };

const card = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id,
  category: 'luck',
  weight: 10,
  cooldown: 0,
  options: [{}, { effects: { cash: 100_000 } }],
  ...over,
});

function contentWith(cards: CardDef[], change: (c: Content) => void = () => {}): Content {
  const content = fixtureContent();
  content.cards = cards;
  change(content);
  return content;
}

const start = (over: Partial<StartConfig> = {}, life: Partial<LifeStart> = {}): StartConfig => ({
  ...fixtureStart(),
  cash: 1_000_000,
  ...over,
  life: { ...office, ...life },
});

const cardEvents = (events: GameEvent[]) => events.filter((e) => e.kind === 'card');
const ledger = (events: GameEvent[], line: LedgerLine): number | undefined => {
  const found = events.find((e) => e.kind === 'ledger' && e.line === line);
  return found && found.kind === 'ledger' ? found.amount : undefined;
};

const five = ['a', 'b', 'c', 'd', 'e'].map((id) => card(id));

describe('the hand', () => {
  it('is drawn when the game starts', () => {
    const content = contentWith(five);
    const state = createGame({ content, start: start() }, 'hand');
    expect(state.phase).toBe('cards');
    expect(state.hand).toHaveLength(3);
    expect(new Set(state.hand).size).toBe(3);
    for (const id of state.hand) expect(['a', 'b', 'c', 'd', 'e']).toContain(id);
    expect(state.player.life.seen).toEqual(Object.fromEntries(state.hand.map((id) => [id, 0])));
  });

  it('holds every eligible card when there are fewer than the hand size, and skips the phase when there are none', () => {
    const two = createGame({ content: contentWith(five.slice(0, 2)), start: start() }, 'few');
    expect([...two.hand].sort()).toEqual(['a', 'b']);
    const none = createGame({ content: contentWith([]), start: start() }, 'none');
    expect(none.hand).toEqual([]);
    expect(none.phase).toBe('finance');
  });

  it('leaves out cards whose condition fails, and world cards', () => {
    const content = contentWith([
      card('single', { when: { partner: false } }),
      card('married', { when: { partner: true } }),
      card('storm', { category: 'world', trigger: { regimes: ['recession'] } }),
    ]);
    for (let i = 0; i < 20; i++) {
      expect(createGame({ content, start: start() }, `cond-${i}`).hand).toEqual(['single']);
    }
  });

  it('draws a card marked once at most once, and waits out a cooldown', () => {
    const content = contentWith([card('rare', { once: true, weight: 1_000 }), card('slow', { cooldown: 2, weight: 1_000 }), ...five], (c) => {
      c.life.cardsPerRound = 2;
    });
    for (let i = 0; i < 10; i++) {
      let state = createGame({ content, start: start() }, `cool-${i}`);
      const rare: number[] = [];
      const slow: number[] = [];
      while (!state.finished) {
        if (state.hand.includes('rare')) rare.push(state.round);
        if (state.hand.includes('slow')) slow.push(state.round);
        state = applyRound(content, state, { orders: [] }).state;
      }
      // Far heavier than the rest, it comes up at once or nearly; marked once, it never comes up again.
      expect(rare).toHaveLength(1);
      expect(rare[0]).toBeLessThanOrEqual(1);
      expect(slow.length).toBeGreaterThan(3);
      for (let k = 1; k < slow.length; k++) expect(slow[k] - slow[k - 1]).toBeGreaterThanOrEqual(3);
    }
  });

  it('favours heavier cards', () => {
    const content = contentWith([card('heavy', { weight: 99 }), card('light', { weight: 1 })], (c) => {
      c.life.cardsPerRound = 1;
    });
    let heavy = 0;
    for (let i = 0; i < 300; i++) {
      if (createGame({ content, start: start() }, `weight-${i}`).hand[0] === 'heavy') heavy += 1;
    }
    expect(heavy).toBeGreaterThan(280);
    expect(heavy).toBeLessThan(300);
  });

  it('is the same for the same seed, and differs between players who share a world', () => {
    const content = contentWith(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'].map((id) => card(id)));
    const one = createGame({ content, start: start() }, 'shared');
    const again = createGame({ content, start: start() }, 'shared');
    expect(again.hand).toEqual(one.hand);
    const hands = new Set<string>();
    for (const playerKey of ['ana', 'ben', 'cleo', 'dan']) {
      const seat = createGame({ content, start: start(), playerKey }, 'shared');
      expect(seat.timeline).toEqual(one.timeline);
      hands.add(seat.hand.join());
    }
    expect(hands.size).toBeGreaterThan(1);
  });

  it('is drawn again each round, and not once the game is over', () => {
    const content = contentWith(five);
    let state = createGame({ content, start: start() }, 'again');
    const hands = new Set<string>();
    while (!state.finished) {
      expect(state.phase).toBe('cards');
      expect(state.hand).toHaveLength(3);
      hands.add(state.hand.join());
      state = applyRound(content, state, { orders: [] }).state;
    }
    expect(hands.size).toBeGreaterThan(3);
    expect(state.hand).toEqual([]);
    expect(state.phase).toBe('finance');
  });

  it('starts with the world card of the round when the player qualifies for it', () => {
    const world = card('storm', { category: 'world', trigger: {}, weight: 10 });
    const content = contentWith([world, ...five], (c) => {
      c.world.quietWeight = 0;
    });
    let state = createGame({ content, start: start() }, 'event');
    expect(state.timeline[0].eventCardId).toBeNull();
    expect(state.hand).not.toContain('storm');
    state = applyRound(content, state, { orders: [] }).state;
    expect(state.timeline[1].eventCardId).toBe('storm');
    expect(state.hand[0]).toBe('storm');
    expect(state.hand).toHaveLength(4);

    const picky = contentWith([{ ...world, when: { partner: true } }, ...five], (c) => {
      c.world.quietWeight = 0;
    });
    const other = applyRound(picky, createGame({ content: picky, start: start() }, 'event'), { orders: [] }).state;
    expect(other.timeline[1].eventCardId).toBe('storm');
    expect(other.hand).not.toContain('storm');
    expect(other.hand).toHaveLength(3);
  });
});

describe('applyCards', () => {
  const bonus = card('bonus');
  const one = (cards: CardDef[] = [bonus], startOver: Partial<StartConfig> = {}, life: Partial<LifeStart> = {}) => {
    const content = contentWith(cards);
    return { content, state: createGame({ content, start: start(startOver, life) }, 'apply') };
  };

  it('applies the picked option, reports it and moves on to the finance phase', () => {
    const { content, state } = one();
    const before = JSON.stringify(state);
    const result = applyCards(content, state, { bonus: 1 });
    expect(result.state.player.cash).toBe(1_100_000);
    expect(result.state.phase).toBe('finance');
    expect(result.state.hand).toEqual(['bonus']);
    expect(result.events).toEqual([{ kind: 'card', cardId: 'bonus', picked: 1, option: 1, outcome: null, cash: 100_000 }]);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('takes the first option for a card with no answer or a malformed one', () => {
    const { content, state } = one();
    for (const picks of [{}, { bonus: 5 }, { bonus: -1 }, { bonus: 1.5 }, { bonus: '1' }, { bonus: null }, { other: 1 }]) {
      const result = applyCards(content, state, picks as never);
      expect(result.state.player.cash).toBe(1_000_000);
      expect(result.events).toEqual([{ kind: 'card', cardId: 'bonus', picked: null, option: 0, outcome: null, cash: 0 }]);
    }
    const inherited = Object.create({ bonus: 1 }) as Record<string, number>;
    expect(applyCards(content, state, inherited).events[0]).toMatchObject({ picked: null, option: 0 });
  });

  it('refuses picks that are not a record, a finished game, and a second call', () => {
    const { content, state } = one();
    for (const picks of [null, undefined, 'bonus', [1], 3]) {
      expect(() => applyCards(content, state, picks as never)).toThrow('applyCards: picks must be a record of card id to option number');
    }
    const answered = applyCards(content, state, {}).state;
    expect(() => applyCards(content, answered, {})).toThrow('applyCards: the cards of this round are already answered');
    let over = state;
    while (!over.finished) over = applyRound(content, over, { orders: [] }).state;
    expect(() => applyCards(content, over, {})).toThrow('applyCards: the game is already finished');
  });

  it('falls back to the first option when the picked one is locked by its condition', () => {
    const { content, state } = one([card('proposal', { options: [{}, { when: { partner: true }, effects: { status: 5 } }] })]);
    const result = applyCards(content, state, { proposal: 1 });
    expect(result.events).toEqual([{ kind: 'card', cardId: 'proposal', picked: 1, option: 0, outcome: null, cash: 0 }]);
    expect(result.state.player.life.bonusStatus).toBe(0);
  });

  it('locks an option the player cannot pay for, counting the deposit as money', () => {
    const pricey = card('pricey', { options: [{}, { effects: { cash: -1_500_000, status: 3 } }] });
    const poor = one([pricey]);
    expect(applyCards(poor.content, poor.state, { pricey: 1 }).events[0]).toMatchObject({ picked: 1, option: 0, cash: 0 });

    const saver = withPlayer(poor.content, poor.state, { deposit: 800_000 });
    const result = applyCards(poor.content, saver, { pricey: 1 });
    expect(result.events[0]).toMatchObject({ picked: 1, option: 1, cash: -1_500_000 });
    expect(ledger(result.events, 'depositDraw')).toBe(500_000);
    expect(result.state.player.cash).toBe(0);
    expect(result.state.player.deposit).toBe(300_000);
    expect(result.state.player.debts).toEqual([]);
  });

  it('locks an option that needs more focus than is left', () => {
    const push = card('push', { options: [{}, { effects: { focus: 2, careerSkill: 2 } }] });
    const { content, state } = one([push], {}, { focus: 1 });
    expect(applyCards(content, state, { push: 1 }).events[0]).toMatchObject({ picked: 1, option: 0 });
    const rested = one([push]);
    const result = applyCards(rested.content, rested.state, { push: 1 });
    expect(result.events[0]).toMatchObject({ option: 1 });
    expect(result.state.player.life.focusUsed).toBe(2);
  });

  it('locks an option that takes a loan while the bankruptcy lock lasts', () => {
    const credit = card('credit', { options: [{}, { effects: { loan: 500_000, status: 4 } }] });
    const { content, state } = one([credit]);
    const locked = withPlayer(content, state, { bankruptUntilRound: 3 });
    const refused = applyCards(content, locked, { credit: 1 });
    expect(refused.events[0]).toMatchObject({ picked: 1, option: 0 });
    expect(refused.state.player.debts).toEqual([]);
    expect(previewCard(content, locked, 'credit')[1].available).toBe(false);
    const free = withPlayer(content, { ...state, round: 3 }, { bankruptUntilRound: 3 });
    expect(previewCard(content, free, 'credit')[1].available).toBe(true);
    expect(applyCards(content, state, { credit: 1 }).events[0]).toMatchObject({ picked: 1, option: 1, cash: 500_000 });
  });

  it('locks buying an item already owned, and a mortgage during the bankruptcy lock', () => {
    const car = card('car', { options: [{}, { effects: { buyItem: { itemId: 'car_basic', pricePct: 10 } } }] });
    const flat = card('flat', { options: [{}, { effects: { property: { typeId: 'studio', pricePct: 50, downPct: 5, rented: false } } }] });
    const outright = card('outright', { options: [{}, { effects: { property: { typeId: 'studio', pricePct: 1, downPct: 100, rented: false } } }] });
    const { content, state } = one([car, flat, outright], { cash: 5_000_000 });
    const owner = withPlayer(content, state, {}, { items: [{ itemId: 'car_basic', value: 1, roundsLeft: null, paid: 0, age: 0 }], collection: ['car_basic'] });
    const locked = withPlayer(content, owner, { bankruptUntilRound: 3 });
    const events = cardEvents(applyCards(content, locked, { car: 1, flat: 1, outright: 1 }).events);
    const byId = Object.fromEntries(events.map((e) => [e.kind === 'card' ? e.cardId : '', e]));
    expect(byId.car).toMatchObject({ picked: 1, option: 0 });
    expect(byId.flat).toMatchObject({ picked: 1, option: 0 });
    expect(byId.outright).toMatchObject({ picked: 1, option: 1 });
    const free = cardEvents(applyCards(content, state, { car: 1, flat: 1, outright: 1 }).events);
    expect(free).toHaveLength(3);
    for (const e of free) expect(e).toMatchObject({ option: 1 });
  });

  it('puts a bill the player cannot cover on the deposit and then the credit card', () => {
    const dentist = card('dentist', { options: [{ effects: { cash: -300_000 } }, { effects: { cash: -100_000, focus: 1 } }] });
    const { content, state } = one([dentist], { cash: 0 });
    const result = applyCards(content, withPlayer(content, state, { deposit: 100_000 }), {});
    expect(result.events).toEqual([
      { kind: 'card', cardId: 'dentist', picked: null, option: 0, outcome: null, cash: -300_000 },
      { kind: 'ledger', line: 'depositDraw', amount: 100_000 },
      { kind: 'ledger', line: 'creditCardDraw', amount: 200_000 },
    ]);
    expect(result.state.player.cash).toBe(0);
    expect(result.state.player.deposit).toBe(0);
    expect(result.state.player.debts).toEqual([{ id: 'debt-1', kind: 'creditCard', principal: 200_000, fixedRateBp: 0, roundsLeft: 0 }]);
  });

  it('settles each card before the next, so a windfall does not undo an earlier bill', () => {
    const bill = card('bill', { options: [{ effects: { cash: -300_000 } }, {}] });
    const windfall = card('windfall', { options: [{}, { effects: { cash: 100_000 } }] });
    const content = contentWith([bill, windfall]);
    let state = createGame({ content, start: start({ cash: 0 }) }, 'red');
    state = { ...state, hand: ['bill', 'windfall'] };
    const result = applyCards(content, state, { windfall: 1 });
    expect(cardEvents(result.events)[1]).toMatchObject({ cardId: 'windfall', picked: 1, option: 1, cash: 100_000 });
    // The bill went on the credit card as soon as its card was answered. The windfall is cash, to repay it with or not.
    expect(result.state.player.debts[0].principal).toBe(300_000);
    expect(result.state.player.cash).toBe(100_000);
  });

  it('rolls an outcome from the player’s own stream', () => {
    const gamble = card('gamble', {
      options: [{}, { effects: { cash: -1_000 }, outcomes: [{ weight: 1, effects: { cash: 50_000 } }, { weight: 1, effects: { cash: -20_000 } }] }],
    });
    const content = contentWith([gamble]);
    const seen = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const state = createGame({ content, start: start() }, `roll-${i}`);
      const result = applyCards(content, state, { gamble: 1 });
      const event = result.events[0];
      if (event.kind !== 'card' || event.outcome === null) throw new Error('expected a rolled outcome');
      seen.add(event.outcome);
      expect(event.cash).toBe(event.outcome === 0 ? 49_000 : -21_000);
      expect(result.state.player.cash).toBe(1_000_000 + event.cash);
      expect(result.state.rng.cards).not.toEqual(state.rng.cards);
      expect(applyCards(content, state, { gamble: 1 }).events).toEqual(result.events);
      const declined = applyCards(content, state, {});
      expect(declined.state.rng.cards).toEqual(state.rng.cards);
      expect(declined.events[0]).toMatchObject({ outcome: null });
    }
    expect([...seen].sort()).toEqual([0, 1]);
  });

  it('answers the cards in hand order, so a later card sees what an earlier one did', () => {
    const first = card('first', { options: [{}, { effects: { setFlags: ['met'] } }] });
    const second = card('second', { options: [{}, { when: { flags: ['met'] }, effects: { status: 4 } }] });
    const content = contentWith([first, second]);
    let state = createGame({ content, start: start() }, 'order');
    for (let i = 0; state.hand[0] !== 'first'; i++) state = createGame({ content, start: start() }, `order-${i}`);
    expect(applyCards(content, state, { first: 1, second: 1 }).state.player.life.bonusStatus).toBe(4);
    const reversed = { ...state, hand: ['second', 'first'] };
    expect(applyCards(content, reversed, { first: 1, second: 1 }).state.player.life.bonusStatus).toBe(0);
  });
});

describe('a card that no longer fits', () => {
  // `leave` can end the thing `boss` is about. `spare` is only open once that has happened, so it is never dealt at the start.
  const leave = card('leave', { weight: 1_000_000, options: [{}, { effects: { setFlags: ['gone'] } }] });
  const boss = card('boss', { when: { notFlags: ['gone'] }, options: [{ effects: { status: 9 } }, {}] });
  const spare = card('spare', { when: { flags: ['gone'] }, options: [{ effects: { cash: 5 } }, {}] });
  const dealt = (cards: CardDef[]) => {
    const content = contentWith(cards, (c) => {
      c.life.cardsPerRound = 2;
    });
    let state = createGame({ content, start: start() }, 'fit');
    for (let i = 0; state.hand[0] !== 'leave'; i++) state = createGame({ content, start: start() }, `fit-${i}`);
    expect(state.hand).toEqual(['leave', 'boss']);
    return { content, state };
  };
  const withdrawn = (events: GameEvent[]) => events.filter((e) => e.kind === 'cardWithdrawn');

  it('is withdrawn when an earlier answer undid its condition, and another open card takes its place', () => {
    const { content, state } = dealt([leave, boss, spare]);
    const one = applyCard(content, state, 1);
    expect(one.state.hand).toEqual(['leave', 'spare']);
    expect(withdrawn(one.events)).toEqual([{ kind: 'cardWithdrawn', cardId: 'boss', replacedBy: 'spare' }]);
    // The card taken out was never played, so it may be dealt another round; the one put in has been.
    expect(one.state.player.life.seen).toEqual({ leave: 0, spare: 0 });
    expect(one.state.phase).toBe('cards');

    const two = applyCard(content, one.state, 0);
    expect(cardEvents(two.events)).toMatchObject([{ cardId: 'spare' }]);
    expect(two.state.player.life.bonusStatus).toBe(0);
    expect(two.state.phase).toBe('finance');
  });

  it('leaves the hand a card shorter when nothing else is open, and ends the phase if it was the last', () => {
    const { content, state } = dealt([leave, boss]);
    const one = applyCard(content, state, 1);
    expect(one.state.hand).toEqual(['leave']);
    expect(withdrawn(one.events)).toEqual([{ kind: 'cardWithdrawn', cardId: 'boss', replacedBy: null }]);
    expect(one.state.player.life.seen).toEqual({ leave: 0 });
    expect(one.state.phase).toBe('finance');
    expect(one.state.player.life.bonusStatus).toBe(0);
  });

  it('stays when its condition still holds', () => {
    const { content, state } = dealt([leave, boss, spare]);
    const one = applyCard(content, state, 0);
    expect(one.state.hand).toEqual(['leave', 'boss']);
    expect(withdrawn(one.events)).toEqual([]);
    expect(applyCard(content, one.state, 0).state.player.life.bonusStatus).toBe(9);
  });

  it('is withdrawn the same way when the whole hand is answered at once', () => {
    const { content, state } = dealt([leave, boss, spare]);
    const all = applyCards(content, state, { leave: 1, boss: 0, spare: 0 });
    expect(cardEvents(all.events).map((e) => (e.kind === 'card' ? e.cardId : ''))).toEqual(['leave', 'spare']);
    expect(all.state.player.life.bonusStatus).toBe(0);
    const step = applyCard(content, applyCard(content, state, 1).state, 0);
    expect(all.state).toEqual(step.state);
  });

  it('calls back a card that is still resting sooner than leave the round a card short, but only when nothing else is open', () => {
    const rested = card('rested', { when: { flags: ['gone'] }, cooldown: 5 });
    const later = (cards: CardDef[]) => {
      // The third round, with `rested` last seen in the first: two rounds into a rest of five.
      const { content, state } = dealt(cards);
      const moved = { ...withPlayer(content, state, {}, { seen: { leave: 2, boss: 2, rested: 0 } }), round: 2 };
      return { content, state: withPlayer(content, moved, {}) };
    };
    const alone = later([leave, boss, rested]);
    const one = applyCard(alone.content, alone.state, 1);
    expect(one.state.hand).toEqual(['leave', 'rested']);
    expect(withdrawn(one.events)).toEqual([{ kind: 'cardWithdrawn', cardId: 'boss', replacedBy: 'rested' }]);
    expect(one.state.player.life.seen).toEqual({ leave: 2, rested: 2 });

    // With a card that is properly open beside it, the resting one is left to rest.
    const both = later([leave, boss, rested, spare]);
    expect(applyCard(both.content, both.state, 1).state.hand).toEqual(['leave', 'spare']);
  });

  it('never puts back a card of this very round, nor one that comes once in a life', () => {
    const spent = card('spent', { when: { flags: ['gone'] }, once: true });
    const { content, state } = dealt([leave, boss, spent]);
    const seenIt = withPlayer(content, state, {}, { seen: { ...state.player.life.seen, spent: 0 } });
    expect(applyCard(content, seenIt, 1).state.hand).toEqual(['leave']);
    // A card dealt this round and withdrawn is not dealt again in it.
    const chief = card('chief', { when: { notFlags: ['gone'] } });
    const three = contentWith([leave, boss, chief], (c) => {
      c.life.cardsPerRound = 3;
    });
    let hand = createGame({ content: three, start: start() }, 'again');
    for (let i = 0; hand.hand[0] !== 'leave'; i++) hand = createGame({ content: three, start: start() }, `again-${i}`);
    expect(applyCard(three, hand, 1).state.hand).toEqual(['leave']);
  });

  it('withdraws one card after another until one fits', () => {
    const chief = card('chief', { when: { notFlags: ['gone'] } });
    const content = contentWith([leave, boss, chief], (c) => {
      c.life.cardsPerRound = 3;
    });
    let state = createGame({ content, start: start() }, 'chain');
    for (let i = 0; state.hand[0] !== 'leave'; i++) state = createGame({ content, start: start() }, `chain-${i}`);
    const one = applyCard(content, state, 1);
    expect(one.state.hand).toEqual(['leave']);
    expect(withdrawn(one.events)).toHaveLength(2);
    expect(one.state.phase).toBe('finance');
  });
});

describe('the two phases of a round', () => {
  const layoff = card('layoff', { options: [{ effects: { salaryBoostPct: -50 } }, { effects: { focus: 3 } }] });

  it('answers unanswered cards with their first option when the round is played', () => {
    const content = contentWith([layoff]);
    const state = createGame({ content, start: start() }, 'default');
    const direct = applyRound(content, state, { orders: [] });
    const stepped = applyRound(content, applyCards(content, state, {}).state, { orders: [] });
    expect(direct.state).toEqual(stepped.state);
    expect(direct.events[0]).toEqual({ kind: 'card', cardId: 'layoff', picked: null, option: 0, outcome: null, cash: 0 });
    expect(ledger(direct.events, 'salary')).toBe(2_400_000);
    expect(direct.state.player.life.salaryBoostPct).toBe(0);
    expect(direct.state.player.salaryAnnual).toBe(2_400_000);
  });

  it('previews only once the cards are answered', () => {
    const content = contentWith([layoff]);
    const state = createGame({ content, start: start() }, 'preview');
    expect(() => previewRound(content, state, { orders: [] })).toThrow('previewRound: answer the cards first');
    const answered = applyCards(content, state, {}).state;
    expect(previewRound(content, answered, { orders: [] }).income.salary).toBe(2_400_000);
  });

  it('shares focus between the cards and the orders of a round, and gives it back for the next', () => {
    const content = contentWith([layoff]);
    const state = createGame({ content, start: start() }, 'focus');
    const answered = applyCards(content, state, { layoff: 1 }).state;
    expect(answered.player.life.focusUsed).toBe(3);
    const { state: next, events } = applyRound(content, answered, { orders: [{ type: 'focus', action: 'overtime' }] });
    expect(events).toContainEqual({ kind: 'orderRejected', order: { type: 'focus', action: 'overtime' }, reason: 'no-focus' });
    expect(next.player.life.focusUsed).toBe(0);
    expect(next.phase).toBe('cards');
  });
});

describe('previewCard', () => {
  const deal = card('deal', {
    options: [
      { effects: { cash: -50_000 } },
      { effects: { cash: -2_000_000 } },
      { effects: { cashSalaryPct: 10 }, outcomes: [{ weight: 3, effects: { cash: 100_000 } }, { weight: 1, effects: { cash: -400_000 } }] },
    ],
  });

  it('shows what each option would cost and whether it is open, without changing anything', () => {
    const content = contentWith([deal]);
    const state = createGame({ content, start: start() }, 'peek');
    const before = JSON.stringify(state);
    expect(previewCard(content, state, 'deal')).toEqual([
      { available: true, lock: null, cash: -50_000, outcomes: [] },
      { available: false, lock: 'cash', cash: -2_000_000, outcomes: [] },
      { available: true, lock: null, cash: 240_000, outcomes: [{ weight: 3, cash: 100_000 }, { weight: 1, cash: -400_000 }] },
    ]);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('says why an option is locked, so the screen can tell the player', () => {
    // Three cards, two lockable options each, one for every reason there is.
    const cards = [
      card('why_a', { options: [{}, { when: { partner: true }, effects: { cash: 1 } }, { effects: { focus: 9 } }] }),
      card('why_b', { options: [{}, { effects: { buyItem: { itemId: 'car_basic', pricePct: 50 } } }, { effects: { cash: -5_000_000 } }] }),
      card('why_c', { options: [{}, { effects: { loan: 100_000 } }, { effects: { cash: -100_000, pension: 100_000 } }] }),
    ];
    const content = contentWith(cards);
    const state = createGame({ content, start: start() }, 'why');
    expect([...state.hand].sort()).toEqual(['why_a', 'why_b', 'why_c']);
    const locks = (s: GameState) => cards.flatMap((c) => previewCard(content, s, c.id).map((option) => option.lock));

    // Single, with a million in cash and three focus: no partner, no nine focus, no five million.
    expect(locks(state)).toEqual([null, 'condition', 'focus', null, null, 'cash', null, null, null]);
    const owner = withPlayer(content, state, {}, { items: [{ itemId: 'car_basic', value: 1, roundsLeft: null, paid: 0, age: 0 }], collection: ['car_basic'] });
    expect(locks(owner)[4]).toBe('owned');
    expect(locks(withPlayer(content, state, { bankruptUntilRound: 3 }))[7]).toBe('bankruptcy');
    const owing = withPlayer(content, state, { cash: 300_000, debts: [{ id: 'debt-1', kind: 'personalLoan', principal: 250_000, fixedRateBp: 700, roundsLeft: 2 }], nextId: 1 });
    expect(locks(owing)[8]).toBe('insolvent');
    // What is locked is exactly what is not available, and the first option never is.
    for (const s of [state, owner, owing]) {
      for (const c of cards) {
        const options = previewCard(content, s, c.id);
        for (const option of options) expect(option.available).toBe(option.lock === null);
        expect(options[0].lock).toBeNull();
      }
    }
  });

  it('refuses a card that is not in the hand', () => {
    const content = contentWith([deal, card('other', { when: { partner: true } })]);
    const state = createGame({ content, start: start() }, 'peek');
    expect(() => previewCard(content, state, 'other')).toThrow('previewCard: other is not in the hand');
    expect(() => previewCard(content, state, 'nope')).toThrow('previewCard: nope is not in the hand');
  });
});

describe('unstable pay', () => {
  const play = (state: GameState, content: Content): number[] => {
    const boosts: number[] = [];
    let current = state;
    while (!current.finished) {
      boosts.push(current.player.life.salaryBoostPct);
      current = applyRound(content, current, { orders: [] }).state;
    }
    return boosts;
  };

  it('swings the pay of a life with the flag each round, within the range, and never anyone else’s', () => {
    const content = fixtureContent();
    const gig = play(createGame({ content, start: start({}, { flags: ['unstable_pay'] }) }, 'gig'), content);
    expect(gig).toHaveLength(20);
    for (const boost of gig) {
      expect(Number.isInteger(boost)).toBe(true);
      expect(boost).toBeGreaterThanOrEqual(-30);
      expect(boost).toBeLessThanOrEqual(30);
    }
    expect(new Set(gig).size).toBeGreaterThan(5);
    expect(play(createGame({ content, start: start({}, { flags: ['unstable_pay'] }) }, 'gig'), content)).toEqual(gig);
    expect(play(createGame({ content, start: start() }, 'gig'), content)).toEqual(new Array(20).fill(0));
  });

  it('shows the swing in the salary before the player decides, and adds overtime on top', () => {
    const content = fixtureContent();
    const state = createGame({ content, start: start({}, { flags: ['unstable_pay'] }) }, 'gig-2');
    const boost = state.player.life.salaryBoostPct;
    expect(state.player.salaryAnnual).toBe(Math.floor((2_400_000 * (100 + boost)) / 100));
    const preview = previewRound(content, state, { orders: [{ type: 'focus', action: 'overtime' }] });
    expect(preview.player.life.salaryBoostPct).toBe(boost + 15);
  });
});
