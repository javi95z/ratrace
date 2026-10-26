import { useRef, type Ref } from 'react';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { View, type HostInstance, type LayoutChangeEvent } from 'react-native';
import { Framed } from './Frame';
import { acceleratedRangeKey, onKeys, tabStop } from './keyboard';
import { COLORS, TOUCH } from './theme';
import { useSheetHold } from './sheetHold';
import { useHaptic } from './haptic';

/** The handle: the web's `.range::-webkit-slider-thumb`, 20 x 28. The track is 8 high. */
export const THUMB = { w: 20, h: 28 } as const;
const TRACK = 8;

/**
 * The value under a finger at `x` on a track `width` wide. The thumb's middle follows the finger, so the thumb travels
 * `width - 20` and is under the finger from x = 10 to x = width - 10. Like a native range input it snaps to a step counted
 * from `min`, and the last value it can take is the last step that fits under `max`.
 */
export function valueAtX(x: number, width: number, min: number, max: number, step: number): number {
  const travel = Math.max(1, width - THUMB.w);
  const share = Math.min(1, Math.max(0, (x - THUMB.w / 2) / travel));
  const steps = Math.floor((max - min) / step + 1e-9);
  return min + Math.min(steps, Math.max(0, Math.round((share * (max - min)) / step))) * step;
}

/**
 * How far a finger goes before the touch is a drag (sideways) or a scroll (up or down). The track sits in a sheet that
 * scrolls, so a touch is the scroll's until it has gone sideways: a move up or down past `CANCEL` fails the pan.
 */
const ACTIVATE = 6;
const CANCEL = 10;

/** The last value a step can reach under `max`. */
const topOf = (min: number, max: number, step: number) => min + Math.floor((max - min) / step + 1e-9) * step;

/**
 * The amount slider (the web's `<input type="range" class="range">`, `.range` in globals.css): a pixel track, 8 high in
 * the middle of 44 so a thumb can find it, with a square gold handle. A tap puts the handle where it lands, once it is over
 * (as a click does), and a sideways drag follows the finger; a touch that goes up or down is the sheet's scroll and changes
 * nothing. It is an adjustable for a screen reader: `label` names it, `valueText` is what it reads out in place of the
 * bare number (a sum of money), `hint` what it is for (the web's `aria-describedby`: how much there is), and the reader's
 * increment and decrement move one `step`.
 */
export function Slider({ value, min, max, step, onChange, label, valueText, hint, ref }: { value: number; min: number; max: number; step: number; onChange(value: number): void; label: string; valueText?: string; hint?: string; /** The slider itself, for a sheet that gives it the first focus (the web). */ ref?: Ref<HostInstance> }) {
  const width = useRef(0);
  // What the pan's callbacks read is the latest render's, not the one they were made in.
  const latest = useRef({ value, min, max, step, onChange });
  latest.current = { value, min, max, step, onChange };

  const haptic = useHaptic();
  // Each step it moves to is felt, softly, as a phone's own stepped slider ticks (a run of them is spaced out by ./haptics).
  const set = (next: number) => {
    if (next === latest.current.value) return;
    haptic('tick');
    latest.current.onChange(next);
  };
  const place = (x: number) => {
    const now = latest.current;
    if (width.current === 0 || now.max <= now.min) return;
    set(valueAtX(x, width.current, now.min, now.max, now.step));
  };
  // Where the touch began, and whether it has become a drag: a touch that never does and ends where it began is a tap.
  const began = useRef<{ y: number } | null>(null);
  const dragging = useRef(false);
  // In a sheet, a press of the slider is the slider's: the sheet is not dragged from it.
  const hold = useSheetHold();
  const pan = usePanGesture({
    activeOffsetX: [-ACTIVATE, ACTIVATE],
    failOffsetY: [-CANCEL, CANCEL],
    runOnJS: true,
    enabled: max > min,
    onBegin: (event) => {
      hold.press();
      began.current = { y: event.y };
      dragging.current = false;
    },
    onUpdate: (event) => {
      dragging.current = true;
      place(event.x);
    },
    onFinalize: (event) => {
      hold.release();
      const from = began.current;
      began.current = null;
      // A drag has set the value as it went. A touch that went up or down failed the pan: it was a scroll, not an amount.
      if (from && !dragging.current && Math.abs(event.y - from.y) < CANCEL) place(event.x);
      dragging.current = false;
    },
  });

  const share = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
  // On the web, the keyboard's (the Next web's range, docs/keyboard.md): an arrow one step, Shift and an arrow ten, Page Up and Down about a tenth,
  // Home and End the ends.
  const keys = onKeys((event) => {
    const now = latest.current;
    const top = topOf(now.min, now.max, now.step);
    const fast = acceleratedRangeKey(event, now.value - now.min, top - now.min, now.step);
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0;
    const next = fast !== null ? now.min + fast : direction !== 0 ? Math.max(now.min, Math.min(top, now.value + direction * now.step)) : null;
    if (next === null) return false;
    set(next);
    return true;
  });
  return (
    <GestureDetector gesture={pan}>
      <View
        ref={ref}
        {...keys}
        {...tabStop(max > min)}
        {...{ dataSet: { sheetNodrag: true } }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityValue={{ min, max, now: value, text: valueText }}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={valueText}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          const now = latest.current;
          if (event.nativeEvent.actionName === 'increment') {
            const next = Math.min(topOf(now.min, now.max, now.step), now.value + now.step);
            if (next > now.value) set(next);
          } else if (event.nativeEvent.actionName === 'decrement') {
            const next = Math.max(now.min, now.value - now.step);
            if (next < now.value) set(next);
          }
        }}
        onLayout={(event: LayoutChangeEvent) => {
          width.current = event.nativeEvent.layout.width;
        }}
        style={{ width: '100%', height: TOUCH, justifyContent: 'center' }}
      >
        <Framed kind="frame" style={{ height: TRACK, backgroundColor: COLORS['night-600'] }} />
        {/* The thumb's lane is 20 narrower than the track, so its left edge at a share of the lane is where the web puts it. */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: THUMB.w }}>
          <Framed
            kind="frame"
            tone={{ frame: 'gold-900' }}
            style={{ position: 'absolute', top: (TOUCH - THUMB.h) / 2, left: `${share * 100}%`, width: THUMB.w, height: THUMB.h, backgroundColor: COLORS['gold-500'] }}
          />
        </View>
      </View>
    </GestureDetector>
  );
}
