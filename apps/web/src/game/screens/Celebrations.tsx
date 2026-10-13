'use client';

import { badgeArt } from '@ratrace/content';
import { useGame, useT, useWords } from '@/game/context';
import { Bare } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';

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
          <Sprite id={badgeArt(id)} fallback={{ w: 64, h: 64 }} />
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
