import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useReducedMotion } from './animations';
import { GRAB, backSpring, dimOf, letGo, pulledTo, slideMs } from './sheetPull';
import type { SheetHold } from './sheetHold';

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
  /** Whether a control of the sheet that drags itself (a slider) is pressed: then the sheet is not dragged (`useSheetHold`, ./sheetHold). */
  held(): boolean;
}


/**
 * The pull of a sheet's panel, shared by the phone and the web: the panel follows the drag down (and gives a little up), the dimmed page fades with
 * it, and let go it either goes back on a spring or slides away and asks its owner to close it (`onClose`, the path the close button and the
 * backdrop take). Under reduced motion (the system's or the game's) nothing springs or slides: it is back at once, or the owner is asked at once.
 *
 * The owner answers with its next render: closed, the sheet's Modal is hidden; still open (it refused, or it gave the sheet's place to what comes next,
 * as the moments do), the panel comes back with that render, never waiting off the screen. While it waits for that answer (`leaving`) it takes no
 * drag, and its backdrop, its Close and Android's Back ask nothing more (`isLeaving`): a tap on a page that seems gone is not a second answer. A sheet
 * `locked` (one that cannot be closed now) is never asked: it gives a little either way and goes back.
 */
export function useSheetPull({ open, onClose, locked = false }: { open: boolean; onClose(): void; locked?: boolean }) {
  const still = useReducedMotion();
  const pull = useSharedValue(0);
  const height = useSharedValue(0);
  const from = useSharedValue(0);
  const leaving = useSharedValue(false);
  const quiet = useSharedValue(still);
  const held = useSharedValue(locked);
  // A control of the sheet that drags itself is pressed (`hold`); a drag of the sheet is under way (from `begin` to `end` or `cancel`).
  const holding = useSharedValue(false);
  const dragging = useSharedValue(false);
  useEffect(() => {
    quiet.value = still;
    held.value = locked;
  }, [still, locked, quiet, held]);

  const closing = useRef(onClose);
  useEffect(() => {
    closing.current = onClose;
  });
  // Asked by a drag, the owner answers in the render the asking starts (`asks`), which is where the panel comes back if it is still open.
  const [asks, setAsks] = useState(0);
  const waiting = useRef(false);
  const ask = useCallback(() => {
    waiting.current = true;
    setAsks((n) => n + 1);
    closing.current();
  }, []);
  useLayoutEffect(() => {
    if (!waiting.current) return;
    waiting.current = false;
    if (!open) return;
    leaving.value = false;
    pull.value = still ? 0 : withSpring(0, backSpring(0));
  }, [asks, open, still, leaving, pull]);

  const begin = useCallback(
    (translation: number) => {
      'worklet';
      if (leaving.value || holding.value) return;
      dragging.value = true;
      cancelAnimation(pull);
      from.value = pull.value - Math.max(-GRAB, Math.min(GRAB, translation));
    },
    [leaving, holding, dragging, pull, from],
  );
  const move = useCallback(
    (translation: number) => {
      'worklet';
      if (!dragging.value) return;
      pull.value = pulledTo(from.value + translation, held.value);
    },
    [dragging, pull, from, held],
  );
  const end = useCallback(
    (translation: number, velocity: number) => {
      'worklet';
      if (!dragging.value) return;
      dragging.value = false;
      const at = pulledTo(from.value + translation, held.value);
      if (held.value || letGo(at, velocity, height.value) === 'back') {
        pull.value = quiet.value ? 0 : withSpring(0, backSpring(velocity));
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
    [dragging, leaving, from, height, pull, quiet, held, ask],
  );
  const cancel = useCallback(() => {
    'worklet';
    if (!dragging.value) return;
    dragging.value = false;
    pull.value = quiet.value ? 0 : withSpring(0, backSpring(0));
  }, [dragging, pull, quiet]);
  const isHeld = useCallback(() => {
    'worklet';
    return holding.value;
  }, [holding]);
  const hold = useMemo<SheetHold>(
    () => ({
      press: () => void (holding.value = true),
      release: () => void (holding.value = false),
    }),
    [holding],
  );

  const isLeaving = useCallback(() => leaving.value, [leaving]);
  const measure = useCallback((event: LayoutChangeEvent) => void (height.value = event.nativeEvent.layout.height), [height]);
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pull.value }] }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: dimOf(pull.value, height.value) }));
  // One drag for the sheet's life: the pans are given it once, not made again with every render of the sheet.
  const drag = useMemo<SheetPull>(() => ({ begin, move, end, cancel, held: isHeld }), [begin, move, end, cancel, isHeld]);
  return { drag, hold, measure, panelStyle, dimStyle, isLeaving };
}
