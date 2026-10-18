'use client';

import { portraitArt, rarityOf } from '@ratrace/content';
import type { BadgeRarity } from '@ratrace/content';
import { useState } from 'react';
import { useGame, useT, useWords } from '@/game/context';
import { Bare, Button } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { Sparks } from '@/ui/Sparks';
import { Sprite } from '@/ui/Sprite';
import { Medal } from './Medal';
import { RARITY_GLOW, RARITY_TONE, RarityBand } from './RarityBand';

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
  const common = useT('common');
  // Legendary badges already taken in: each has the whole screen once, until the player moves on.
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set());
  if (earned.length === 0 && unlocked.length === 0) return null;
  const grand = earned.find((id) => rarityOf(id) === 'legendary' && !seen.has(id));
  const dismiss = () => grand && setSeen((now) => new Set(now).add(grand));

  return (
    <>
      {grand ? (
        <Sheet open onClose={dismiss} title={text.badges[grand]?.name ?? grand} closeLabel={common('close')} tone="gold">
          <div data-legendary={grand} className="relative flex flex-col items-center gap-3 text-center">
            <p className="pixel text-[13px] uppercase tracking-[0.14em] text-teal-300">{t('legendaryKicker')}</p>
            <span className="relative inline-flex [perspective:200px]">
              <span className="inline-flex animate-medal">
                <Medal badgeId={grand} />
              </span>
              <Sparks colours={SPARKS.legendary} count={18} reach={52} delayMs={500} />
            </span>
            <p className="text-[15px] leading-snug">{text.badges[grand]?.how}</p>
            <RarityBand rarity="legendary" className="pixel text-[13px] uppercase tracking-[0.1em] text-teal-300" />
            <Button variant="primary" wide onClick={dismiss}>
              {t('legendaryGo')}
            </Button>
          </div>
        </Sheet>
      ) : null}
      {earned.map((id) => (
        <div key={id} role="status" data-rarity={rarityOf(id)} className={`frame frame-gold flex animate-rise items-center gap-3 bg-night-700 p-2 ${RARITY_GLOW[rarityOf(id)]}`}>
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
            <p className={`pixel text-[11px] uppercase tracking-[0.1em] ${RARITY_TONE[rarityOf(id)]}`}>
              <span>{t(`rarity.${rarityOf(id)}`)}</span> ·<RarityBand rarity={rarityOf(id)} />
            </p>
            <p className="text-[13px] leading-snug text-ink-200">{text.badges[id]?.how}</p>
          </div>
        </div>
      ))}
      {/* Lives unlocked together are told together: one card, each life with its face and what it is good at. */}
      {unlocked.length > 0 ? (
        <div role="status" className="frame frame-gold flex animate-rise flex-col gap-2 bg-gold-500 p-2 text-ink-900">
          <p className="pixel flex items-center gap-2 text-[12px] uppercase tracking-wider">
            <Sprite id="icon.star" />
            {t(unlocked.length === 1 ? 'unlocked' : 'unlockedMany', { count: unlocked.length })}
          </p>
          <ul className="flex flex-col gap-2">
            {unlocked.map((id) => (
              <li key={id} className="flex items-center gap-3">
                <Bare className="size-12 shrink-0 bg-gold-200">
                  <Sprite id={portraitArt(id, 22)} fallback={{ w: 64, h: 64 }} className="!h-full !w-full" />
                </Bare>
                <div className="min-w-0">
                  <p className="pixel text-[18px] leading-tight">{text.lives[id]?.name ?? id}</p>
                  <p className="text-[13px] leading-snug">{text.lives[id]?.perk}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
