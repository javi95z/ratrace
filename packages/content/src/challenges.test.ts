import { createGame, optionBreaks, validateStart } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { assetKind } from './kinds';
import { CHALLENGE_DEBT, CHALLENGE_RULES, challengeLimits, challengeOf, challengeStart, weekOf, weekStart } from './challenges';
import { content } from './content';
import { lives } from './lives';

describe('the weeks of the challenges', () => {
  it('are ISO weeks in UTC, Monday to Sunday, the year being that of the Thursday', () => {
    expect(weekOf(Date.UTC(2026, 9, 14, 12))).toBe('2026-W42');
    // Sunday night is still the week that began on Monday; Monday at midnight is the next.
    expect(weekOf(Date.UTC(2026, 9, 18, 23, 59, 59))).toBe('2026-W42');
    expect(weekOf(Date.UTC(2026, 9, 19))).toBe('2026-W43');
    // The first days of January can belong to the last week of the year before, and the last of December to the next.
    expect(weekOf(Date.UTC(2021, 0, 3))).toBe('2020-W53');
    expect(weekOf(Date.UTC(2024, 11, 30))).toBe('2025-W01');
    expect(weekOf(Date.UTC(2026, 11, 31))).toBe('2026-W53');
  });

  it('begin on their Monday, and nothing that is not a week begins at all', () => {
    expect(weekStart('2026-W42')).toBe(Date.UTC(2026, 9, 12));
    expect(weekStart('2020-W53')).toBe(Date.UTC(2020, 11, 28));
    expect(weekStart('2025-W01')).toBe(Date.UTC(2024, 11, 30));
    for (const week of ['2021-W53', '2026-W00', '2026-W54', '2026-42', 'W42', '', '2026-W4']) expect(weekStart(week), week).toBeNull();
    for (let day = 0; day < 800; day += 3) {
      const ms = Date.UTC(2025, 0, 1) + day * 86_400_000;
      const start = weekStart(weekOf(ms));
      expect(start).not.toBeNull();
      expect(ms - (start ?? 0)).toBeGreaterThanOrEqual(0);
      expect(ms - (start ?? 0)).toBeLessThan(7 * 86_400_000);
    }
  });
});

describe('the challenge of a week', () => {
  const weeks = Array.from({ length: 140 }, (_, i) => weekOf(Date.UTC(2026, 0, 5) + i * 7 * 86_400_000));

  it('is the same for whoever asks, and none for what is not a week', () => {
    expect(challengeOf('2026-W42', lives)).toEqual(challengeOf('2026-W42', lives));
    expect(challengeOf('2026-W42', lives)?.week).toBe('2026-W42');
    expect(challengeOf('next week', lives)).toBeNull();
    expect(challengeOf('2026-W42', [])).toBeNull();
  });

  it('changes its life every week, and over the weeks brings every life and every rule', () => {
    const all = weeks.map((week) => challengeOf(week, lives)!);
    for (let i = 1; i < all.length; i++) expect(all[i].lifeId, all[i].week).not.toBe(all[i - 1].lifeId);
    expect(new Set(all.map((each) => each.lifeId))).toEqual(new Set(lives.map((life) => life.id)));
    expect(new Set(all.map((each) => each.rule))).toEqual(new Set(CHALLENGE_RULES));
    // Pairs come back only after many weeks, once the lives that came later have joined: every pair of the 24 lives and 10 rules
    // before any comes back, which one more turn of the rule each round of lives would not give (it brings a pair back in 48 weeks).
    const pairs = all.filter((each) => each.week >= '2026-W45').map((each) => `${each.lifeId}/${each.rule}`);
    expect(new Set(pairs.slice(0, 60)).size).toBe(60);
    const long = Array.from({ length: 240 }, (_, i) => challengeOf(weekOf(weekStart('2026-W45')! + i * 7 * 86_400_000), lives)!);
    expect(new Set(long.map((each) => `${each.lifeId}/${each.rule}`)).size).toBe(240);
  });

  it('keeps every week before a later life joins exactly as it was', () => {
    const first = lives.filter((life) => life.challengeFrom === undefined);
    for (const week of weeks.filter((each) => each < '2026-W43')) expect(challengeOf(week, lives), week).toEqual(challengeOf(week, first));
    // The lives of the four careers added last join two weeks later, and leave the two weeks between as they were.
    const second = lives.filter((life) => life.challengeFrom === undefined || life.challengeFrom === '2026-W43');
    for (const week of weeks.filter((each) => each < '2026-W45')) expect(challengeOf(week, lives), week).toEqual(challengeOf(week, second));
    expect(lives.filter((life) => life.challengeFrom === '2026-W43').map((life) => life.id)).toEqual(['robotics_engineer', 'programmer', 'chef', 'private_banker']);
    expect(lives.filter((life) => life.challengeFrom === '2026-W45').map((life) => life.id)).toEqual(['pilot', 'architect', 'estate_agent', 'recruit']);  });

  it('starts every life under every rule as a sound game', () => {
    for (const life of lives) {
      for (const rule of CHALLENGE_RULES) {
        const start = challengeStart({ week: '2026-W42', lifeId: life.id, rule }, life);
        expect(validateStart(content, start), `${life.id} ${rule}`).toEqual([]);
        const state = createGame({ content, start }, `challenge-${life.id}-${rule}`);
        expect(state.limits, `${life.id} ${rule}`).toEqual(challengeLimits(rule));
        // The life it is set on is not changed.
        expect(life.start.limits).toBeUndefined();
      }
    }
  });

  it('allows only index funds under the rule of index funds, and starts the rule of debt with a loan', () => {
    const only = challengeLimits('indexOnly').onlyAssets ?? [];
    expect(only.length).toBeGreaterThan(0);
    expect(only.every((id) => assetKind(content.assets.find((asset) => asset.id === id)!) === 'fund')).toBe(true);
    const nurse = lives.find((life) => life.id === 'nurse')!;
    const start = challengeStart({ week: '2026-W42', lifeId: 'nurse', rule: 'startInDebt' }, nurse);
    expect(start.debts).toEqual([...nurse.start.debts, expect.objectContaining({ kind: 'personalLoan', principal: CHALLENGE_DEBT })]);
    expect(start.limits).toBeUndefined();
  });

  it('never closes the first option of a card, which a player who cannot take another always gets', () => {
    for (const rule of CHALLENGE_RULES) {
      for (const card of content.cards) expect(optionBreaks(card.options[0], challengeLimits(rule)), `${card.id} ${rule}`).toBe(false);
    }
  });
});
