import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useReducedMotion, useSpark } from './animations';
import { frameAt, styleOf } from './motion';
import { COLORS, type ColorToken } from './theme';

/**
 * Where each piece of a burst goes, as the web's Sparks works it out: the pieces are spread round a circle (half a
 * step off the vertical, so none flies straight up), and every other one flies a little shorter, so that the burst
 * does not read as a ring. Whole points, as the web writes them.
 */
export function sparkReach(count: number, reach: number): Array<{ dx: number; dy: number }> {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 2 * Math.PI + Math.PI / count;
    const far = reach * (i % 2 === 0 ? 1 : 0.7);
    return { dx: Math.round(Math.cos(angle) * far), dy: Math.round(Math.sin(angle) * far) };
  });
}

/** One square, thrown from the middle of what it sits on and gone. */
function Spark({ dx, dy, delayMs, colour, size, held }: { dx: number; dy: number; delayMs: number; colour: ColorToken; size: number; held?: number }) {
  const fly = useSpark({ dx, dy, delayMs, play: held === undefined });
  return (
    <Animated.View
      style={[
        { position: 'absolute', width: size, height: size, left: -size / 2, top: -size / 2, backgroundColor: COLORS[colour] },
        held === undefined ? fly : (styleOf('spark', frameAt('spark', held, { dx, dy })) as object),
      ]}
    />
  );
}

/**
 * Square sparks thrown out from the middle of what they sit on, once: a burst for something won or
 * bought. Decoration only, and only movement, so it is not drawn where motion is left out. `colours` are the
 * pieces' colours in turn (the web's `bg-gold-500` is `gold-500`); the piece waits `delayMs`, and each third one
 * a little longer after it, so the burst does not go off all at once. `held`: stand still, every piece at this progress
 * (0 to 1) of its flight and none waiting, for a page that compares one frame with the web's.
 */
export function Sparks({ count = 8, reach = 28, colours, delayMs = 0, size = 3, held }: { count?: number; reach?: number; colours: readonly ColorToken[]; delayMs?: number; size?: number; held?: number }) {
  const still = useReducedMotion();
  if (still) return null;
  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, pointerEvents: 'none' }}
    >
      {sparkReach(count, reach).map(({ dx, dy }, i) => (
        <Spark key={i} dx={dx} dy={dy} delayMs={delayMs + (i % 3) * 40} colour={colours[i % colours.length]} size={size} held={held} />
      ))}
    </View>
  );
}
