import { badgeArt, rarityOf, RIM_ART } from '@ratrace/content';
import { View } from 'react-native';
import { Sprite } from '../../ui/Sprite';

/** How large a medal is drawn: the rim, and the badge inside it. The small rim at its own size, so its pixels stay sharp. */
const SIZES = { md: { rim: 96, badge: 64 }, sm: { rim: 64, badge: 42 } } as const;

/** What a missing picture of a rim or a badge keeps room for. */
const FALLBACK = { w: 64, h: 64 };

/** The rim fills the medal's box, under the badge. One object, so the rim's sprite (memo) is not drawn again for a style made anew. */
const RIM_PLACE = { position: 'absolute', top: 0, left: 0 } as const;

/**
 * A badge set in the rim of its rarity: bronze, silver, gold or the gem. A badge not earned yet is the lock in the same rim, so its rarity is
 * seen before it is won. Decoration: the name is told beside it, not by it, unless `alt` is given. `grey` draws it as the web does on a card it
 * greys whole (its `grayscale` filter: the collection's badge not yet earned), rim and badge alike.
 */
export function Medal({ badgeId, locked = false, size = 'md', alt = '', grey = false }: { badgeId: string; locked?: boolean; size?: keyof typeof SIZES; alt?: string; grey?: boolean }) {
  const rarity = rarityOf(badgeId);
  const { rim, badge } = SIZES[size];
  return (
    <View {...{ dataSet: { rarity } }} style={{ width: rim, height: rim, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
      <Sprite id={RIM_ART[rarity]} fallback={FALLBACK} size={{ w: rim, h: rim }} style={RIM_PLACE} grey={grey} />
      <View style={{ width: badge, height: badge }}>
        <Sprite id={badgeArt(locked ? 'locked' : badgeId)} alt={alt} fallback={FALLBACK} size={{ w: badge, h: badge }} grey={grey} />
      </View>
    </View>
  );
}
