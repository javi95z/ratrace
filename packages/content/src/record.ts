import { realNetWorth, replayLog, viewOf } from '@ratrace/engine';
import type { Content, GameEvent, GameState, LoggedRound, Order, StartConfig } from '@ratrace/engine';
import { badgesEarned, journalAfter, journalStart } from './badges';
import type { Journal } from './badges';

/**
 * What is kept about a life besides the game itself. All of it follows from the seed and the
 * log, so playing a saved game again rebuilds it exactly: on the device that played it, on
 * another device, or on a server that writes the finished life down.
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
 * in this life. `orders` are the orders of a round, none for a card. The session and the replay of
 * a save both keep their record with this, so the two cannot drift.
 */
export function recordStep(content: Content, record: LifeRecord, before: GameState, after: GameState, events: GameEvent[], orders: readonly Order[]): { record: LifeRecord; earned: string[] } {
  const seen = journalAfter(content, record.journal, viewOf(after), events);
  const earned = badgesEarned({ content, before: viewOf(before), after: viewOf(after), events, orders, journal: seen });
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

/** A life played again from its seed: where it stands, and the record of how it got there. */
export interface Replayed extends LifeRecord {
  state: GameState;
}

/**
 * Plays a life again from its seed and the log of what the player chose, keeping its record
 * alongside. The engine is deterministic, so this gives back exactly the life that was lived.
 * It throws on a log that cannot have been played.
 */
export function replayLife(content: Content, start: StartConfig, seed: string, log: readonly LoggedRound[]): Replayed {
  let record: LifeRecord | null = null;
  const state = replayLog(content, start, seed, log, (before, result, orders) => {
    record = recordStep(content, record ?? recordStart(content, before), before, result.state, result.events, orders ?? []).record;
  });
  // A life not begun has taken no step: its record is the one it starts with.
  return { state, ...((record as LifeRecord | null) ?? recordStart(content, state)) };
}
