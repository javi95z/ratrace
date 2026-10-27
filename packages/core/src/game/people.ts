import { metFlag, PEOPLE, personEndings } from '@ratrace/content';
import type { Mood, PersonId } from '@ratrace/content';

/*
 * The people who come back (`@ratrace/content`'s `people.ts`), as a life's flags tell of them: who it met, and how each story ended.
 * The engine knows none of this; it only keeps the flags their cards set.
 */

type Flags = Readonly<Record<string, number>>;
const has = (flags: Flags, flag: string) => Object.hasOwn(flags, flag);

/** The people the life has met, in the order the collection shows them. */
export function peopleMet(flags: Flags): PersonId[] {
  return PEOPLE.filter((who) => has(flags, metFlag(who)));
}

/** How a person's story stands: the first ending whose flags hold (the last of each holds always). */
export function endingOf(who: PersonId, flags: Flags): { id: string; mood: Mood } {
  const endings = personEndings[who];
  const ending = endings.find((e) => (e.flags ?? []).every((flag) => has(flags, flag)) && !(e.notFlags ?? []).some((flag) => has(flags, flag))) ?? endings[endings.length - 1];
  return { id: ending.id, mood: ending.mood };
}

/** What became of each person the life met, for its end: who, the ending (`text.people[who].endings`), and the face to show with it. */
export function peopleEpilogue(flags: Flags): Array<{ who: PersonId; ending: string; mood: Mood }> {
  return peopleMet(flags).map((who) => {
    const { id, mood } = endingOf(who, flags);
    return { who, ending: id, mood };
  });
}

/** What the profile keeps of a life's people: each met (`<who>`), and once the life is over how their story ended (`<who>.<ending>`). */
export function peopleSeen(flags: Flags, over: boolean): string[] {
  return peopleMet(flags).flatMap((who) => (over ? [who, `${who}.${endingOf(who, flags).id}`] : [who]));
}
