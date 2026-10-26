import { useCallback, useLayoutEffect, useRef, type ReactNode } from 'react';
import { View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useReducedMotion } from './animations';
import { useHaptic } from './haptic';
import { draggedTo, ENTER_MS, LEAVE_MS, SWIPE_CANCEL, SWIPE_GRAB, turnOf } from './tabTurn';

/** The spring a panel let go of short of turning goes back on: quick, no bounce worth seeing. */
const BACK = { stiffness: 380, damping: 36, mass: 1, overshootClamping: true } as const;

/**
 * The panel of a strip of tabs, swiped sideways to the next tab or the one before, as a phone's own paged tabs are: it follows the finger (with a
 * little give where there is no tab to go to), and let go past a quarter of its width, or flicked, it leaves to that side and the tab beside it comes
 * in from the other, felt as a choice taken. A tab chosen in the strip comes in from its side too. Up and down is the page's scroll, never a swipe.
 * Under reduced motion the tab still turns, with nothing sliding. `tabs` are in the strip's order, `value` the one on screen, `onChange` turns it.
 * (On the web nothing: `TabSwipe.web.tsx`, a page is not swiped.)
 */
export function TabSwipe<T extends string>({ tabs, value, onChange, children }: { tabs: readonly T[]; value: T; onChange(tab: T): void; children: ReactNode }) {
  const still = useReducedMotion();
  const haptic = useHaptic();
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const at = tabs.indexOf(value);
  const hasPrev = useSharedValue(at > 0);
  const hasNext = useSharedValue(at >= 0 && at < tabs.length - 1);
  const quiet = useSharedValue(still);
  // The latest of what a turn needs, read when a swipe lands (on React's side).
  const latest = useRef({ tabs, value, onChange, at });
  latest.current = { tabs, value, onChange, at };
  // Which way the last change of tab came from: a swipe's turn says it, a tab chosen in the strip is worked out from where it stands.
  const turned = useRef<number | null>(null);
  const shown = useRef(at);

  useLayoutEffect(() => {
    hasPrev.value = at > 0;
    hasNext.value = at >= 0 && at < tabs.length - 1;
    quiet.value = still;
  }, [at, tabs.length, still, hasPrev, hasNext, quiet]);

  // A new tab on screen comes in from its side: from the right going on, from the left going back.
  useLayoutEffect(() => {
    const before = shown.current;
    shown.current = at;
    if (before === at || at < 0) return;
    const way = turned.current ?? Math.sign(at - before);
    turned.current = null;
    cancelAnimation(x);
    if (still || width.value === 0) {
      x.value = 0;
      return;
    }
    x.value = way * width.value;
    x.value = withTiming(0, { duration: ENTER_MS, easing: Easing.bezier(0, 0, 0.2, 1) });
  }, [at, still, x, width]);

  const turn = useCallback(
    (way: number) => {
      const now = latest.current;
      const next = now.tabs[now.at + way];
      if (next === undefined) {
        x.value = 0;
        return;
      }
      turned.current = way;
      haptic('select');
      now.onChange(next);
    },
    [haptic, x],
  );

  const pan = usePanGesture({
    activeOffsetX: [-SWIPE_GRAB, SWIPE_GRAB],
    failOffsetY: [-SWIPE_CANCEL, SWIPE_CANCEL],
    onActivate: () => {
      'worklet';
      cancelAnimation(x);
    },
    onUpdate: (event) => {
      'worklet';
      x.value = draggedTo(event.translationX, hasPrev.value, hasNext.value);
    },
    onDeactivate: (event) => {
      'worklet';
      if (event.canceled) {
        x.value = withSpring(0, BACK);
        return;
      }
      const stand = draggedTo(event.translationX, hasPrev.value, hasNext.value);
      const way = turnOf(stand, event.velocityX, width.value, hasPrev.value, hasNext.value);
      if (way === 0) {
        x.value = quiet.value ? 0 : withSpring(0, { ...BACK, velocity: event.velocityX });
        return;
      }
      if (quiet.value) {
        x.value = 0;
        scheduleOnRN(turn, way);
        return;
      }
      // It leaves to the side it was swiped to, at least as fast as the finger went, and the next tab is taken once it has gone.
      x.value = withTiming(-way * width.value, { duration: LEAVE_MS, easing: Easing.bezier(0.4, 0, 1, 1) }, (done) => {
        if (done) scheduleOnRN(turn, way);
      });
    },
  });
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <GestureDetector gesture={pan}>
      <View onLayout={(event) => void (width.value = event.nativeEvent.layout.width)} style={{ overflow: 'visible' }}>
        <Animated.View style={slide}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}
