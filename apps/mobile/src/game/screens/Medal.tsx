import { badgeArt, rarityOf, RIM_ART } from '@ratrace/content';
import { useMemo } from 'react';
import { View } from 'react-native';
import { SpriteLayers } from '../../ui/Sprite';

/** How large a medal is drawn: the rim, and the badge inside it. The small rim at its own size, so its pixels stay sharp. */
const SIZES = { md: { rim: 96, badge: 64 }, sm: { rim: 64, badge: 42 } } as const;

/**
 * A badge set in the rim of its rarity: bronze, silver, gold or the gem. A badge not earned yet is the lock in the same rim, so its rarity is
 * seen before it is won. Decoration: the name is told beside it, not by it, unless `alt` is given. `grey` draws it as the web does on a card it
 * greys whole (its `grayscale` filter: the collection's badge not yet earned), rim and badge alike.
 */
export function Medal({ badgeId, locked = false, size = 'md', alt = '', grey = false }: { badgeId: string; locked?: boolean; size?: keyof typeof SIZES; alt?: string; grey?: boolean }) {
  const rarity = rarityOf(badgeId);
  const { rim, badge } = SIZES[size];
  const art = badgeArt(locked ? 'locked' : badgeId);
  // The rim and the badge in its middle on one canvas (SpriteLayers): a tab of a hundred medals makes and draws one picture for each, not two.
  const layers = useMemo(
    () => [
      { id: RIM_ART[rarity], x: 0, y: 0, w: rim, h: rim, grey },
      { id: art, x: (rim - badge) / 2, y: (rim - badge) / 2, w: badge, h: badge, grey },
    ],
    [rarity, art, rim, badge, grey],
  );
  return (
    <View {...{ dataSet: { rarity } }} style={{ width: rim, height: rim, flexShrink: 0 }}>
      <SpriteLayers size={{ w: rim, h: rim }} layers={layers} alt={alt} />
    </View>
  );
}
