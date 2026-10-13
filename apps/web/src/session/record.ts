import { badgesEarned, journalAfter, journalStart } from '@ratrace/content';
import type { Journal } from '@ratrace/content';
import { realNetWorth, viewOf } from '@ratrace/engine';
import type { Content, GameEvent, GameState } from '@ratrace/engine';

/**
 * What a session keeps about a life besides the game itself. All of it follows from the seed
 * and the log, so playing a saved game again rebuilds it exactly.
 */
export interface LifeRecord {
  /** Net worth in start-of-game cents at the start and after every round played, for the graph. */
  history: number[];
  bankruptcies: number;
  journal: Journal;
}

export function recordStart(content: Content, state: GameState): LifeRecord {
  return { history: [realNetWorth(state)], bankruptcies: 0, journal: journalStart(content, viewOf(state)) };
}

/**
 * The record after one step, the answer to a card or a round, and the badges that step earned
 * in this life. The session and the replay of a save both keep their record with this, so the two cannot drift.
 */
export function recordStep(content: Content, record: LifeRecord, before: GameState, after: GameState, events: GameEvent[]): { record: LifeRecord; earned: string[] } {
  const seen = journalAfter(content, record.journal, viewOf(after), events);
  const earned = badgesEarned({ content, before: viewOf(before), after: viewOf(after), events, journal: seen });
  let bankruptcies = record.bankruptcies;
  for (const event of events) if (event.kind === 'bankrupt') bankruptcies += 1;
  return {
    earned,
    record: {
      history: after.round > before.round ? [...record.history, realNetWorth(after)] : record.history,
      bankruptcies,
      journal: { ...seen, earned: [...seen.earned, ...earned] },
    },
  };
}
