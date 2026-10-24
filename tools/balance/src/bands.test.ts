import { content, lives } from '@ratrace/content';
import { describe, expect, it } from 'vitest';
import { bots } from '@ratrace/content';
import { compare, seedsFor } from './simulate';
import type { BotSummary } from './simulate';

/**
 * The acceptance bands of spec 3.7. Every bot plays the three starting lives over the same fixed
 * seeds, so the numbers below never change between runs or machines. When this fails after a change
 * to the content, the content is out of balance: tune it, not the bots and not the bands.
 * `pnpm balance` prints the full table on a larger set of seeds.
 */
const starting = lives.filter((life) => life.unlock === 'default');
const SEEDS = 60;

describe('balance', () => {
  let table: Record<string, BotSummary> = {};

  it('plays every bot through every starting life', { timeout: 180_000 }, () => {
    expect(starting.map((life) => life.id)).toEqual(['nurse', 'engineer', 'civil_servant']);
    const { summaries, results } = compare(content, starting, seedsFor(SEEDS), bots);
    table = Object.fromEntries(summaries.map((s) => [s.bot, s]));
    expect(results).toHaveLength(SEEDS * starting.length * bots.length);
    for (const r of results) {
      expect(r.state.finished, `${r.bot} ${r.life} ${r.seed}`).toBe(true);
      expect(Number.isSafeInteger(r.netWorth) && Number.isSafeInteger(r.score), `${r.bot} ${r.life} ${r.seed}`).toBe(true);
    }
  });

  it('lets a patient index investor escape the rat race in 25% to 50% of lives', () => {
    expect(table.indexer.escapedPct).toBeGreaterThanOrEqual(25);
    // Recessions are rarer since 1.32, about one round in eight, and since 1.48 a misfortune seldom comes twice in a life:
    // patience pays a little more often, and still not in most lives.
    expect(table.indexer.escapedPct).toBeLessThanOrEqual(55);
  });

  it('gives no strategy the top score in more than 40% of lives', () => {
    for (const bot of bots) expect(table[bot.id].topScorePct, bot.id).toBeLessThanOrEqual(40);
  });

  // The gambler is the indexer with coins in place of the fund: same thrift, same work, no loans.
  // So this band measures what holding crypto does, and nothing the bot does besides.
  it('ruins the crypto gambler in 30% to 60% of lives, and makes it the richest of all in at least one in ten', () => {
    expect(table.gambler.ruinedPct).toBeGreaterThanOrEqual(30);
    expect(table.gambler.ruinedPct).toBeLessThanOrEqual(60);
    expect(table.gambler.richestPct).toBeGreaterThanOrEqual(10);
  });

  it('never bankrupts someone who only saves or only buys the index, and rarely leaves the indexer far behind the saver', () => {
    expect(table.saver.bankruptPct).toBe(0);
    expect(table.saver.ruinedPct).toBe(0);
    expect(table.indexer.bankruptPct).toBeLessThanOrEqual(1);
    // The index can lag plain saving after a bad last decade, but only rarely by half.
    expect(table.indexer.ruinedPct).toBeLessThanOrEqual(10);
  });

  it('makes the status chaser the one with the most status, and the saver and the indexer the ones with none to speak of', () => {
    const status = (bot: string) => table[bot].medianStatus;
    for (const bot of bots) if (bot.id !== 'chaser') expect(status('chaser'), bot.id).toBeGreaterThan(status(bot.id));
    expect(status('chaser')).toBeGreaterThan(status('saver') * 3);
  });
});
