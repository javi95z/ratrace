import type { Milestone } from '@ratrace/content';
import type { GameEvent, GameView } from '@ratrace/engine';
import type { RoundState } from './store';

/**
 * A moment that stops the game: something big enough to have the screen to itself until the
 * player has taken it in. `key` tells one from every other of the life, so it is shown once.
 */
export type Moment =
  | { key: string; kind: 'bankrupt'; proceeds: number; debtsCleared: number }
  /** `round`: the round the life got out in (the `escaped` event's), whose age the moment tells. */
  | { key: string; kind: 'escape'; round: number }
  | { key: string; kind: 'million' }
  | { key: string; kind: 'crisis'; crisisId: string; rounds: number };

/** What of the round on screen the moments are read from. */
export type Seen = Pick<RoundState, 'stage' | 'view' | 'resolved' | 'story'>;

/** The first million, in start-of-game cents. */
const MILLION = 100_000_000;

const firstMillion = (story: readonly Milestone[], view: GameView): boolean =>
  story.some((m) => m.kind === 'worth' && m.mark === MILLION && m.round === view.round);

/**
 * The moments due on the screen as it stands, the gravest first. They belong to two places only:
 * the opening of a round, where a crisis begins, and its result, where a life is made or broken.
 */
export function momentsOf({ stage, view, resolved, story }: Seen): Moment[] {
  if (!view) return [];
  const at = view.round;
  const moments: Moment[] = [];

  if (stage === 'resolve' && resolved) {
    for (const event of resolved.events) {
      if (event.kind === 'bankrupt') moments.push({ key: `${at}:bankrupt`, kind: 'bankrupt', proceeds: event.proceeds, debtsCleared: event.debtsCleared });
    }
    const out = resolved.events.find((event): event is Extract<GameEvent, { kind: 'escaped' }> => event.kind === 'escaped');
    if (out) moments.push({ key: `${at}:escape`, kind: 'escape', round: out.round });
    if (firstMillion(story, view)) moments.push({ key: `${at}:million`, kind: 'million' });
  }

  if (stage === 'news') {
    const crisis = view.timeline[at]?.crisis;
    if (crisis && crisis.year === 1) moments.push({ key: `${at}:crisis`, kind: 'crisis', crisisId: crisis.id, rounds: crisis.of });
  }
  return moments;
}
