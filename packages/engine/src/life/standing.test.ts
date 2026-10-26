import { describe, expect, it } from 'vitest';
import { applyRound, createGame, previewRound } from '../game';
import { findInvariantBreaks } from '../invariants';
import { escapeProgress, finalScore, scoreBreakdown } from '../selectors';
import { fixtureContent, fixtureStart } from '../testing/fixture';
import { passive, withPlayer } from '../testing/patch';
import type { GameEvent, GameState, LifeStart } from '../types';

const content = fixtureContent();
const office: LifeStart = { lifeId: 'tester', career: { id: 'office', level: 0 }, careerSkill: 0, financeSkill: 0, focus: 3 };
const game = (cash = 5_000_000, seed = 'standing'): GameState => createGame({ content, start: { ...fixtureStart(), cash, life: office } }, seed);
const kinds = (events: GameEvent[]) => events.map((e) => e.kind);

describe('status is what was lived, not what is held at the end', () => {
  it('adds up the status of every round, as it stood once that round’s orders had run', () => {
    let state = game();
    expect(state.player.statusSum).toBe(0);
    state = applyRound(content, state, { orders: [] }).state;
    expect(state.player.statusSum).toBe(2);
    state = applyRound(content, state, { orders: [{ type: 'buyItem', itemId: 'watch_gold' }] }).state;
    expect(state.player.statusSum).toBe(2 + 14);
    state = applyRound(content, state, { orders: [{ type: 'sellItem', itemId: 'watch_gold' }] }).state;
    expect(state.player.statusSum).toBe(2 + 14 + 2);
  });

  it('scores the average over the rounds played', () => {
    let state = game();
    state = applyRound(content, state, { orders: [] }).state;
    state = applyRound(content, state, { orders: [{ type: 'buyItem', itemId: 'watch_gold' }] }).state;
    expect(scoreBreakdown(content, state).status).toBe(8);
    expect(state.player.statusPoints).toBe(14);
  });

  it('scores the status held now before any round is played', () => {
    const state = withPlayer(content, game(), {}, { bonusStatus: 48 });
    expect(state.player.statusPoints).toBe(50);
    expect(scoreBreakdown(content, state).status).toBe(50);
  });

  it('gives a last-round splurge one twentieth of its status', () => {
    let quiet = game(50_000_000);
    let splurge = game(50_000_000);
    for (let round = 0; round < 20; round++) {
      quiet = applyRound(content, quiet, { orders: [] }).state;
      splurge = applyRound(content, splurge, { orders: round === 19 ? [{ type: 'buyItem', itemId: 'car_sports' }] : [] }).state;
    }
    // The sports car is worth 40 status: 40 / 20 rounds = 2 more on the average.
    expect(scoreBreakdown(content, splurge).status - scoreBreakdown(content, quiet).status).toBe(2);
    expect(splurge.player.statusPoints - quiet.player.statusPoints).toBe(40);
  });

  it('keeps the sum a whole number that the invariants check', () => {
    const state = game();
    expect(findInvariantBreaks(content, withPlayer(content, state, { statusSum: 1.5 }))).toEqual(['statusSum is not a non-negative whole number: 1.5']);
  });
});

describe('scoreBreakdown', () => {
  it('shows the three parts of the score, and they give the score', () => {
    const state = withPlayer(content, game(100_000_000), { escapedAtRound: 1 }, { bonusStatus: 48 });
    const parts = scoreBreakdown(content, state);
    expect(parts).toEqual({ wealth: 300, status: 50, multiplierPct: 182, total: 637 });
    expect(parts.total).toBe(finalScore(content, state));
    expect(parts.total).toBe(Math.floor(((parts.wealth + parts.status) * parts.multiplierPct) / 100));
  });

  it('has no bonus for someone who is not out of the rat race', () => {
    expect(scoreBreakdown(content, game(1_000_000))).toEqual({ wealth: 100, status: 2, multiplierPct: 100, total: 102 });
  });
});

describe('an escape has to last', () => {
  /** A life whose passive income covers it, or does not, as the caller says each round. */
  const play = (covering: boolean[]) => {
    let state = game(0, 'escape');
    const seen: Array<{ escapedAt: number | null; events: string[] }> = [];
    for (const covers of covering) {
      state = withPlayer(content, state, {}, { recurring: covers ? passive(9_000_000) : [] });
      const result = applyRound(content, state, { orders: [] });
      state = result.state;
      seen.push({ escapedAt: state.player.escapedAtRound, events: kinds(result.events).filter((k) => k === 'escaped' || k === 'escapeLost') });
    }
    return seen;
  };

  it('is won by two covering rounds in a row and lost by the first round that does not cover', () => {
    expect(play([true, true, true, false, true, true])).toEqual([
      { escapedAt: null, events: [] },
      { escapedAt: 1, events: ['escaped'] },
      { escapedAt: 1, events: [] },
      { escapedAt: null, events: ['escapeLost'] },
      { escapedAt: null, events: [] },
      { escapedAt: 5, events: ['escaped'] },
    ]);
  });

  it('gives no bonus to an escape that did not last to the end', () => {
    let state = game(0, 'escape');
    for (let round = 0; round < 20; round++) {
      state = withPlayer(content, state, {}, { recurring: round < 10 ? passive(9_000_000) : [] });
      state = applyRound(content, state, { orders: [] }).state;
    }
    expect(state.player.escapedAtRound).toBeNull();
    expect(scoreBreakdown(content, state).multiplierPct).toBe(100);
  });
});

describe('the escape test and a home of one’s own', () => {
  it('counts the property tax on the home as a cost of living, not as a tax on passive income', () => {
    const owner = createGame({ content, start: { ...fixtureStart(), life: { ...office, properties: [{ typeId: 'flat', rented: false }] } } }, 'owner');
    const preview = previewRound(content, owner, { orders: [] });
    // No passive income at all. The flat is worth 25,000,000 and its tax is 0.3% a year.
    expect(preview.tax.property).toBe(150_000);
    expect(preview.escape).toEqual({ passiveAfterTax: 0, outgoings: preview.expenses.living + 150_000, savingsUncounted: 0 });
    expect(escapeProgress(content, owner)).toEqual(preview.escape);
  });
});
