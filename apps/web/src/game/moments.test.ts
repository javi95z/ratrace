import { content, lives } from '@ratrace/content';
import type { Milestone } from '@ratrace/content';
import { createGame, viewOf } from '@ratrace/engine';
import type { GameEvent, GameView } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { momentsOf } from './moments';
import type { Seen } from './moments';
import { cuesFor } from './sound';
import type { Heard } from './sound';

function view(change: (view: GameView) => void = () => undefined): GameView {
  const made = viewOf(createGame({ content, start: lives[0].start }, 'moments'));
  made.timeline = Array.from({ length: 6 }, (_, round) => ({ ...made.timeline[0], round }));
  made.round = 5;
  change(made);
  return made;
}
const crisis = (year: number) => (v: GameView) => (v.timeline[v.round].crisis = { id: 'crash', year, of: 3 });
const seen = (over: Partial<Seen>): Seen => ({ stage: 'news', view: view(), resolved: null, story: [], ...over });
const resolved = (events: GameEvent[]) => ({ before: view(), events });
const million: Milestone = { round: 5, kind: 'worth', mark: 100_000_000 };

describe('the moments that stop the game', () => {
  it('are none in an ordinary round, at any stage', () => {
    for (const stage of ['news', 'cards', 'outcome', 'finance', 'resolve', 'end'] as const) {
      expect(momentsOf(seen({ stage, resolved: resolved([{ kind: 'ledger', line: 'salary', amount: 1 }]) })), stage).toEqual([]);
    }
    expect(momentsOf(seen({ view: null }))).toEqual([]);
  });

  it('come with the result of the round that made or broke the life, the gravest first', () => {
    const events: GameEvent[] = [{ kind: 'escaped', round: 5 }, { kind: 'bankrupt', proceeds: 700, debtsCleared: 900 }];
    expect(momentsOf(seen({ stage: 'resolve', resolved: resolved(events), story: [million] }))).toEqual([
      { key: '5:bankrupt', kind: 'bankrupt', proceeds: 700, debtsCleared: 900 },
      { key: '5:escape', kind: 'escape' },
      { key: '5:million', kind: 'million' },
    ]);
    // The same events are not a moment before their round is on screen, nor after it.
    for (const stage of ['finance', 'news', 'end'] as const) expect(momentsOf(seen({ stage, resolved: resolved(events) })), stage).toEqual([]);
  });

  it('count the first million only in the round it was reached', () => {
    expect(momentsOf(seen({ stage: 'resolve', resolved: resolved([]), story: [{ ...million, round: 4 }] }))).toEqual([]);
    expect(momentsOf(seen({ stage: 'resolve', resolved: resolved([]), story: [{ round: 5, kind: 'worth', mark: 10_000_000 }] }))).toEqual([]);
    expect(momentsOf(seen({ stage: 'resolve', resolved: resolved([]), story: [million] }))).toEqual([{ key: '5:million', kind: 'million' }]);
  });

  it('open a crisis with the round it begins in, and not with the rounds it goes on', () => {
    expect(momentsOf(seen({ view: view(crisis(1)) }))).toEqual([{ key: '5:crisis', kind: 'crisis', crisisId: 'crash', rounds: 3 }]);
    expect(momentsOf(seen({ view: view(crisis(2)) }))).toEqual([]);
    expect(momentsOf(seen({ stage: 'finance', view: view(crisis(1)) }))).toEqual([]);
  });
});

describe('what the game sounds like', () => {
  const heard = (over: Partial<Heard>): Heard => ({ stage: 'news', view: view(), resolved: null, orders: [], refusal: null, earned: [], story: [], ...over });
  const NONE: string[] = [];

  it('is silent while nothing changes, and without a life', () => {
    expect(cuesFor(heard({}), heard({}))).toEqual([]);
    expect(cuesFor(heard({ stage: 'cards', view: null }), heard({ view: null }))).toEqual([]);
  });

  it('deals a card, makes a choice, rolls the ledger and ends a life', () => {
    expect(cuesFor(heard({ stage: 'cards' }), heard({}))).toEqual(['card']);
    expect(cuesFor(heard({ stage: 'outcome' }), heard({ stage: 'cards' }))).toEqual(['pick']);
    expect(cuesFor(heard({ stage: 'finance' }), heard({ stage: 'outcome' }))).toEqual([]);
    expect(cuesFor(heard({ stage: 'resolve', resolved: resolved([]) }), heard({ stage: 'finance' }))).toEqual(['round']);
    expect(cuesFor(heard({ stage: 'end' }), heard({ stage: 'resolve' }))).toEqual(['end']);
  });

  it('rings a coin for an order taken and buzzes for one refused, in the finances only', () => {
    const order = { type: 'depositIn' as const, amount: 100 };
    const finance = heard({ stage: 'finance' });
    expect(cuesFor({ ...finance, orders: [order] }, finance)).toEqual(['coin']);
    expect(cuesFor(finance, { ...finance, orders: [order] })).toEqual([]);
    expect(cuesFor({ ...finance, refusal: 'not-enough-cash' }, finance)).toEqual(['refuse']);
    // The same refusal still on screen is not a second buzz.
    expect(cuesFor({ ...finance, refusal: 'not-enough-cash' }, { ...finance, refusal: 'not-enough-cash' })).toEqual([]);
  });

  it('plays the moment of a round instead of its ledger, and the news of a round when it has no moment', () => {
    const after = (events: GameEvent[], story: Milestone[] = []) => cuesFor(heard({ stage: 'resolve', resolved: resolved(events), story }), heard({ stage: 'finance' }));
    expect(after([{ kind: 'bankrupt', proceeds: 0, debtsCleared: 0 }, { kind: 'escaped', round: 5 }])).toEqual(['bankrupt']);
    expect(after([{ kind: 'escaped', round: 5 }])).toEqual(['escape']);
    expect(after([], [million])).toEqual(['million']);
    expect(after([{ kind: 'promoted', careerId: 'tech', level: 1 }])).toEqual(['promote']);
    expect(after([{ kind: 'escapeLost' }])).toEqual(['bad']);
  });

  it('sounds the siren when a crisis opens and the all-clear when it is over', () => {
    const opening = (now: (v: GameView) => void, before: (v: GameView) => void = () => undefined) =>
      cuesFor(heard({ view: view((v) => (before(v), now(v))) }), heard({ stage: 'resolve' }));
    const was = (v: GameView) => (v.timeline[v.round - 1].crisis = { id: 'crash', year: 3, of: 3 });
    expect(opening(crisis(1))).toEqual(['crisis']);
    expect(opening(crisis(2))).toEqual([]);
    expect(opening(() => undefined, was)).toEqual(['calm']);
    expect(opening(() => undefined)).toEqual([]);
  });

  it('rings a badge earned for the first time, unless a moment already has the floor', () => {
    const earned = ['first_100k'];
    expect(cuesFor(heard({ stage: 'resolve', resolved: resolved([]), earned }), heard({ stage: 'finance', earned: NONE }))).toEqual(['round', 'badge']);
    expect(cuesFor(heard({ stage: 'resolve', resolved: resolved([{ kind: 'escaped', round: 5 }]), earned }), heard({ stage: 'finance', earned: NONE }))).toEqual(['escape']);
    expect(cuesFor(heard({ stage: 'outcome', earned }), heard({ stage: 'cards', earned: NONE }))).toEqual(['pick', 'badge']);
  });
});
