import { describe, expect, it } from 'vitest';
import { nextTip, TIPS } from './guide';
import type { GuideFacts } from './guide';

const facts = (over: Partial<GuideFacts> = {}): GuideFacts => ({ stage: 'news', round: 0, seen: [], off: false, livesFinished: 0, hasInvested: false, ...over });

describe('the guide of a first life', () => {
  it('has one tip for each stage of a round, and a few that wait for their moment', () => {
    expect(TIPS.map((tip) => tip.id)).toEqual(['news', 'cards', 'finance', 'ledger', 'ratRace', 'invest', 'focus', 'flow', 'debt', 'rivals', 'property', 'business', 'move', 'workMode', 'taxes']);
    expect(new Set(TIPS.map((tip) => tip.id)).size).toBe(TIPS.length);
  });

  it('explains each stage the first time it is reached', () => {
    expect(nextTip(facts({ stage: 'news' }))).toBe('news');
    expect(nextTip(facts({ stage: 'cards' }))).toBe('cards');
    expect(nextTip(facts({ stage: 'finance' }))).toBe('finance');
    expect(nextTip(facts({ stage: 'resolve' }))).toBe('ledger');
    expect(nextTip(facts({ stage: 'outcome' }))).toBeNull();
    expect(nextTip(facts({ stage: 'end' }))).toBeNull();
  });

  it('never shows a tip twice', () => {
    expect(nextTip(facts({ stage: 'news', seen: ['news'] }))).toBeNull();
    expect(nextTip(facts({ stage: 'cards', seen: ['news', 'cards'] }))).toBeNull();
  });

  it('keeps the later tips for later rounds, one at a time', () => {
    // The second round: what the bar at the top is for.
    expect(nextTip(facts({ stage: 'news', round: 1, seen: ['news'] }))).toBe('ratRace');
    expect(nextTip(facts({ stage: 'news', round: 0, seen: ['news'] }))).toBeNull();
    // The finances of the second round: put the money to work, if it has not been already.
    expect(nextTip(facts({ stage: 'finance', round: 1, seen: ['finance'] }))).toBe('invest');
    expect(nextTip(facts({ stage: 'finance', round: 1, seen: ['finance'], hasInvested: true }))).toBe('focus');
    expect(nextTip(facts({ stage: 'finance', round: 2, seen: ['finance', 'invest'] }))).toBe('focus');
    expect(nextTip(facts({ stage: 'finance', round: 3, seen: ['finance', 'invest', 'focus'] }))).toBe('flow');
    expect(nextTip(facts({ stage: 'finance', round: 3, seen: ['finance', 'invest', 'focus', 'flow'] }))).toBe('debt');
    expect(nextTip(facts({ stage: 'finance', round: 3, seen: ['finance', 'invest', 'focus', 'flow', 'debt', 'property'] }))).toBeNull();
    // A stage's own tip always comes before the ones that wait.
    expect(nextTip(facts({ stage: 'finance', round: 5 }))).toBe('finance');
  });

  it('is only for a first life, and stops for good when turned off', () => {
    expect(nextTip(facts({ livesFinished: 1 }))).toBeNull();
    expect(nextTip(facts({ off: true }))).toBeNull();
    expect(nextTip(facts({ stage: 'finance', off: true, round: 4 }))).toBeNull();
  });
});

describe('the notes of a first time', () => {
  const none = { crisis: false, creditCard: false, mortgage: false, margin: false, halfway: false };
  const veteran = (over: Partial<GuideFacts> = {}) => facts({ livesFinished: 3, ...over });

  it('come in any life, once each, on the stage where they matter', () => {
    expect(nextTip(veteran({ stage: 'news', firsts: { ...none, crisis: true } }))).toBe('firstCrisis');
    expect(nextTip(veteran({ stage: 'finance', firsts: { ...none, crisis: true } }))).toBeNull();
    expect(nextTip(veteran({ stage: 'finance', firsts: { ...none, creditCard: true, mortgage: true } }))).toBe('firstCard');
    expect(nextTip(veteran({ stage: 'finance', seen: ['firstCard'], firsts: { ...none, creditCard: true, mortgage: true } }))).toBe('firstMortgage');
    expect(nextTip(veteran({ stage: 'finance', firsts: none }))).toBeNull();
  });

  it('wait for the tips of a first life, and are silenced with them', () => {
    expect(nextTip(facts({ stage: 'news', firsts: { ...none, crisis: true } }))).toBe('news');
    expect(nextTip(facts({ stage: 'news', seen: ['news'], firsts: { ...none, crisis: true } }))).toBe('firstCrisis');
    expect(nextTip(veteran({ off: true, stage: 'news', firsts: { ...none, crisis: true } }))).toBeNull();
  });
});
