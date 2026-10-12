import { applyCard, applyRound, createGame, finalScore, livedStatus, realNetWorth, viewOf } from '@ratrace/engine';
import type { Content, GameState, StartConfig } from '@ratrace/engine';
import type { Bot } from './bots';

export interface LifeResult {
  bot: string;
  life: string;
  seed: string;
  score: number;
  /** Net worth at the end, in start-of-game cents. */
  netWorth: number;
  /** Status averaged over the life, which is what the score counts. */
  status: number;
  escapedAtRound: number | null;
  bankruptcies: number;
  state: GameState;
}

/** Plays one whole life with a bot. */
export function playLife(content: Content, life: { id: string; start: StartConfig }, seed: string, bot: Bot): LifeResult {
  let state = createGame({ content, start: life.start }, seed);
  let bankruptcies = 0;
  while (!state.finished) {
    // The bot is handed a view, never the game: what it cannot see it cannot use.
    while (state.phase === 'cards') state = applyCard(content, state, bot.pick(content, viewOf(state))).state;
    const result = applyRound(content, state, { orders: bot.orders(content, viewOf(state)) });
    for (const event of result.events) if (event.kind === 'bankrupt') bankruptcies += 1;
    state = result.state;
  }
  return {
    bot: bot.id,
    life: life.id,
    seed,
    score: finalScore(content, state),
    netWorth: realNetWorth(state),
    status: livedStatus(state),
    escapedAtRound: state.player.escapedAtRound,
    bankruptcies,
    state,
  };
}

export interface BotSummary {
  bot: string;
  lives: number;
  /** Share of lives, in percent. */
  escapedPct: number;
  bankruptPct: number;
  /** Share of lives in which this bot had the top score. A tie is split between the bots that share it. */
  topScorePct: number;
  /** Share of lives in which this bot ended richer than every other bot. */
  richestPct: number;
  /** Share of lives in which this bot ended with less than half of what the saver had on the same life and seed. */
  ruinedPct: number;
  medianScore: number;
  medianNetWorth: number;
  medianStatus: number;
  /** Median age at escape, for the lives that escaped, or null. */
  medianEscapeAge: number | null;
}

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part * 1000) / whole) / 10);

/**
 * Plays every bot through the same lives and seeds and sums up how each one did.
 * Results come back in the order of `bots`.
 */
export function compare(
  content: Content,
  lives: ReadonlyArray<{ id: string; start: StartConfig }>,
  seeds: readonly string[],
  bots: readonly Bot[],
): { summaries: BotSummary[]; results: LifeResult[] } {
  const results: LifeResult[] = [];
  const zero = () => new Map<string, number>(bots.map((bot) => [bot.id, 0]));
  const wins = zero();
  const richest = zero();
  const ruined = zero();
  const add = (tally: Map<string, number>, bot: string, amount: number) => tally.set(bot, (tally.get(bot) ?? 0) + amount);

  for (const life of lives) {
    for (const seed of seeds) {
      const round = bots.map((bot) => playLife(content, life, seed, bot));
      results.push(...round);
      const top = Math.max(...round.map((r) => r.score));
      const winners = round.filter((r) => r.score === top);
      for (const winner of winners) add(wins, winner.bot, 1 / winners.length);

      const most = Math.max(...round.map((r) => r.netWorth));
      const wealthiest = round.filter((r) => r.netWorth === most);
      if (wealthiest.length === 1) add(richest, wealthiest[0].bot, 1);
      const saved = round.find((r) => r.bot === 'saver');
      if (saved) {
        for (const r of round) if (r.netWorth * 2 < saved.netWorth) add(ruined, r.bot, 1);
      }
    }
  }

  const games = lives.length * seeds.length;
  const summaries = bots.map((bot): BotSummary => {
    const mine = results.filter((r) => r.bot === bot.id);
    const escaped = mine.filter((r) => r.escapedAtRound !== null);
    return {
      bot: bot.id,
      lives: mine.length,
      escapedPct: pct(escaped.length, mine.length),
      bankruptPct: pct(mine.filter((r) => r.bankruptcies > 0).length, mine.length),
      topScorePct: pct(wins.get(bot.id) ?? 0, games),
      richestPct: pct(richest.get(bot.id) ?? 0, games),
      ruinedPct: pct(ruined.get(bot.id) ?? 0, games),
      medianScore: median(mine.map((r) => r.score)),
      medianNetWorth: median(mine.map((r) => r.netWorth)),
      medianStatus: median(mine.map((r) => r.status)),
      medianEscapeAge: escaped.length === 0 ? null : 22 + 2 * median(escaped.map((r) => r.escapedAtRound ?? 0)),
    };
  });
  return { summaries, results };
}

/** Seeds that never change, so a run gives the same table every time. */
export const seedsFor = (count: number): string[] => Array.from({ length: count }, (_, i) => `balance-${i + 1}`);
