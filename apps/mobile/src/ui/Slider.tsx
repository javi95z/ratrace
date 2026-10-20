import { useRef } from 'react';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { View, type LayoutChangeEvent } from 'react-native';
import { Framed } from './Frame';
import { COLORS, TOUCH } from './theme';

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

/** The last value a step can reach under `max`. */
const topOf = (min: number, max: number, step: number) => min + Math.floor((max - min) / step + 1e-9) * step;

/**
 * The amount slider (the web's `<input type="range" class="range">`, `.range` in globals.css): a pixel track, 8 high in
 * the middle of 44 so a thumb can find it, with a square gold handle. A touch puts the handle under the finger and
 * dragging follows it. It is an adjustable for a screen reader: `label` names it, `valueText` is what it reads out in
 * place of the bare number (a sum of money), and the reader's increment and decrement move one `step`.
 */
export function Slider({ value, min, max, step, onChange, label, valueText }: { value: number; min: number; max: number; step: number; onChange(value: number): void; label: string; valueText?: string }) {
  const width = useRef(0);
  // What the pan's callbacks read is the latest render's, not the one they were made in.
  const latest = useRef({ value, min, max, step, onChange });
  latest.current = { value, min, max, step, onChange };

  const set = (next: number) => {
    if (next !== latest.current.value) latest.current.onChange(next);
  };
  const place = (x: number) => {
    const now = latest.current;
    if (width.current === 0 || now.max <= now.min) return;
    set(valueAtX(x, width.current, now.min, now.max, now.step));
  };
  const pan = usePanGesture({
    minDistance: 0,
    runOnJS: true,
    enabled: max > min,
    onBegin: (event) => place(event.x),
    onUpdate: (event) => place(event.x),
  });

  const share = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
  return (
    <GestureDetector gesture={pan}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
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
