import { bots, cardPeople, content, lives } from '@ratrace/content';
import type { Bot } from '@ratrace/content';
import { previewCard } from '@ratrace/engine';
import { expect, it } from 'vitest';
import { slow } from './slow';
import { peopleReport } from './people';
import { seedsFor } from './simulate';

/**
 * The people who come back are met, and their stories go on. Every bot plays the three lives of Madrid: a life meets two or three of
 * the people (the parents always), and none of them is a rarity or met by all. The bots seldom say yes to a person, so the stories'
 * later cards are measured on a player who does: one who takes the second choice of a person's card wherever it is open, and plays as
 * the saver otherwise. Each later card comes in most of the lives that reach what it waits for.
 */
const starting = lives.filter((life) => ['nurse', 'engineer', 'civil_servant'].includes(life.id));

it('meets two or three people in a life, the parents always, and each of the others in a fair share of lives', { timeout: slow(300_000) }, () => {
  const report = peopleReport(content, starting, seedsFor(15), bots);
  expect(report.perLife.mean).toBeGreaterThanOrEqual(2.3);
  expect(report.perLife.mean).toBeLessThanOrEqual(3.3);
  expect(report.met.parents).toBeGreaterThanOrEqual(95);
  for (const who of ['inlaw', 'boss', 'landlord', 'founder', 'advisor'] as const) {
    expect(report.met[who], who).toBeGreaterThanOrEqual(15);
    expect(report.met[who], who).toBeLessThanOrEqual(60);
  }
});

it('carries each story on to its later cards, for a player who says yes', { timeout: slow(300_000) }, () => {
  const saver = bots.find((bot) => bot.id === 'saver')!;
  const willing: Bot = {
    id: 'willing',
    orders: saver.orders,
    pick: (rules, view) => {
      const id = view.hand[view.answered];
      if (!Object.hasOwn(cardPeople, id)) return saver.pick(rules, view);
      const options = previewCard(rules, view, id);
      // The loan asked of someone who stood by him is the same yes, signed for.
      if (id === 'inlaw_loan' && options[3]?.available) return 3;
      return options[1]?.available ? 1 : 0;
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

/**
 * Every ending of every story is one some life comes to, so a player's "n of m endings" can reach m: every life to begin with, played by
 * every bot, by a player who says yes (as the saver otherwise, again taking the founder's cheque, and again as the landlord, who has a mortgage), and by one who answers a
 * person's cards at random among what is open.
 */
it('ends each story every way it can be told, in some life', { timeout: slow(600_000) }, () => {
  const saver = bots.find((bot) => bot.id === 'saver')!;
  // The landlord, who buys homes on a mortgage: the adviser's insurance needs one.
  const landlord = bots.find((bot) => bot.id === 'landlord')!;
  const answering = (id: string, as: Bot, choose: (open: number[], view: Parameters<Bot['pick']>[1], card: string) => number): Bot => ({
    id,
    orders: as.orders,
    pick: (rules, view) => {
      const card = view.hand[view.answered];
      if (!Object.hasOwn(cardPeople, card)) return as.pick(rules, view);
      const open = previewCard(rules, view, card).flatMap((preview, i) => (preview.available ? [i] : []));
      return choose(open, view, card);
    },
  });
  /** Yes to everyone, and to the founder's news too: a cheque already in is held, to hear how it ends. */
  const yes = (open: number[], _view: unknown, card: string) => (card === 'founder_exit' ? 0 : open.includes(1) ? 1 : 0);
  const willing = answering('willing', saver, yes);
  // Yes to everyone, and out of the founder's company with the cheque when it is offered: the one way the founder's story ends "out".
  const seller = answering('seller', saver, (open, view, card) => (card === 'founder_exit' ? (open.includes(1) ? 1 : 0) : yes(open, view, card)));
  const owner = answering('owner', landlord, yes);
  // The life's own numbers decide, so the same lives are played every time.
  const curious = answering('curious', saver, (open, view) => open[(view.round * 7 + view.answered * 3 + Math.round(view.player.cash / 100)) % open.length]);
  const report = peopleReport(content, lives, seedsFor(3), [...bots, willing, seller, owner, curious]);
  expect(Object.entries(report.endings).filter(([, lived]) => lived === 0).map(([id]) => id)).toEqual([]);
});
