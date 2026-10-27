import { bots, cardPeople, content, lives } from '@ratrace/content';
import type { Bot } from '@ratrace/content';
import { previewCard } from '@ratrace/engine';
import { expect, it } from 'vitest';
import { peopleReport } from './people';
import { seedsFor } from './simulate';

/**
 * The people who come back are met, and their stories go on. Every bot plays the three lives of Madrid: a life meets two or three of
 * the people (the parents always), and none of them is a rarity or met by all. The bots seldom say yes to a person, so the stories'
 * later cards are measured on a player who does: one who takes the second choice of a person's card wherever it is open, and plays as
 * the saver otherwise. Each later card comes in most of the lives that reach what it waits for.
 */
const starting = lives.filter((life) => ['nurse', 'engineer', 'civil_servant'].includes(life.id));

it('meets two or three people in a life, the parents always, and each of the others in a fair share of lives', { timeout: 300_000 }, () => {
  const report = peopleReport(content, starting, seedsFor(15), bots);
  expect(report.perLife.mean).toBeGreaterThanOrEqual(2.3);
  expect(report.perLife.mean).toBeLessThanOrEqual(3.3);
  expect(report.met.parents).toBeGreaterThanOrEqual(95);
  for (const who of ['inlaw', 'boss', 'landlord', 'founder', 'advisor'] as const) {
    expect(report.met[who], who).toBeGreaterThanOrEqual(15);
    expect(report.met[who], who).toBeLessThanOrEqual(60);
  }
});

it('carries each story on to its later cards, for a player who says yes', { timeout: 300_000 }, () => {
  const saver = bots.find((bot) => bot.id === 'saver')!;
  const willing: Bot = {
    id: 'willing',
    orders: saver.orders,
    pick: (rules, view) => {
      const id = view.hand[view.answered];
      if (!Object.hasOwn(cardPeople, id)) return saver.pick(rules, view);
      return previewCard(rules, view, id)[1]?.available ? 1 : 0;
    },
  };
  const report = peopleReport(content, starting, seedsFor(20), [willing]);
  for (const [id, { could, reachedPct }] of Object.entries(report.followUps)) {
    if (could < 5) continue;
    expect(reachedPct, `${id} (${could} lives could)`).toBeGreaterThanOrEqual(50);
  }
  // The stories that open with money in are walked to their end by this player.
  for (const id of ['inlaw_moon', 'inlaw_rug', 'inlaw_loan', 'inlaw_repay', 'founder_more', 'founder_exit', 'boss_offer']) expect(report.followUps[id].could, id).toBeGreaterThanOrEqual(5);
});
