'use client';

import { useMemo } from 'react';
import { useGame, useT, useWords } from '@/game/context';
import { RIVALS, rivalsOf } from './rivals';
import type { Rival } from './rivals';

/** How many names there are of each sex, in every language. */
export const RIVAL_NAMES = 6;

/** The lives drawn as women; the rest are drawn as men. An ex is of the other sex. */
const WOMEN: ReadonlySet<string> = new Set(['nurse', 'doctor', 'founder', 'lawyer', 'programmer', 'influencer', 'salesperson']);

/** Whether each rival is a woman: the classmate a man, the cousin a woman, the ex the other sex to the player. */
const isWoman = (rival: Rival, lifeId: string): boolean => (rival.id === 'cousin' ? true : rival.id === 'ex' ? !WOMEN.has(lifeId) : false);

/**
 * The rivals of the life on screen, as of the round on screen, and how each is called: their name
 * and who they are to the player. Null before a life is open.
 */
export function useRivals(): { rivals: Rival[]; who(rival: Rival): string } | null {
  const t = useT('rivals');
  const { content } = useWords();
  const view = useGame((s) => s.view);
  const history = useGame((s) => s.history);
  const lifeId = useGame((s) => s.lifeId) ?? '';
  const rivals = useMemo(() => {
    if (!view || history.length === 0) return null;
    // The first page of the life's newspaper is its own: the rivals are the same each time it is opened, and different in the next life.
    const key = `${lifeId}:${JSON.stringify(view.timeline[0]?.news ?? [])}`;
    return rivalsOf(content, view.timeline, history, view.player.life.homeCityId, key, RIVAL_NAMES);
  }, [content, view, history, lifeId]);
  if (rivals === null) return null;
  const who = (rival: Rival) => {
    const woman = isWoman(rival, lifeId);
    // Two men among the rivals, the classmate and an ex, never share a name.
    const classmate = rivals.find((other) => other.id === 'classmate');
    const index = rival.id === 'ex' && !woman && classmate?.name === rival.name ? (rival.name + 3) % RIVAL_NAMES : rival.name;
    const name = t(woman ? 'names.women' : 'names.men').split('|')[index] ?? '';
    return t(`who.${rival.id === 'ex' ? (woman ? 'exWoman' : 'exMan') : rival.id}`, { name });
  };
  return { rivals, who };
}

export { RIVALS };
