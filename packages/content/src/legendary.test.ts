import type { CardOption, Effects } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { content } from './content';
import { legendaryCards } from './cards/legendary';

/** What an option is worth, plainly: the money it pays on average and at worst, the status it gives on average, and what it pays every year. */
function worth(option: CardOption) {
  const fixed: Effects = option.effects ?? {};
  const outcomes = option.outcomes ?? [{ weight: 1, effects: {} }];
  const total = outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
  const cash = (effects: Effects) => effects.cash ?? 0;
  const status = (effects: Effects) => effects.status ?? 0;
  return {
    cash: cash(fixed) + outcomes.reduce((sum, outcome) => sum + (cash(outcome.effects) * outcome.weight) / total, 0),
    worst: cash(fixed) + Math.min(...outcomes.map((outcome) => cash(outcome.effects))),
    status: status(fixed) + outcomes.reduce((sum, outcome) => sum + (status(outcome.effects) * outcome.weight) / total, 0),
    yearly: (fixed.recurring ?? []).reduce((sum, entry) => sum + (entry.kind === 'passive' ? entry.annual : -entry.annual), 0),
    skills: Object.values(fixed.skills ?? {}).reduce((sum, level) => sum + level, 0) - (fixed.focus ?? 0),
  };
}

describe('the legendary cards', () => {
  it('are six, in the content, legendary, once a life and kept from the ordinary draw', () => {
    expect(legendaryCards.map((card) => card.id)).toEqual(['legend_coat_ticket', 'legend_stranger_will', 'legend_airdrop', 'legend_viral', 'legend_star_neighbour', 'legend_attic_painting']);
    for (const card of legendaryCards) {
      expect(content.cards).toContain(card);
      expect(card).toMatchObject({ legendary: true, once: true });
    }
    // Nothing else in the game is legendary, and their chance is about one life in fifty over the rounds they are open in (from round 2).
    expect(content.cards.filter((card) => card.legendary).length).toBe(6);
    const rounds = content.rounds - 2;
    const lives = 1 - (1 - (content.life.legendaryBp ?? 0) / 10_000) ** rounds;
    expect(lives).toBeGreaterThan(0.015);
    expect(lives).toBeLessThan(0.025);
  });

  it('pay far more than a card of the everyday', () => {
    for (const card of legendaryCards) {
      const best = Math.max(...card.options.map((option) => worth(option).cash));
      expect(best, card.id).toBeGreaterThanOrEqual(60_000 * 100);
    }
  });

  it('leave no option better than another in every way: money on average and at worst, status, a yearly income and skills', () => {
    for (const card of legendaryCards) {
      const all = card.options.map(worth);
      all.forEach((one, i) =>
        all.forEach((other, j) => {
          if (i === j) return;
          const keys = ['cash', 'worst', 'status', 'yearly', 'skills'] as const;
          const dominates = keys.every((key) => other[key] >= one[key]) && keys.some((key) => other[key] > one[key]);
          expect(dominates, `${card.id}: option ${j} beats option ${i} in every way`).toBe(false);
        }),
      );
    }
  });

  it('give a gamble about the sure money it stands against: a little more on average, for the risk, never twice as much', () => {
    for (const card of legendaryCards) {
      const all = card.options.map(worth);
      const sure = all.filter((one) => one.cash === one.worst && one.cash > 0 && one.status >= 0);
      const gambles = all.filter((one) => one.cash !== one.worst);
      for (const gamble of gambles)
        for (const one of sure) {
          expect(gamble.cash, card.id).toBeGreaterThanOrEqual(one.cash * 0.95);
          expect(gamble.cash, card.id).toBeLessThan(one.cash * 1.3);
        }
    }
  });
});
