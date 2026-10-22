import { Circle } from '@shopify/react-native-skia';
import { View } from 'react-native';
import { Canvas } from './Canvas';
import { ReadText, SNUG } from './text';
import { COLORS } from './theme';

/** The web's `list-disc pl-5`: each line stands 20 in, its disc out in the room to its left. */
const INDENT = 20;

/**
 * The disc the browser draws before a line of a list of 14 × 1.375 (not a glyph: a filled circle, Blink's symbol marker), as measured on the web's
 * shots (the jail's sheet, a room's rules): 5 points across, 4 in from the list's edge, its top 7 under the line's.
 */
const DISC = { size: 5, left: 4, top: 7 };

/** A line of a list with a disc before it (the web's `<li>` in a `list-disc pl-5 text-[14px] leading-snug` list). */
export function DiscItem({ children }: { children: string }) {
  return (
    <View role="listitem" style={{ paddingLeft: INDENT }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', left: DISC.left, top: DISC.top }}>
        <Canvas style={{ width: DISC.size, height: DISC.size }}>
          <Circle cx={DISC.size / 2} cy={DISC.size / 2} r={DISC.size / 2} color={COLORS.cream} />
        </Canvas>
      </View>
      <ReadText size={14} lineHeight={14 * SNUG}>{children}</ReadText>
    </View>
  );
}
