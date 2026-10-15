'use client';

import { useMemo } from 'react';
import { useGame, useT, useWords } from '@/game/context';
import { RIVALS, rivalsOf } from './rivals';
import type { Rival } from './rivals';

/** How many names there are of each kind of rival, in every language. */
export const RIVAL_NAMES = 6;

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
  const who = (rival: Rival) => t(`who.${rival.id}`, { name: t(`names.${rival.id}`).split('|')[rival.name] ?? '' });
  return { rivals, who };
}

export { RIVALS };
