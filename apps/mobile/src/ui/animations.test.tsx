// @vitest-environment jsdom
import { act, cleanup, render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import Animated from 'react-native-reanimated';
import {
  ReducedMotionProvider,
  refreshSystemMotion,
  useAlarm,
  useBlink,
  useCountUp,
  useFall,
  useFly,
  useGlint,
  useHolo,
  useLegend,
  useLight,
  useMedal,
  usePaper,
  usePageTurn,
  usePop,
  useReducedMotion,
  useReveal,
  useRise,
  useSink,
  useSpark,
  useTear,
} from './animations';
import { KEYFRAMES } from './motion';

// The OS's setting, which the test turns on and off. (react-native-web reads `matchMedia` once, when it loads,
// and answers "reduced" where there is none: this stands in for the phone's AccessibilityInfo.)
const os = vi.hoisted(() => {
  const handlers = new Set<(on: boolean) => void>();
  return {
    on: false,
    handlers,
    set(on: boolean) {
      os.on = on;
      handlers.forEach((h) => h(on));
    },
  };
});

vi.mock('react-native', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('react-native-web');
  return {
    ...actual,
    AccessibilityInfo: {
      isReduceMotionEnabled: () => Promise.resolve(os.on),
      addEventListener: (_: string, h: (on: boolean) => void) => {
        os.handlers.add(h);
        return { remove: () => os.handlers.delete(h) };
      },
    },
  };
});

import { rea } from './testing/reanimated';

vi.mock('react-native-reanimated', async () => (await import('./testing/reanimated')).reanimatedFake());

beforeEach(async () => {
  // the module follows the OS from its load on: put the OS back to "motion on" and let it read that
  os.on = false;
  refreshSystemMotion();
  await Promise.resolve();
  vi.useFakeTimers();
  rea.assigned.length = 0;
  rea.cancelled = 0;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

type Opts = { play?: boolean; reduced?: boolean; delayMs?: number; once?: boolean; dx?: number; dy?: number; rest?: { opacity?: number }; replay?: number };

function Probe({ hook, opts }: { hook: (o: Opts) => object; opts?: Opts }) {
  return <Animated.View testID="probe" style={hook(opts ?? {})} />;
}

const look = (c: HTMLElement) => (c.firstElementChild as HTMLElement).style;
const wait = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const still = ({ children }: { children: ReactNode }) => <ReducedMotionProvider value={true}>{children}</ReducedMotionProvider>;

test('a rise that is not played holds its first frame, plays on play, and ends at its end frame after 280 ms', async () => {
  const { container, rerender } = render(<Probe hook={useRise} opts={{ play: false }} />);
  expect(look(container).opacity).toBe('0');
  expect(look(container).transform).toContain('translateY(8px)');

  rerender(<Probe hook={useRise} opts={{ play: true }} />);
  expect(rea.assigned).toEqual([{ kind: 'timing', to: 1, duration: 280, reps: undefined }]);
  expect(look(container).opacity).toBe('0');
  await wait(279);
  expect(look(container).opacity).toBe('0');
  await wait(2);
  expect(look(container).opacity).toBe('1');
  expect(look(container).transform).toContain('translateY(0');
});

test('play going false again returns to the first frame', async () => {
  const { container, rerender } = render(<Probe hook={useRise} opts={{ play: true }} />);
  await wait(300);
  expect(look(container).opacity).toBe('1');
  rerender(<Probe hook={useRise} opts={{ play: false }} />);
  expect(look(container).opacity).toBe('0');
});

test('a new replay plays the effect again from its first frame, on the same box: a mark bought twice jumps twice, its picture never drawn anew', async () => {
  const { container, rerender } = render(<Probe hook={usePop} opts={{ play: true, replay: 1 }} />);
  const box = container.firstElementChild;
  expect(rea.assigned).toHaveLength(1);
  await wait(1_000);
  rerender(<Probe hook={usePop} opts={{ play: true, replay: 1 }} />);
  expect(rea.assigned).toHaveLength(1);
  rerender(<Probe hook={usePop} opts={{ play: true, replay: 2 }} />);
  expect(rea.assigned).toHaveLength(2);
  expect(container.firstElementChild).toBe(box);
});

test('a pop and a sink rest as themselves before and after they run', async () => {
  const { container: pop } = render(<Probe hook={usePop} opts={{ play: true }} />);
  expect(look(pop).opacity).toBe('1');
  await wait(600);
  expect(look(pop).transform).toContain('scale(1)');
  const { container: sink } = render(<Probe hook={useSink} opts={{ play: true }} />);
  await wait(500);
  expect(look(sink).opacity).toBe('1');
});

test('a blink loops for ever over its second', () => {
  render(<Probe hook={useBlink} opts={{ play: true }} />);
  expect(rea.assigned).toEqual([{ kind: 'repeat', to: 1, duration: 1000, reps: -1 }]);
});

test('with reduced motion a rise is at its end state at once and nothing is animated', () => {
  const { container } = render(<Probe hook={useRise} />, { wrapper: still });
  expect(look(container).opacity).toBe('1');
  expect(look(container).transform).toContain('translateY(0');
  expect(rea.assigned).toEqual([]);
});

test('motion asked to stop while a rise runs ends it at once, and the run is cancelled', async () => {
  const { container, rerender } = render(<Probe hook={useRise} opts={{ reduced: false }} />);
  expect(look(container).opacity).toBe('0');
  const before = rea.cancelled;
  rerender(<Probe hook={useRise} opts={{ reduced: true }} />);
  expect(look(container).opacity).toBe('1');
  expect(rea.cancelled).toBeGreaterThan(before);
  await wait(500);
  expect(look(container).opacity).toBe('1');
});

test('a looping blink under reduced motion rests at its first frame and is not looped', async () => {
  const { container } = render(<Probe hook={useBlink} />, { wrapper: still });
  expect(rea.assigned).toEqual([]);
  await wait(2000);
  expect(look(container).opacity).toBe('1');
});

test('with reduced motion and play false, the end state is not shown first', () => {
  const { container } = render(<Probe hook={useRise} opts={{ play: false }} />, { wrapper: still });
  expect(look(container).opacity).toBe('0');
});

test('unmounting cancels the animation', () => {
  const { unmount } = render(<Probe hook={useRise} />);
  const before = rea.cancelled;
  unmount();
  expect(rea.cancelled).toBeGreaterThan(before);
});

test('the OS setting is known to the first render once read, and follows its changes', async () => {
  os.on = true;
  refreshSystemMotion();
  await act(async () => void (await Promise.resolve()));
  const { result } = renderHook(() => useReducedMotion());
  expect(result.current).toBe(true);
  // the very first frame of a rise is already its end state: no frame plays and snaps
  const { container } = render(<Probe hook={useRise} />);
  expect(look(container).opacity).toBe('1');
  expect(rea.assigned).toEqual([]);

  act(() => os.set(false));
  expect(result.current).toBe(false);
  act(() => os.set(true));
  expect(result.current).toBe(true);
  act(() => os.set(false));
});

test('the game setting reduces motion by argument or provider; the OS alone needs neither', () => {
  expect(renderHook(() => useReducedMotion(false)).result.current).toBe(false);
  expect(renderHook(() => useReducedMotion(true)).result.current).toBe(true);
  expect(renderHook(() => useReducedMotion(), { wrapper: still }).result.current).toBe(true);
});

test('an OS that cannot say leaves motion on', async () => {
  os.on = false;
  refreshSystemMotion();
  await act(async () => void (await Promise.resolve()));
  expect(renderHook(() => useReducedMotion()).result.current).toBe(false);
});

test('a count-up eases out from `from` to its target over `ms`, after `delay`', async () => {
  const { result } = renderHook(() => useCountUp(1000, { from: 200, ms: 800, delay: 100 }));
  expect(result.current).toBe(200);
  await wait(90);
  expect(result.current).toBe(200);
  await wait(10 + 400); // half way through its 800 ms
  expect(result.current).toBeGreaterThan(200 + 800 * 0.8);
  expect(result.current).toBeLessThan(200 + 800 * 0.95);
  await wait(500);
  expect(result.current).toBe(1000);
});

test('a count-up defaults to 900 ms from zero', async () => {
  const { result } = renderHook(() => useCountUp(100));
  expect(result.current).toBe(0);
  await wait(450);
  expect(result.current).toBeGreaterThan(80);
  expect(result.current).toBeLessThan(100);
  await wait(500);
  expect(result.current).toBe(100);
});

test('a count-up jumps to its target at once only where motion is reduced', async () => {
  const { result } = renderHook(() => useCountUp(500, { from: 10 }), { wrapper: still });
  expect(result.current).toBe(500);
  const free = renderHook(() => useCountUp(500, { from: 10 }));
  expect(free.result.current).toBe(10);
});

// ---------------------------------------------------------------------------------------------------------------
// The rest of the web's motion. What each effect looks like at a step is held to the stylesheet in motion.test.ts;
// here each one is played: how long it runs, what it shows before and after, and how it is delayed.

const PLAYED = [
  ['paper', usePaper, 800],
  ['legend', useLegend, 700],
  ['medal', useMedal, 900],
  ['fly', useFly, 700],
  ['fall', useFall, 1600],
  ['reveal', useReveal, 500],
  ['tear', useTear, 900],
  ['page', usePageTurn, 1500],
  ['light', useLight, 300],
  ['spark', useSpark, 600],
] as const;

test.each(PLAYED)('%s runs once, for its stylesheet duration, and stops', (name, hook, ms) => {
  expect(KEYFRAMES[name].ms).toBe(ms);
  render(<Probe hook={hook} opts={{ play: true, dx: 10, dy: 20 }} />);
  expect(rea.assigned).toEqual([{ kind: 'timing', to: 1, duration: ms, reps: undefined }]);
});

const LOOPED = [
  ['glint', useGlint, 3600],
  ['alarm', useAlarm, 1200],
] as const;

test.each(LOOPED)('%s loops for ever over its stylesheet duration', (name, hook, ms) => {
  expect(KEYFRAMES[name].loop).toBe(true);
  render(<Probe hook={hook} opts={{ play: true }} />);
  expect(rea.assigned).toEqual([{ kind: 'repeat', to: 1, duration: ms, reps: -1 }]);
});

test('a medal waits as its first frame (fill both), spins in, and holds its last', async () => {
  const { container } = render(<Probe hook={useMedal} opts={{ play: false }} />);
  expect(look(container).opacity).toBe('0');
  expect(look(container).transform).toContain('scale(0.2)');
  expect(look(container).transform).toContain('scaleX(1)');
  const { container: played } = render(<Probe hook={useMedal} opts={{ play: true }} />);
  await wait(901);
  expect(look(played).opacity).toBe('1');
  // 720 degrees is two whole turns: square on again
  expect(look(played).transform).toContain('scaleX(1)');
  expect(look(played).transform).toContain('scale(1)');
});

test('confetti holds where it landed (fill forwards) and shows nothing of itself before it starts', async () => {
  const { container } = render(<Probe hook={useFall} opts={{ play: true, delayMs: 100 }} />);
  // a start delay with no backwards fill leaves the element as it is
  expect(look(container).opacity).toBe('1');
  expect(look(container).transform).toContain('translateY(0');
  await wait(1701);
  expect(look(container).opacity).toBe('0');
  expect(look(container).transform).toContain('translateY(340px)');
  expect(look(container).transform).toContain('rotate(360deg)');
});

test('a delay is waited out inside the one run: it starts before zero, and the run is as long as the delay and the effect', async () => {
  const { container } = render(<Probe hook={useLight} opts={{ play: true, delayMs: 250 }} />);
  expect(rea.assigned).toEqual([{ kind: 'timing', to: 1, duration: 550, reps: undefined }]);
  // light is `both`: its first frame while it waits
  expect(look(container).opacity).toBe('0.25');
  await wait(549);
  expect(look(container).opacity).toBe('0.25');
  await wait(2);
  expect(look(container).opacity).toBe('1');
  expect(look(container).transform).toContain('scale(1)');
});

test('no delay, no negative start: the effect is on its first frame at once, as before', () => {
  const { container } = render(<Probe hook={useRise} opts={{ play: true }} />);
  expect(rea.assigned[0].delay).toBeUndefined();
  expect(look(container).opacity).toBe('0');
});

test('a looping effect with a delay waits once and then loops without waiting again', () => {
  render(<Probe hook={useAlarm} opts={{ play: true, delayMs: 300 }} />);
  expect(rea.assigned).toEqual([{ kind: 'repeat', to: 1, duration: 1200, reps: -1, delay: 300 }]);
});

test('once: a glint that crosses a single time shows the box\'s own state outside the run, which a caller can name', async () => {
  const { container } = render(<Probe hook={useGlint} opts={{ play: true, once: true, rest: { opacity: 0 } }} />);
  expect(rea.assigned).toEqual([{ kind: 'timing', to: 1, duration: 3600, reps: undefined }]);
  await wait(3601);
  // after its end: not looping, and its own opacity, not the 1 of an element left alone
  expect(look(container).opacity).toBe('0');
});

test('a coin and a spark go where they are sent, and a coin is gone by the end but holds the place it landed', async () => {
  const { container: coin } = render(<Probe hook={useFly} opts={{ play: true, dx: 40, dy: -30 }} />);
  expect(look(coin).opacity).toBe('0');
  expect(look(coin).transform).toContain('scale(0.6)');
  await wait(701);
  expect(look(coin).opacity).toBe('0');
  expect(look(coin).transform).toContain('translateX(40px)');
  expect(look(coin).transform).toContain('translateY(-30px)');
  expect(look(coin).transform).toContain('scale(0.7)');
  const { container: spark } = render(<Probe hook={useSpark} opts={{ play: true, dx: -12, dy: 9 }} />);
  expect(look(spark).opacity).toBe('1');
  await wait(601);
  expect(look(spark).opacity).toBe('0');
  expect(look(spark).transform).toContain('translateX(-12px)');
  expect(look(spark).transform).toContain('translateY(9px)');
});

test('the new page turns up, the torn one falls away, the picture is uncovered, the paper lands', async () => {
  const { container: paper } = render(<Probe hook={usePaper} opts={{ play: true }} />);
  expect(look(paper).opacity).toBe('0');
  expect(look(paper).transform).toContain('rotate(-540deg)');
  await wait(801);
  expect(look(paper).opacity).toBe('1');
  expect(look(paper).transform).toContain('rotate(0deg)');
  const { container: tear } = render(<Probe hook={useTear} opts={{ play: true }} />);
  await wait(901);
  expect(look(tear).transform).toContain('translateY(140%)');
  expect(look(tear).transform).toContain('rotate(16deg)');
  const { container: reveal } = render(<Probe hook={useReveal} opts={{ play: true }} />);
  expect(look(reveal).width).toBe('0%');
  await wait(501);
  expect(look(reveal).width).toBe('100%');
  // (react-native-web has no matrix to show in a style, so the card's style is read as the hook gives it)
  const legend = renderHook(() => useLegend({ play: true }));
  const matrix = () => (legend.result.current as unknown as { transform: Array<{ matrix: number[] }> }).transform[0].matrix;
  // turned over, flat: the back of the card, small, its width squeezed to the opposite of itself
  expect(matrix()[0]).toBeCloseTo(-0.6, 9);
  expect(matrix()[5]).toBe(0.6);
  await wait(701);
  expect(matrix()).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const { container: page } = render(<Probe hook={usePageTurn} opts={{ play: true }} />);
  expect(look(page).opacity).toBe('0');
  await wait(1501);
  expect(look(page).opacity).toBe('0');
  expect(look(page).transform).toContain('scale(1)');
});

test('the glint and the alarm rest on their first frame where motion is left out, and are not played', () => {
  const alarm = render(<Probe hook={useAlarm} />, { wrapper: still });
  expect(look(alarm.container).opacity).toBe('1');
  expect(rea.assigned).toEqual([]);
});

test('with reduced motion a medal and the confetti are at their end at once, and a delay is not waited', async () => {
  const { container } = render(<Probe hook={useMedal} opts={{ delayMs: 500 }} />, { wrapper: still });
  expect(look(container).opacity).toBe('1');
  expect(look(container).transform).toContain('scaleX(1)');
  const fall = render(<Probe hook={useFall} opts={{ delayMs: 500 }} />, { wrapper: still });
  expect(look(fall.container).opacity).toBe('0');
  expect(rea.assigned).toEqual([]);
});

test('the rainbow is a position, not a style: how far its background has slid, in percent of the box, looping over four seconds', () => {
  const { result } = renderHook(() => useHolo());
  expect(rea.assigned).toEqual([{ kind: 'repeat', to: 1, duration: 4000, reps: -1 }]);
  expect(result.current.value).toBe(0);
  // not played, it is where it began; with a delay it is held there until the delay is out
  rea.assigned.length = 0;
  const waiting = renderHook(() => useHolo({ delayMs: 200 }));
  expect(rea.assigned).toEqual([{ kind: 'repeat', to: 1, duration: 4000, reps: -1, delay: 200 }]);
  expect(waiting.result.current.value).toBe(0);
});

test('the rainbow under reduced motion stands where it began and is not played', () => {
  const { result } = renderHook(() => useHolo(), { wrapper: still });
  expect(result.current.value).toBe(0);
  expect(rea.assigned).toEqual([]);
});
