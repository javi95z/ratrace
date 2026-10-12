import type { PlayerState } from './types';

/** The next id for something the player owns or owes. Ids are never reused within a game. */
export function newId(p: PlayerState, prefix: string): string {
  p.nextId += 1;
  return `${prefix}-${p.nextId}`;
}
