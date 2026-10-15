import { describe, expect, it } from 'vitest';
import { applyRound, createGame } from '../game';
import { findInvariantBreaks } from '../invariants';
import { quoteWork } from '../quotes';
import { fixtureContent, fixtureStart } from '../testing/fixture';
import type { CareerDef, Content, GameState, LifeStart } from '../types';
import { validateContent } from '../validate';
import { viewOf } from '../view';
import { careerSwing, ownPay } from './derive';

const office: LifeStart = { lifeId: 'tester', career: { id: 'office', level: 0 }, careerSkill: 0, financeSkill: 0, focus: 3 };

/** The fixture, with its one career given a trait or two. */
function contentWith(traits: Partial<CareerDef>): Content {
  const content = fixtureContent();
  content.careers = content.careers.map((career) => ({ ...career, ...traits }));
  return content;
}
const game = (content: Content, seed = 'careers'): GameState => createGame({ content, start: { ...fixtureStart(), cash: 5_000_000, life: office } }, seed);
/** The pay a rung gives with no raise, cut or swing on it. */
const plain = (content: Content, state: GameState) => {
  const p = structuredClone(state.player);
  p.life.salaryBoostPct = 0;
  return ownPay(p, content);
};
const play = (content: Content, state: GameState, rounds: number) => {
  let s = state;
  for (let i = 0; i < rounds; i++) s = applyRound(content, s, { orders: [] }).state;
  return s;
};

describe('a career that follows the economy', () => {
  const content = contentWith({ cyclePct: { boom: 25, expansion: 10, slowdown: -10, recession: -25 } });

  it('is paid each round as the round finds the economy, from the first', () => {
    const seen = new Set<string>();
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      let state = game(content, seed);
      for (let round = 0; round < 10 && !state.finished; round++) {
        const regime = state.timeline[state.round].regime;
        const swing = content.careers[0].cyclePct?.[regime] ?? 0;
        seen.add(regime);
        expect(state.player.life.salaryBoostPct, `${seed} ${round} ${regime}`).toBe(swing);
        expect(ownPay(state.player, content)).toBe(Math.floor((plain(content, state) * (100 + swing)) / 100));
        expect(quoteWork(content, viewOf(state)).traits).toMatchObject({ cyclePct: swing, follows: true, fadePct: 0, fade: null, focus: 0 });
        expect(findInvariantBreaks(content, state)).toEqual([]);
        state = applyRound(content, state, { orders: [] }).state;
      }
    }
    // The lives played have met good times and bad.
    expect(seen.size).toBeGreaterThan(2);
  });

  it('adds to overtime instead of replacing it, and leaves an ordinary career alone', () => {
    const state = game(content);
    const swing = state.player.life.salaryBoostPct;
    const worked = structuredClone(state);
    const boosted = applyRound(content, worked, { orders: [{ type: 'focus', action: 'overtime' }] });
    const salary = boosted.events.find((e) => e.kind === 'ledger' && e.line === 'salary');
    const base = applyRound(content, state, { orders: [] }).events.find((e) => e.kind === 'ledger' && e.line === 'salary');
    if (!salary || salary.kind !== 'ledger' || !base || base.kind !== 'ledger') throw new Error('a round pays a salary');
    expect(salary.amount * (100 + swing)).toBeCloseTo(base.amount * (100 + swing + 15), -3);
    const ordinary = fixtureContent();
    expect(game(ordinary).player.life.salaryBoostPct).toBe(0);
    expect(quoteWork(ordinary, viewOf(game(ordinary))).traits).toEqual({ cyclePct: 0, follows: false, fadePct: 0, fade: null, focus: 0 });
  });
});

describe('a career for the young', () => {
  const content = contentWith({ fade: { fromRound: 2, pctPerRound: 10, maxPct: 25 } });

  it('pays in full until its round, then less each round, and never less than its floor', () => {
    const boosts: number[] = [];
    let state = game(content);
    for (let round = 0; round < 6; round++) {
      boosts.push(state.player.life.salaryBoostPct);
      expect(quoteWork(content, viewOf(state)).traits).toMatchObject({ fadePct: state.player.life.salaryBoostPct, fade: { fromRound: 2, pctPerRound: 10, maxPct: 25 } });
      state = applyRound(content, state, { orders: [] }).state;
    }
    expect(boosts).toEqual([0, 0, -10, -20, -25, -25]);
  });

  it('is nothing to someone who has left it', () => {
    const state = play(content, game(content), 3);
    const p = structuredClone(state.player);
    p.life.career = null;
    expect(careerSwing(p, content, 'boom', 5)).toEqual({ cyclePct: 0, fadePct: 0 });
  });
});

describe('a career that leaves time over', () => {
  const content = contentWith({ focus: 1 });

  it('gives its focus from the first round and in every round after', () => {
    let state = game(content);
    for (let round = 0; round < 3; round++) {
      expect(quoteWork(content, viewOf(state)).focus).toEqual({ left: 4, total: 4, bonus: 1, lost: 0 });
      expect(quoteWork(content, viewOf(state)).traits.focus).toBe(1);
      const spent = applyRound(content, state, { orders: [{ type: 'focus', action: 'overtime' }, { type: 'focus', action: 'studyCareer' }, { type: 'focus', action: 'jobHunt' }, { type: 'moveCity', cityId: round % 2 === 0 ? 'haven' : 'home' }] });
      expect(spent.events.filter((e) => e.kind === 'orderRejected')).toEqual([]);
      state = spent.state;
    }
  });
});

describe('the traits of a career, checked', () => {
  it('refuses a swing for a state of the economy that does not exist, a fade past everything, and a focus that is not whole', () => {
    expect(validateContent(contentWith({ cyclePct: { boom: 20 }, fade: { fromRound: 6, pctPerRound: 12, maxPct: 70 }, focus: 1 }))).toEqual([]);
    expect(validateContent(contentWith({ cyclePct: { mania: 20 } as never }))).toContain('career office has a swing that is not a whole percentage for a known state of the economy');
    expect(validateContent(contentWith({ cyclePct: { boom: 2.5 } }))).toContain('career office has a swing that is not a whole percentage for a known state of the economy');
    expect(validateContent(contentWith({ fade: { fromRound: 6, pctPerRound: 12, maxPct: 120 } }))).toContain('career office needs a fade of whole rounds and percentages, at most 100 in all');
    expect(validateContent(contentWith({ focus: 0.5 }))).toContain('career office needs a whole, non-negative focus');
  });
});
