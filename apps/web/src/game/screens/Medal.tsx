'use client';

import { badgeArt, rarityOf, RIM_ART } from '@ratrace/content';
import { Sprite } from '@/ui/Sprite';

/** How large a medal is drawn: the rim, and the badge inside it. */
/** The small rim at its own size, so its pixels stay sharp. */
const SIZES = { md: { rim: 96, badge: 64 }, sm: { rim: 64, badge: 42 } } as const;

/**
 * A badge set in the rim of its rarity: bronze, silver, gold or the gem. A badge not earned yet is
 * the lock in the same rim, so its rarity is seen before it is won. Decoration: the name is told
 * beside it, not by it, unless `alt` is given.
 */
export function Medal({ badgeId, locked = false, size = 'md', alt = '' }: { badgeId: string; locked?: boolean; size?: keyof typeof SIZES; alt?: string }) {
  const rarity = rarityOf(badgeId);
  const { rim, badge } = SIZES[size];
  return (
    <span data-rarity={rarity} className="relative inline-flex shrink-0 items-center justify-center" style={{ width: rim, height: rim }}>
      <Sprite id={RIM_ART[rarity]} fallback={{ w: 64, h: 64 }} className="absolute inset-0 !h-full !w-full" />
      <span className="relative inline-flex" style={{ width: badge, height: badge }}>
        <Sprite id={badgeArt(locked ? 'locked' : badgeId)} alt={alt} fallback={{ w: 64, h: 64 }} className="!h-full !w-full" />
      </span>
    </span>
  );
}
