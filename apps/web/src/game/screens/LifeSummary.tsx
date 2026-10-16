'use client';

import { cityIcon, lives } from '@ratrace/content';
import { difficultyOf } from '@/game/difficulty';
import { useT, useWords } from '@/game/context';
import { Sprite } from '@/ui/Sprite';

const LEVELS = ['level1', 'level2', 'level3'] as const;

/** How hard a life is, as dots: one to three filled of three, and its word for whoever does not see them. */
export function Difficulty({ lifeId, light = false }: { lifeId: string; light?: boolean }) {
  const t = useT('newLife');
  const level = difficultyOf(lifeId);
  return (
    <span role="img" aria-label={t('difficulty', { level: t(LEVELS[level - 1]) })} className={`pixel shrink-0 text-[11px] tracking-[0.15em] ${light ? 'text-ink-700' : 'text-gold-500'}`}>
      {'●'.repeat(level)}
      <span className={light ? 'text-ink-300' : 'text-ink-500'}>{'●'.repeat(3 - level)}</span>
    </span>
  );
}

/**
 * A life as it is chosen: its name and how hard it is, where it starts and with how much, and in a
 * line each what it is good at and what holds it back. `light` is for a life drawn on cream, chosen.
 */
export function LifeSummary({ lifeId, light = false }: { lifeId: string; light?: boolean }) {
  const t = useT('newLife');
  const { text, names, fmt } = useWords();
  const life = lives.find((one) => one.id === lifeId);
  const written = text.lives[lifeId];
  if (!life || !written) return null;
  return (
    <span className="flex min-w-0 flex-1 flex-col items-start gap-1 py-1 pr-1">
      <span className="flex w-full items-center justify-between gap-2">
        <span className="pixel text-[17px] leading-tight">{written.name}</span>
        <Difficulty lifeId={lifeId} light={light} />
      </span>
      <span className="sr-only">{t('startsIn', { city: names.cities[life.start.cityId], cash: fmt.money(life.start.cash) })}</span>
      <span aria-hidden className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] ${light ? 'text-ink-900' : 'text-ink-200'}`}>
        <span className="flex items-center gap-1">
          <Sprite id={cityIcon(life.start.cityId)} className="!h-5 !w-5" />
          {names.cities[life.start.cityId]}
        </span>
        <span className="pixel flex items-center gap-1 text-[14px]">
          <Sprite id="icon.cash" className="!h-5 !w-5" />
          {fmt.money(life.start.cash)}
        </span>
      </span>
      <span className="text-[12px] leading-snug">
        <span className={light ? 'text-teal-800' : 'text-teal-300'}>＋ {written.perk}</span>{' '}
        <span className={light ? 'text-wine-700' : 'text-wine-300'}>− {written.handicap}</span>
      </span>
    </span>
  );
}
