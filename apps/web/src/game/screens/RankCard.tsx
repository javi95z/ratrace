'use client';

import { progressOf, promoted, RANKS } from '@ratrace/content';
import type { RankId } from '@ratrace/content';
import { useEffect } from 'react';
import { useProfile, useSound, useT } from '@/game/context';
import { useStill } from '@/game/motion';
import { Bar, Panel } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';

/** The emblem of a rank. */
export const rankArt = (rank: RankId): string => `rank.${rank}`;

/** The name of a rank, in the language of the game. */
export function useRankName(): (rank: RankId) => string {
  const t = useT('rank');
  return (rank) => t(`names.${rank}`);
}

/** The player's rat rank and how far they are to the next: a title earned by playing, which gives nothing in the game. */
export function RankCard() {
  const t = useT('rank');
  const name = useRankName();
  const profile = useProfile();
  const progress = progressOf(profile.rank.points);
  return (
    <Panel className="w-full" label={t('title')}>
      <div className="flex items-center gap-3">
        {/* The rank's emblem: grander, the higher the rat has climbed. */}
        <Sprite id={rankArt(progress.rank)} fallback={{ w: 64, h: 64 }} className="!h-12 !w-12 shrink-0" />
        <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
          <p className="pixel text-[17px] text-gold-500">
            <span className="sr-only">{t('title')}: </span>
            {name(progress.rank)}
          </p>
          <p className="text-[12px] text-ink-300">{t('step', { n: RANKS.indexOf(progress.rank) + 1, of: RANKS.length })}</p>
        </div>
      </div>
      <div className="mt-2">
        <Bar value={progress.share} max={1} label={t('progress')} tone="teal" />
      </div>
      <p className="mt-1 text-[12px] text-ink-300">{progress.next === null ? t('top', { points: progress.points }) : t('toNext', { points: progress.toNext, rank: name(progress.next) })}</p>
    </Panel>
  );
}

/**
 * On the end screen of a life: the points it gave and how many are left to the next rank, and a
 * card when the life made the player a higher rank, with its sound unless sound or motion is off.
 */
export function RankGain({ gameId }: { gameId: string }) {
  const t = useT('rank');
  const name = useRankName();
  const profile = useProfile();
  const play = useSound();
  const still = useStill();
  const gained = Object.hasOwn(profile.rank.lives, gameId) ? profile.rank.lives[gameId] : null;
  const after = progressOf(profile.rank.points);
  const rose = gained !== null && promoted(profile.rank.points - gained, profile.rank.points);
  useEffect(() => {
    // The sound board is silent where sound is off.
    if (rose) play('promote');
    // Once when the card appears, not each time the profile is read again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rose]);
  if (gained === null) return null;
  return (
    <div className="flex flex-col gap-2">
      {rose ? (
        <p role="status" data-promotion={after.rank} className={`frame frame-gold pixel flex items-center justify-center gap-3 bg-gold-500 px-3 py-3 text-center text-[18px] text-ink-900 ${still ? '' : 'animate-rise'}`}>
          <Sprite id={rankArt(after.rank)} fallback={{ w: 64, h: 64 }} />
          {t('promoted', { rank: name(after.rank) })}
        </p>
      ) : null}
      <p role="status" className="frame bg-night-700 px-3 py-2 text-center text-[14px] text-ink-200">
        {t('gained', { points: gained })}
        {' · '}
        {after.next === null ? name(after.rank) : t('toNextShort', { points: after.toNext, rank: name(after.next) })}
      </p>
    </div>
  );
}
