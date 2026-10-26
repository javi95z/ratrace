import { useCallback, useLayoutEffect, useRef, type ReactNode } from 'react';
import { View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useReducedMotion } from './animations';
import { useHaptic } from './haptic';
import { awayOf, CLOSE_MS, LEAVE_MS, pastAway, swipedTo, SWIPE_CANCEL, SWIPE_GRAB } from './rowSwipe';
import { PixelText } from './text';
import { COLORS } from './theme';

/** The spring a row let go of short of going goes back on: quick, no bounce worth seeing. */
const BACK = { stiffness: 380, damping: 36, mass: 1, overshootClamping: true } as const;

/**
 * A row of a list swiped to the left to take it away, as a phone's own list rows are: it follows the finger over a band that says what letting go
 * does (`label`), crossing the line where it would go is felt, and let go past it, or flicked, it leaves to the left and its place closes up (`gap`,
 * the list's space between rows, closing with it) before `onAway` takes it out. Up and down is the page's scroll, never a swipe. Under reduced motion
 * it is taken out at once, nothing sliding. The row keeps its own button for the same: the swipe is the hand's way, not the only one.
 * (On the web nothing: `SwipeAway.web.tsx`.)
 */
export function SwipeAway({ label, gap = 0, onAway, children }: { label: string; gap?: number; onAway(): void; children: ReactNode }) {
  const still = useReducedMotion();
  const haptic = useHaptic();
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  // The row's height once laid out, and how much of its place is left as it closes (1 the whole of it).
  const height = useSharedValue(0);
  const room = useSharedValue(1);
  const past = useSharedValue(false);
  const quiet = useSharedValue(still);
  useLayoutEffect(() => {
    quiet.value = still;
  }, [still, quiet]);

  // What letting go does as the row is now, when it has gone (on React's side): the list may have drawn it again since the finger went down.
  const latest = useRef(onAway);
  latest.current = onAway;
  const away = useCallback(() => latest.current(), []);
  const felt = useCallback(() => haptic('threshold'), [haptic]);

  const pan = usePanGesture({
    activeOffsetX: [-SWIPE_GRAB, SWIPE_GRAB],
    failOffsetY: [-SWIPE_CANCEL, SWIPE_CANCEL],
    onActivate: () => {
      'worklet';
      cancelAnimation(x);
    },
    onUpdate: (event) => {
      'worklet';
      x.value = swipedTo(event.translationX);
      const now = pastAway(x.value, width.value);
      if (now !== past.value) {
        past.value = now;
        if (now) scheduleOnRN(felt);
      }
    },
    onDeactivate: (event) => {
      'worklet';
      past.value = false;
      const at = swipedTo(event.translationX);
      if (event.canceled || !awayOf(at, event.velocityX, width.value)) {
        x.value = withSpring(0, { ...BACK, velocity: event.velocityX });
        return;
      }
      if (quiet.value || width.value === 0) {
        scheduleOnRN(away);
        return;
      }
      // It leaves to the left, then its place closes, and only then is it taken out: the rows under it come up as it goes.
      x.value = withTiming(-width.value, { duration: LEAVE_MS, easing: Easing.bezier(0.4, 0, 1, 1) }, (left) => {
        if (!left) return;
        room.value = withTiming(0, { duration: CLOSE_MS, easing: Easing.bezier(0.4, 0, 0.2, 1) }, (closed) => {
          if (closed) scheduleOnRN(away);
        });
      });
    },
  });

  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  // Seen only while the row is away from its rest, so nothing of it shows round the row's frame.
  const band = useAnimatedStyle(() => ({ opacity: x.value < 0 ? 1 : 0 }));
  const place = useAnimatedStyle(() =>
    room.value === 1 || height.value === 0 ? {} : { height: height.value * room.value, marginBottom: -gap * (1 - room.value), opacity: room.value },
  );
  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        onLayout={(event) => {
          width.value = event.nativeEvent.layout.width;
          if (room.value === 1) height.value = event.nativeEvent.layout.height;
        }}
        style={[{ overflow: 'hidden' }, place]}
      >
        <Animated.View
          aria-hidden
          importantForAccessibility="no-hide-descendants"
          style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: COLORS['wine-700'], alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 16 }, band]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <PixelText size={14} tone="cream">{label}</PixelText>
            <PixelText size={18} tone="cream">{'✕'}</PixelText>
          </View>
        </Animated.View>
        <Animated.View style={slide}>{children}</Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
