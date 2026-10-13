'use client';

import type { ItemDef } from '@ratrace/engine';
import { useT } from '@/game/context';
import { perkLines } from '@/game/present';

/** What a thing is good for beyond its status: nothing is drawn for a thing that is status and nothing else. */
export function ItemUses({ item }: { item: ItemDef }) {
  const t = useT('effects');
  const lines = perkLines(t, item.perks);
  if (lines.length === 0) return null;
  return (
    <section aria-label={t('perks.title')} className="frame bg-night-800 px-3 py-2">
      <p className="pixel text-[12px] uppercase tracking-wider text-teal-300">{t('perks.title')}</p>
      <ul className="mt-0.5 text-[14px] leading-snug">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-1 text-[12px] text-ink-300">{t('perks.best')}</p>
    </section>
  );
}
