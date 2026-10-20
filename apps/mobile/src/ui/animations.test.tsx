// @vitest-environment jsdom
import { act, cleanup, render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import Animated from 'react-native-reanimated';
import { ReducedMotionProvider, refreshSystemMotion, useBlink, useCountUp, usePop, useReducedMotion, useRise, useSink } from './animations';

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

// Reanimated's own `mock` ships as TypeScript source that does not load here, and the real library needs the
// worklets runtime: this models what the hooks use. A shared value is reactive (writing it re-reads every
// animated style), an animation assigned to it is recorded and lands on its target when its duration has run
// (on fake timers), and `cancelAnimation` is recorded and stops it. The frames themselves are pinned in motion.test.ts.
const rea = vi.hoisted(() => ({
  assigned: [] as { kind: 'timing' | 'repeat'; to: number; duration: number; reps?: number }[],
  cancelled: 0,
  listeners: new Set<() => void>(),
}));

vi.mock('react-native-reanimated', async () => {
  const { useRef, useReducer, useEffect } = await import('react');
  const { View } = await import('react-native');
  type Anim = { __anim: true; kind: 'timing' | 'repeat'; to: number; duration: number; reps?: number };
  const emit = () => rea.listeners.forEach((l) => l());
  return {
    default: { View },
    useSharedValue: <T,>(init: T) => {
      const box = useRef<{ raw: unknown; timer?: ReturnType<typeof setTimeout>; sv: { value: unknown } } | null>(null);
      if (!box.current) {
        const b: { raw: unknown; timer?: ReturnType<typeof setTimeout>; sv: { value: unknown } } = { raw: init, sv: { value: init } };
        Object.defineProperty(b.sv, 'value', {
          get: () => b.raw,
          set: (v) => {
            clearTimeout(b.timer);
            if (v && typeof v === 'object' && (v as Anim).__anim) {
              const a = v as Anim;
              rea.assigned.push({ kind: a.kind, to: a.to, duration: a.duration, reps: a.reps });
              b.timer = setTimeout(() => {
                b.raw = a.to;
                emit();
              }, a.duration);
            } else {
              b.raw = v;
            }
            emit();
          },
        });
        (b.sv as { timer?: () => void }).timer = () => clearTimeout(b.timer);
        box.current = b;
      }
      return box.current.sv as { value: T };
    },
    useAnimatedStyle: (fn: () => object) => {
      const [, bump] = useReducer((n: number) => n + 1, 0);
      useEffect(() => {
        rea.listeners.add(bump);
        return () => void rea.listeners.delete(bump);
      }, []);
      return fn();
    },
    withTiming: (to: number, cfg: { duration: number }): Anim => ({ __anim: true, kind: 'timing', to, duration: cfg.duration }),
    withRepeat: (inner: Anim, reps: number): Anim => ({ ...inner, kind: 'repeat', reps }),
    cancelAnimation: (sv: { timer?: () => void }) => {
      rea.cancelled += 1;
      sv.timer?.();
    },
    Easing: { linear: (t: number) => t },
  };
});

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

type Opts = { play?: boolean; reduced?: boolean };

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
