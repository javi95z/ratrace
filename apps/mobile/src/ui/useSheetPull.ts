import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, type LayoutChangeEvent } from 'react-native';
import { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useReducedMotion } from './animations';
import { ENTER_MS, GRAB, OFF, SLIDE_MS, backSpring, dimOf, halfOf, pulledTo, settleAt, slideMs } from './sheetPull';
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
 *
 * A sheet that `enters` comes up from the foot of the screen as it opens, the dimmed page with it: the slide away, the other way (`ENTER_MS`). Until
 * its panel is measured it stands a whole `screen` below its rest, the page not dimmed yet, so nothing of it is seen in its place first. Closed by a
 * press (its Close, its backdrop, Back, its owner), it slides away as a drag sends it (`slideAway`).
 */
/** How long a sheet that comes up waits to be measured before it stands in its place without coming up (a frame or two is the usual wait). */
const MEASURE_BACKSTOP_MS = 80;

/** Whether a screen reader is on: it reads a sheet whole, never one standing at its half (its foot below the screen, and no drag to raise it). */
function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isScreenReaderEnabled?.()
      .then((now) => {
        if (live) setOn(now);
      })
      .catch(() => undefined);
    const told = AccessibilityInfo.addEventListener?.('screenReaderChanged', setOn);
    return () => {
      live = false;
      told?.remove();
    };
  }, []);
  return on;
}

/**
 * A sheet of two heights (`half`, its owner's ask, on the phone: `sheetPull.ts`'s `halfOf`) opens at its half where it is tall enough, is pulled up to
 * its whole and down again, and goes whole by itself where it must be (`expand`: a field's keyboard). `atHalf` says where it stands, for its body:
 * at its half, any drag of the body moves the sheet, and nothing scrolls.
 */
export function useSheetPull({ open, onClose, locked = false, enters = false, screen = 0, half = false }: { open: boolean; onClose(): void; locked?: boolean; enters?: boolean; screen?: number; half?: boolean }) {
  const still = useReducedMotion();
  const reader = useScreenReader();
  const twoHeights = half && !reader;
  // How far below its whole its half stands (0: it has none), and where it rests now: its whole (0) or its half.
  const halfAt = useSharedValue(0);
  const stand = useSharedValue(0);
  const [atHalf, setAtHalf] = useState(false);
  // Whether the player has moved it from where it opened (a drag let go, or raised whole for a field): then it stays where they left it.
  const moved = useRef(false);
  const twice = useSharedValue(twoHeights);
  useEffect(() => {
    twice.value = twoHeights;
  }, [twoHeights, twice]);
  // Whether it comes up as it opens, decided once, as it is first drawn.
  const [entering] = useState(() => enters && open && !still && screen > 0);
  const pull = useSharedValue(entering ? screen + OFF : 0);
  const height = useSharedValue(entering ? screen : 0);
  const measured = useRef(false);
  // Sent away by a drag (its owner asked by `ask`): it has slid off already, and a close that follows has nothing left to slide.
  const draggedAway = useRef(false);
  const from = useSharedValue(0);
  const leaving = useSharedValue(false);
  const quiet = useSharedValue(still);
  const lockedNow = useSharedValue(locked);
  // A control of the sheet that drags itself is pressed (`hold`); a drag of the sheet is under way (from `begin` to `end` or `cancel`).
  const holding = useSharedValue(false);
  const dragging = useSharedValue(false);
  useEffect(() => {
    quiet.value = still;
    lockedNow.value = locked;
  }, [still, locked, quiet, lockedNow]);

  const closing = useRef(onClose);
  // Whether it is still open as the slide lands: closed meanwhile some other way (the browser's Back), its owner has had its answer already.
  const opened = useRef(open);
  useLayoutEffect(() => {
    closing.current = onClose;
    opened.current = open;
  });
  // Asked by a drag, the owner answers in the render the asking starts (`asks`), which is where the panel comes back if it is still open.
  const [asks, setAsks] = useState(0);
  const waiting = useRef(false);
  const ask = useCallback(() => {
    if (!opened.current) return;
    draggedAway.current = true;
    waiting.current = true;
    setAsks((n) => n + 1);
    closing.current();
  }, []);
  useLayoutEffect(() => {
    if (!waiting.current) return;
    waiting.current = false;
    if (!open) return;
    draggedAway.current = false;
    leaving.value = false;
    pull.value = still ? stand.value : withSpring(stand.value, backSpring(0));
  }, [asks, open, still, leaving, pull, stand]);

  const markMoved = useCallback(() => void (moved.current = true), []);
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
      pull.value = pulledTo(from.value + translation, lockedNow.value);
    },
    [dragging, pull, from, lockedNow],
  );
  const end = useCallback(
    (translation: number, velocity: number) => {
      'worklet';
      if (!dragging.value) return;
      dragging.value = false;
      const at = pulledTo(from.value + translation, lockedNow.value);
      const goes = settleAt(at, velocity, height.value, halfAt.value);
      if (lockedNow.value || goes !== 'close') {
        const to = !lockedNow.value && goes === 'half' ? halfAt.value : lockedNow.value ? stand.value : 0;
        if (to !== stand.value) {
          stand.value = to;
          scheduleOnRN(setAtHalf, to > 0);
        }
        scheduleOnRN(markMoved);
        pull.value = quiet.value ? to : withSpring(to, backSpring(velocity));
        return;
      }
      leaving.value = true;
      if (quiet.value) {
        scheduleOnRN(ask);
        return;
      }
      const gone = height.value + OFF;
      pull.value = withTiming(gone, { duration: slideMs(gone - at, velocity), easing: Easing.linear }, (done) => {
        if (done) scheduleOnRN(ask);
      });
    },
    [dragging, leaving, from, height, pull, quiet, lockedNow, ask, halfAt, stand, markMoved],
  );
  const cancel = useCallback(() => {
    'worklet';
    if (!dragging.value) return;
    dragging.value = false;
    pull.value = quiet.value ? stand.value : withSpring(stand.value, backSpring(0));
  }, [dragging, pull, quiet, stand]);
  /** Whole, from its half (a field's keyboard is up): nothing where it is whole already, or being dragged. */
  const expand = useCallback(() => {
    if (stand.value === 0 || dragging.value || leaving.value) return;
    moved.current = true;
    stand.value = 0;
    setAtHalf(false);
    pull.value = quiet.value ? 0 : withSpring(0, backSpring(0));
  }, [stand, dragging, leaving, pull, quiet]);
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
  const measure = useCallback(
    (event: LayoutChangeEvent) => {
      const measuredHeight = event.nativeEvent.layout.height;
      height.value = measuredHeight;
      // Its half, for the height it has now: one standing at its half stays at it as what it holds grows or shrinks.
      const halfNow = twice.value ? halfOf(measuredHeight, screen) : 0;
      halfAt.value = halfNow;
      if (measured.current) {
        if (dragging.value || leaving.value) return;
        // At its half, it stays at its half as what it holds grows or shrinks; never moved by the player yet, one that grows tall enough (what it
        // shows came: a life read from the server) goes to its half, as it would have opened.
        if (stand.value > 0 || (!moved.current && halfNow > 0)) {
          const was = stand.value;
          stand.value = halfNow;
          pull.value = was > 0 || quiet.value ? halfNow : withSpring(halfNow, backSpring(0));
          setAtHalf(halfNow > 0);
        }
        return;
      }
      measured.current = true;
      // A sheet of two heights tall enough opens at its half.
      stand.value = halfNow;
      setAtHalf(halfNow > 0);
      if (!entering || dragging.value) {
        if (!dragging.value) pull.value = halfNow;
        return;
      }
      // Measured, it comes up from just below the foot of the screen, slowing as it lands.
      pull.value = measuredHeight + OFF;
      pull.value = withTiming(halfNow, { duration: ENTER_MS, easing: Easing.bezier(0, 0, 0.2, 1) });
    },
    [entering, height, pull, dragging, leaving, twice, halfAt, stand, screen, quiet],
  );
  // Never measured (a page laid out by nobody, a browser in the background) it would wait below the screen for ever: in a moment it is in its place.
  useEffect(() => {
    if (!entering) return;
    const timer = setTimeout(() => {
      if (measured.current) return;
      measured.current = true;
      height.value = 0;
      pull.value = 0;
    }, MEASURE_BACKSTOP_MS);
    return () => clearTimeout(timer);
  }, [entering, height, pull]);
  /**
   * Whether a close by a press can slide it away: it moves, it has been measured, and no drag has sent it off already. Read as its owner closes it,
   * to keep its Modal shown while it goes.
   */
  const canSlideAway = useCallback(() => !still && measured.current && !draggedAway.current, [still]);
  /** Slides it away to the foot of the screen, as a drag lets it go, gathering speed; `gone` is told once it has gone (or was stopped). */
  const slideAway = useCallback(
    (gone: () => void) => {
      leaving.value = true;
      dragging.value = false;
      cancelAnimation(pull);
      pull.value = withTiming(height.value + OFF, { duration: SLIDE_MS, easing: Easing.bezier(0.4, 0, 1, 1) }, () => scheduleOnRN(gone));
    },
    [leaving, dragging, pull, height],
  );
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pull.value }] }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: dimOf(pull.value, height.value, halfAt.value) }));
  // One drag for the sheet's life: the pans are given it once, not made again with every render of the sheet.
  const drag = useMemo<SheetPull>(() => ({ begin, move, end, cancel, held: isHeld }), [begin, move, end, cancel, isHeld]);
  return { drag, hold, measure, panelStyle, dimStyle, isLeaving, canSlideAway, slideAway, atHalf, expand };
}
