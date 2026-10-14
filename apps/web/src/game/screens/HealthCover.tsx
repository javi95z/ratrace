'use client';

import type { LivingQuote } from '@ratrace/engine';
import { useT, useWords } from '@/game/context';
import { ageAt } from '@/game/present';

/**
 * What sets the price of health cover, under its switch: the age it was taken out at, for cover
 * held; that taking it out later costs more; or that no insurer takes it on after an illness.
 * Every cover renews by itself each round until it is ended.
 */
export function HealthCoverNote({ living }: { living: LivingQuote }) {
  const t = useT('finance.lifestyle');
  const { content } = useWords();
  const { since, dearerFrom, refused } = living.health;
  const line = refused
    ? { tone: 'text-wine-300', text: t('healthRefused') }
    : since !== null
      ? { tone: 'text-ink-300', text: t('healthLocked', { age: ageAt(content, since) }) }
      : dearerFrom !== null
        ? { tone: 'text-gold-200', text: t('healthDearer', { age: ageAt(content, dearerFrom.fromRound) }) }
        : null;
  return (
    <div className="flex flex-col gap-1 text-[12px] leading-snug">
      {line ? <p className={line.tone}>{line.text}</p> : null}
      <p className="text-ink-300">{t('insuranceRenews')}</p>
    </div>
  );
}
