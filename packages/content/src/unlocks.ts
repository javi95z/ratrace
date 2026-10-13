import type { LifeDef } from './lives';

/** What a player has done that a life can be unlocked by. */
export interface Played {
  /** Lives lived to the end. */
  finished: number;
  /** Every badge ever earned. */
  badges: readonly string[];
}

/**
 * The lives a player has unlocked by playing, in the order the chooser shows them.
 * Lives open from the start are not listed. Each goal is a badge or a count of finished lives,
 * so nothing a life records is judged twice.
 */
export function unlockedLives(lives: ReadonlyArray<LifeDef>, played: Played): string[] {
  return lives
    .filter((life) => {
      switch (life.unlock) {
        case 'default':
          return false;
        case 'finish_one_life':
          return played.finished >= 1;
        case 'net_worth_1m':
          return played.badges.includes('millionaire');
        case 'three_cities':
          return played.badges.includes('three_cities');
        default:
          // Every other goal is the badge of the same name.
          return played.badges.includes(life.unlock);
      }
    })
    .map((life) => life.id);
}
