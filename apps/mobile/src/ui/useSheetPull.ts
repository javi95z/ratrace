import { useCallback, useEffect, useRef } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useReducedMotion } from './animations';
import { GRAB, dimOf, letGo, pulledTo, slideMs } from './sheetPull';

/**
 * The spring a sheet let go of short of closing goes back on: quick and only just damped, as a phone's own sheet settles, without a bounce past its
 * rest worth seeing.
 */
export const BACK_SPRING = { stiffness: 380, damping: 36, mass: 1 };

/**
 * How long a sheet slid away waits for its owner to close it before it takes the answer for a no and comes back. The owner is asked as the close
 * button asks (`onClose`), and one that closes does so with its next render, well within this; one that refuses (an account being deleted,
 * `DeleteSheet`) says nothing, so its silence is the refusal.
 */
export const REFUSED_MS = 250;

/** A sheet being pulled: what the gestures tell it (the phone's on its UI thread, the web's from the page's pointer events), and what it draws. */
export interface SheetPull {
  /**
   * The finger has begun to drag, already `translation` points from where it touched (a drag is told once it has gone `GRAB` points): whatever the
   * panel was doing, it is the finger's now. It moves from where it stands, with no jump for the `GRAB` the finger went before the drag was taken; a
   * drag told late (the phone's touches come far apart) is caught up with at once, so the panel stays under the finger.
   */
  begin(translation: number): void;
  /** The finger is `translation` points below where it began (above it, negative). */
  move(translation: number): void;
  /** The finger is lifted, `translation` points below where it began, moving at `velocity` points a second (down positive). */
  end(translation: number, velocity: number): void;
  /** The drag was taken from the sheet (the phone's cancel, the browser's): it goes back. */
  cancel(): void;
}

/**
 * The pull of a sheet's panel, shared by the phone and the web: the panel follows the drag down (and gives a little up), the dimmed page fades with
 * it, and let go it either goes back on a spring or slides away and asks its owner to close it (`onClose`, the path the close button and the
 * backdrop take). Not closed by its owner, it comes back. Under reduced motion (the system's or the game's) nothing springs or slides: it is back at
 * once, or the owner is asked at once.
 */
export function useSheetPull({ open, onClose }: { open: boolean; onClose(): void }) {
  const still = useReducedMotion();
  const pull = useSharedValue(0);
  const height = useSharedValue(0);
  const from = useSharedValue(0);
  // Slid away (or asked at once), waiting for the owner's answer: no drag is taken until it comes.
  const leaving = useSharedValue(false);
  const quiet = useSharedValue(still);
  useEffect(() => {
    quiet.value = still;
  }, [still, quiet]);

  const closing = useRef(onClose);
  const stillOpen = useRef(open);
  const refused = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    closing.current = onClose;
    stillOpen.current = open;
    // Closed: its Modal is hidden, and whatever the panel was doing no longer matters.
    if (!open && refused.current !== null) {
      clearTimeout(refused.current);
      refused.current = null;
    }
  });
  useEffect(() => () => void (refused.current !== null && clearTimeout(refused.current)), []);

  const ask = useCallback(() => {
    closing.current();
    if (refused.current !== null) clearTimeout(refused.current);
    refused.current = setTimeout(() => {
      refused.current = null;
      if (!stillOpen.current) return;
      leaving.value = false;
      pull.value = still ? 0 : withSpring(0, BACK_SPRING);
    }, REFUSED_MS);
  }, [still, leaving, pull]);

  const begin = useCallback(
    (translation: number) => {
      'worklet';
      if (leaving.value) return;
      cancelAnimation(pull);
      from.value = pull.value - Math.max(-GRAB, Math.min(GRAB, translation));
    },
    [leaving, pull, from],
  );
  const move = useCallback(
    (translation: number) => {
      'worklet';
      if (leaving.value) return;
      pull.value = pulledTo(from.value + translation);
    },
    [leaving, pull, from],
  );
  const end = useCallback(
    (translation: number, velocity: number) => {
      'worklet';
      if (leaving.value) return;
      const at = pulledTo(from.value + translation);
      if (letGo(at, velocity, height.value) === 'back') {
        pull.value = quiet.value ? 0 : withSpring(0, { ...BACK_SPRING, velocity });
        return;
      }
      leaving.value = true;
      if (quiet.value) {
        scheduleOnRN(ask);
        return;
      }
      const gone = height.value + 24;
      pull.value = withTiming(gone, { duration: slideMs(gone - at, velocity), easing: Easing.linear }, (done) => {
        if (done) scheduleOnRN(ask);
      });
    },
    [leaving, from, height, pull, quiet, ask],
  );
  const cancel = useCallback(() => {
    'worklet';
    if (leaving.value) return;
    pull.value = quiet.value ? 0 : withSpring(0, BACK_SPRING);
  }, [leaving, pull, quiet]);

  const measure = useCallback((event: LayoutChangeEvent) => void (height.value = event.nativeEvent.layout.height), [height]);
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pull.value }] }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: dimOf(pull.value, height.value) }));
  const drag: SheetPull = { begin, move, end, cancel };
  return { drag, measure, panelStyle, dimStyle };
}
