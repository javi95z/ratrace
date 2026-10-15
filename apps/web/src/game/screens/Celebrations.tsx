'use client';

import { rarityOf } from '@ratrace/content';
import type { BadgeRarity } from '@ratrace/content';
import { useGame, useT, useWords } from '@/game/context';
import { Bare } from '@/ui/kit';
import { Sparks } from '@/ui/Sparks';
import { Sprite } from '@/ui/Sprite';
import { Medal } from './Medal';

/** The sparks of a badge won are the colours of its rim: bronze, silver, gold, and the gem's green and cream. */
const SPARKS: Record<BadgeRarity, readonly string[]> = {
  common: ['bg-gold-700', 'bg-gold-200'],
  uncommon: ['bg-cream', 'bg-ink-200'],
  rare: ['bg-gold-500', 'bg-gold-200', 'bg-cream'],
  legendary: ['bg-teal-300', 'bg-cream', 'bg-gold-500'],
};

/**
 * What the step on screen earned for the first time ever: badges, and lives unlocked.
 * It says what the session reported; whether a badge was earned is never judged here.
 */
export function Celebrations() {
  const t = useT('badges');
  const { text } = useWords();
  const earned = useGame((s) => s.earned);
  const unlocked = useGame((s) => s.unlocked);
  if (earned.length === 0 && unlocked.length === 0) return null;

  return (
    <>
      {earned.map((id) => (
        <div key={id} role="status" className="frame frame-gold flex animate-rise items-center gap-3 bg-night-700 p-2">
          {/* The badge spins in from nothing in the rim of its rarity, and throws sparks of its colours; the rarer, the more. */}
          <span className="relative inline-flex shrink-0 [perspective:200px]">
            <span className="inline-flex animate-medal">
              <Medal badgeId={id} size="sm" />
            </span>
            <Sparks colours={SPARKS[rarityOf(id)]} count={rarityOf(id) === 'legendary' ? 14 : rarityOf(id) === 'rare' ? 10 : 8} reach={rarityOf(id) === 'common' ? 26 : 36} delayMs={500} />
          </span>
          <div className="min-w-0">
            <p className="pixel text-[12px] uppercase tracking-wider text-gold-500">{t('earned')}</p>
            <p className="pixel text-[18px]">{text.badges[id]?.name ?? id}</p>
            <p className="text-[13px] leading-snug text-ink-200">{text.badges[id]?.how}</p>
          </div>
        </div>
      ))}
      {unlocked.map((id) => (
        <div key={id} role="status" className="frame frame-gold flex animate-rise items-center gap-3 bg-gold-500 p-2 text-ink-900">
          <Bare className="size-10">
            <Sprite id="icon.star" />
          </Bare>
          <div className="min-w-0">
            <p className="pixel text-[12px] uppercase tracking-wider">{t('unlocked')}</p>
            <p className="pixel text-[18px]">{text.lives[id]?.name ?? id}</p>
            <p className="text-[13px] leading-snug">{text.lives[id]?.perk}</p>
          </div>
        </div>
      ))}
    </>
  );
}
