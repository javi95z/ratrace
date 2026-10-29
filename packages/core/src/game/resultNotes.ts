import type { GameEvent } from '@ratrace/engine';

/*
 * The notes of a round's result by how much they matter. What changed the life (a promotion, skills, a business, a home, a loss, bad news) is told
 * first, above the money; what only informs is told last, under it all. Judged by the kind of note, never by its words.
 */

/** The kinds of note that only inform: a status that has worn off, a crisis that is over. */
export const MINOR_NOTES = ['wornOff', 'crisisOver'] as const;

/** Every kind of note the result tells: an event's, or one of the result's own. */
export type NoteKind = GameEvent['kind'] | (typeof MINOR_NOTES)[number];

/** The notes that matter and the minor ones, each in the order they came. */
export function byWeight<T>(notes: ReadonlyArray<{ kind: NoteKind; note: T }>): { major: T[]; minor: T[] } {
  const minor = (kind: NoteKind) => (MINOR_NOTES as readonly NoteKind[]).includes(kind);
  return { major: notes.filter((each) => !minor(each.kind)).map((each) => each.note), minor: notes.filter((each) => minor(each.kind)).map((each) => each.note) };
}
