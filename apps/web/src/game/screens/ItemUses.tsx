'use client';

import { perkArt } from '@ratrace/content';
import { ITEM_PERKS } from '@ratrace/engine';
import type { ItemDef } from '@ratrace/engine';
import { useT } from '@/game/context';
import { Bare } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';

/** What a thing is good for beyond its status, each use with its sign: nothing is drawn for a thing that is status and nothing else. */
export function ItemUses({ item }: { item: ItemDef }) {
  const t = useT('effects');
  const perks = item.perks ?? {};
  const uses = ITEM_PERKS.filter((perk) => (perks[perk] ?? 0) > 0);
  if (uses.length === 0) return null;
  return (
    <section aria-label={t('perks.title')} className="frame bg-night-800 px-3 py-2">
      <p className="pixel text-[12px] uppercase tracking-wider text-teal-300">{t('perks.title')}</p>
      <ul className="mt-1 flex flex-col gap-1 text-[14px] leading-snug">
        {uses.map((perk) => (
          <li key={perk} className="flex items-center gap-2">
            <Bare className="size-8">
              <Sprite id={perkArt[perk]} />
            </Bare>
            <span>{t(`perks.${perk}`, { n: perks[perk] ?? 0 })}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[12px] text-ink-300">{t('perks.best')}</p>
    </section>
  );
}
