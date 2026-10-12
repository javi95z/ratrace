import { describe, expect, it } from 'vitest';
import { applyRound, createGame } from './game';
import { canonical, stateHash } from './hash';
import { netWorth } from './selectors';
import { fixtureContent, fixtureStart } from './testing/fixture';
import { playGame, scriptedChoices } from './testing/play';
import type { GameState, LedgerLine } from './types';

const content = fixtureContent();
const start = { ...fixtureStart(), cash: 5_000_000 };

describe('hash', () => {
  it('ignores key order and separates different states', () => {
    expect(canonical({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe('{"a":[2,{"c":4,"d":3}],"b":1}');
    expect(stateHash({ a: 1, b: 2 })).toBe(stateHash({ b: 2, a: 1 }));
    expect(stateHash({ a: 1 })).not.toBe(stateHash({ a: 2 }));
    expect(stateHash({ a: 1 })).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('determinism', () => {
  it('replays to the same hash from the same seed and choices', () => {
    const a = playGame(content, start, 'replay', scriptedChoices(content));
    const b = playGame(content, start, 'replay', scriptedChoices(content));
    expect(stateHash(a.state)).toBe(stateHash(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('gives a different game for a different seed', () => {
    const a = playGame(content, start, 'replay', scriptedChoices(content));
    const b = playGame(content, start, 'other', scriptedChoices(content));
    expect(stateHash(a.state)).not.toBe(stateHash(b.state));
  });

  it('is unchanged by saving and loading between every round', () => {
    const straight = playGame(content, start, 'saves', scriptedChoices(content));
    let state = createGame({ content, start }, 'saves');
    while (!state.finished) {
      state = JSON.parse(JSON.stringify(state)) as GameState;
      state = applyRound(content, state, scriptedChoices(content)(state)).state;
    }
    expect(stateHash(state)).toBe(stateHash(straight.state));
  });

  it('exercises the scripted strategy for real', () => {
    const seeds = ['a', 'b', 'c', 'd', 'e'];
    const games = seeds.map((seed) => playGame(content, start, seed, scriptedChoices(content)));
    const events = games.flatMap((g) => g.events);
    const lines = new Set(events.flatMap((e) => (e.kind === 'ledger' ? [e.line] : [])));
    const expected: LedgerLine[] = [
      'salary', 'dividends', 'interest', 'rent', 'living',
      'debtInterest', 'debtPrincipal', 'incomeTax', 'investmentTax', 'propertyTax',
    ];
    for (const line of expected) expect(lines.has(line)).toBe(true);
    for (const g of games) expect(g.state.round).toBe(20);
  });

  it('stays finite and whole with absurd wealth', () => {
    const rich = { ...fixtureStart(), cash: 1e15 };
    const { state } = playGame(content, rich, 'rich', scriptedChoices(content));
    const worth = netWorth(state.player);
    expect(Number.isFinite(worth)).toBe(true);
    expect(Number.isInteger(worth)).toBe(true);
  });
});
