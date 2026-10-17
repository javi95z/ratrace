import { applyCard, applyRoomEvents, applyRound, createGame } from './game';
import type { Content, GameEvent, GameState, Order, RoomEvent, StartConfig } from './types';

/**
 * What a player chose in one round: the choice made on each card, in the order of the hand, and
 * the orders of the round. `orders` is null for a round whose cards are being answered and which
 * has not been played yet; only the last round of a log may be like that.
 */
export interface LoggedRound {
  picks: number[];
  orders: Order[] | null;
  /** What the other players of a game with friends did to this life in this round, written by the server as it turned. Never in a life alone. */
  room?: RoomEvent[];
}

/**
 * Plays a round and then what the others of a game with friends did to the life in it, as one step:
 * the events of both, in that order. Without `room`, exactly `applyRound`.
 */
export function applyRoundWith(content: Content, state: GameState, orders: Order[], room?: readonly unknown[]): { state: GameState; events: GameEvent[] } {
  const round = applyRound(content, state, { orders });
  if (room === undefined) return round;
  if (!Array.isArray(room)) throw new Error('the room events of a round are not a list');
  const after = applyRoomEvents(content, round.state, room);
  return { state: after.state, events: [...round.events, ...after.events] };
}

/** One step of a game being played again: the game before it, what it did, and the orders if it was a round. */
export type ReplayStep = (before: GameState, result: { state: GameState; events: GameEvent[] }, orders: Order[] | null) => void;

/**
 * Plays a game again from its seed and the log of what the player chose. The engine is
 * deterministic, so this gives back exactly the game that was played: on the device that played
 * it, on another device, or on a server that wants to see for itself.
 * It throws on a log that cannot have been played. `onStep` hears of every card and every round.
 */
export function replayLog(content: Content, start: StartConfig, seed: string, log: readonly LoggedRound[], onStep?: ReplayStep): GameState {
  if (log.length > content.rounds) throw new Error('the log is longer than a life');
  let state = createGame({ content, start }, seed);
  const take = (result: { state: GameState; events: GameEvent[] }, orders: Order[] | null) => {
    onStep?.(state, result, orders);
    state = result.state;
  };

  log.forEach((entry, i) => {
    for (const pick of entry.picks) {
      if (state.phase !== 'cards') throw new Error('the log answers more cards than the round had');
      take(applyCard(content, state, pick), null);
    }
    if (entry.orders === null) {
      if (i < log.length - 1) throw new Error('the log goes on after a round that was never played');
      if (entry.room !== undefined) throw new Error('the log has a room event in a round that was never played');
      return;
    }
    take(applyRoundWith(content, state, entry.orders, entry.room), entry.orders);
  });
  return state;
}
