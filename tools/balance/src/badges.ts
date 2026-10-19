import { recordStart, recordStep } from '@ratrace/content';
import type { LifeRecord } from '@ratrace/content';
import { applyCard, applyRound, createGame, viewOf } from '@ratrace/engine';
import type { Content, StartConfig } from '@ratrace/engine';
import type { Bot } from '@ratrace/content';

/**
 * How often each badge is earned: the share of lives, in percent to one decimal, in which every bot
 * plays every given life over the given seeds. Badges about what was owned across lives are not
 * judged within one life, and are not counted here.
 */
export function badgeShares(content: Content, lives: ReadonlyArray<{ id: string; start: StartConfig }>, seeds: readonly string[], bots: readonly Bot[]): Record<string, number> {
  const earned = new Map<string, number>();
  let played = 0;
  for (const life of lives) {
    for (const bot of bots) {
      for (const seed of seeds) {
        let state = createGame({ content, start: life.start }, seed);
        let record: LifeRecord = recordStart(content, state);
        while (!state.finished) {
          while (state.phase === 'cards') {
            const next = applyCard(content, state, bot.pick(content, viewOf(state)));
            record = recordStep(content, record, state, next.state, next.events, []).record;
            state = next.state;
          }
          const orders = bot.orders(content, viewOf(state));
          const next = applyRound(content, state, { orders });
          record = recordStep(content, record, state, next.state, next.events, orders).record;
          state = next.state;
        }
        for (const id of record.journal.earned) earned.set(id, (earned.get(id) ?? 0) + 1);
        played += 1;
      }
    }
  }
  return Object.fromEntries([...earned].map(([id, count]) => [id, Math.round((count * 1_000) / played) / 10]));
}
