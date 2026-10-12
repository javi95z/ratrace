import type { GameState, GameView } from './types';

/**
 * What a client is allowed to hold of a game: everything the player can see, and nothing they cannot.
 *
 * The seed is left out because every future price follows from it. The saved random stream is left
 * out because every future dice roll follows from it. The timeline stops at the current round.
 * In ranked online play the server keeps the game and sends only this; in local play the device
 * holds the game anyway, and the interface still reads it through a view, so no screen ever depends
 * on something a ranked client would not have.
 *
 * The view is a copy: changing it changes nothing in the game.
 */
export function viewOf(state: GameState): GameView {
  return structuredClone({
    round: state.round,
    timeline: state.timeline.slice(0, state.round + 1),
    player: state.player,
    finished: state.finished,
    phase: state.phase,
    hand: state.hand,
  });
}
