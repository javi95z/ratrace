import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePageTurn, useTear } from '../../ui/animations';
import { Framed } from '../../ui/Frame';
import { frameAt, KEYFRAMES, styleOf } from '../../ui/motion';
import { PixelText } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useT } from '../context';

/** How long the calendar stays on screen: the old page torn away, the new one read, and all gone. */
export const PAGE_TURN_MS = 1500;

/** The two rings the pages hang from, over the red band: 8 by 14, 24 in from either side, 6 above it (the web's `-top-1.5 left-6 h-3.5 w-2`). */
const RING: ViewStyle = { position: 'absolute', top: -6, width: 8, height: 14, backgroundColor: COLORS['ink-900'] };

/** A page of a wall calendar, drawn in the game's pixels: a red band with its two rings, and an age. */
function Page({ age, mark }: { age: number; mark?: string }) {
  const t = useT('play');
  return (
    <Framed kind="frame" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: COLORS.cream }}>
      <View {...(mark ? { dataSet: { page: mark } } : null)} style={{ flex: 1 }}>
        <View style={{ height: 24, backgroundColor: COLORS['wine-500'] }}>
          <View style={{ ...RING, left: 24 }} />
          <View style={{ ...RING, right: 24 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <PixelText size={52} lineHeight={52} tone="ink-900">{String(age)}</PixelText>
          <PixelText size={14} tone="ink-700" style={{ letterSpacing: 14 * 0.1 }}>{t('turnYears', { age }).toUpperCase()}</PixelText>
        </View>
      </View>
    </Framed>
  );
}

/** An effect as it is `ms` into its run: the very frame the hooks play then. */
const heldAt = (name: 'page' | 'tear', ms: number) => styleOf(name, frameAt(name, ms / KEYFRAMES[name].ms)) as ViewStyle;

/**
 * Two years go by between rounds: the page of the old age is torn off the calendar and falls, and
 * the new one is there beneath it, then all of it goes. Decoration only, over the page and out of
 * the way of every tap; the stage heading already says where the player is. It is never drawn
 * where motion is left out.
 *
 * It stands over the whole screen, as the web's `fixed inset-0` does, so it is in the middle of the screen and not of the part under the
 * status bar: the screen it is placed in starts under the top inset, and it leaves as much room again at its foot. `held` (a scene's: phone
 * only) draws it as it is that many milliseconds into its run, and still.
 */
export function PageTurn({ from, to, onDone, held }: { from: number; to: number; onDone(): void; held?: number }) {
  const inset = useSafeAreaInsets();
  const page = usePageTurn({ play: held === undefined });
  const tear = useTear({ play: held === undefined });
  useEffect(() => {
    const timer = setTimeout(onDone, PAGE_TURN_MS);
    return () => clearTimeout(timer);
    // The calendar of one turn of the page: a later one is drawn by a new calendar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View
      {...{ dataSet: { motionOnly: 'true' } }}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingBottom: inset.top, zIndex: 50, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}
    >
      <Animated.View {...{ dataSet: { turn: 'true' } }} style={[{ width: 144, height: 176 }, held === undefined ? page : heldAt('page', held)]}>
        <Page age={to} mark="new" />
        <Animated.View
          {...{ dataSet: { page: 'torn' } }}
          style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, transformOrigin: 'top left' }, held === undefined ? tear : heldAt('tear', held)]}
        >
          <Page age={from} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}
