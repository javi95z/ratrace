'use client';

import { RARITY_BANDS } from '@ratrace/content';
import type { BadgeRarity } from '@ratrace/content';
import { useT } from '@/game/context';

/** The colour each rarity is named in, after its rim. */
export const RARITY_TONE: Record<BadgeRarity, string> = { common: 'text-[#c98a4b]', uncommon: 'text-ink-100', rare: 'text-gold-500', legendary: 'text-teal-300' };

/** The glow round a badge card of each rarity: none for bronze, then a rim of light that grows. */
export const RARITY_GLOW: Record<BadgeRarity, string> = {
  common: '',
  uncommon: 'shadow-[0_0_6px_rgba(240,230,210,0.35)]',
  rare: 'shadow-[0_0_12px_rgba(233,177,60,0.6)]',
  legendary: 'shadow-[0_0_20px_rgba(94,224,200,0.7)]',
};

/**
 * How seldom a badge of this rarity is earned, as the band the rarity stands for ("Fewer than 2 in
 * 100 lives"). A band set by judgement and by the balance bots, never a count of real players.
 */
export function RarityBand({ rarity, className }: { rarity: BadgeRarity; className?: string }) {
  const t = useT('badges');
  const [lo, hi] = RARITY_BANDS[rarity];
  return <span className={className}>{t(`band.${rarity}`, { lo, hi })}</span>;
}
