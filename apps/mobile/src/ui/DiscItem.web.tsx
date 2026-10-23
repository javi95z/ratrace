import { View } from 'react-native';
import { ReadText, SNUG } from './text';
import { COLORS } from './theme';

/*
 * The web export's twin of `DiscItem.tsx` (Metro picks it for the web): the disc is a circle in a small SVG, not on a canvas. (The kit has no rounded corners: a round thing is drawn as a circle.)
 */

/** The web's `list-disc pl-5`: each line stands 20 in, its disc out in the room to its left. */
const INDENT = 20;

/** The disc the browser draws before a line of a list of 14 × 1.375: 5 points across, 4 in from the list's edge, its top 7 under the line's (as measured on the web's shots). */
const DISC = { size: 5, left: 4, top: 7 };

/** A line of a list with a disc before it (the web's `<li>` in a `list-disc pl-5 text-[14px] leading-snug` list). */
export function DiscItem({ children }: { children: string }) {
  return (
    <View role="listitem" style={{ paddingLeft: INDENT }}>
      <svg aria-hidden data-disc width={DISC.size} height={DISC.size} viewBox={`0 0 ${DISC.size} ${DISC.size}`} style={{ position: 'absolute', left: DISC.left, top: DISC.top }}>
        <circle cx={DISC.size / 2} cy={DISC.size / 2} r={DISC.size / 2} fill={COLORS.cream} />
      </svg>
      <ReadText size={14} lineHeight={14 * SNUG}>{children}</ReadText>
    </View>
  );
}
