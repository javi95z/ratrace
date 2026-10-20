// @vitest-environment jsdom
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import Animated from 'react-native-reanimated';
import { ReducedMotionProvider, useBlink, useCountUp, usePop, useReducedMotion, useRise } from './animations';

// Reanimated's own `mock` ships as TypeScript source that does not load here, and the real library needs
// the worklets runtime: this stands in for the few calls the hooks make. A shared value is a plain box,
// a style is read once at render, and an animation is its target (the frame logic is pinned in motion.test.ts).
vi.mock('react-native-reanimated', async () => {
  const { useRef } = await import('react');
  const { View } = await import('react-native');
  return {
    default: { View },
    useSharedValue: <T,>(init: T) => useRef({ value: init }).current,
    useAnimatedStyle: (fn: () => object) => fn(),
    withTiming: (to: number) => to,
    withRepeat: (a: number) => a,
    cancelAnimation: () => {},
    Easing: { linear: (t: number) => t },
  };
});

afterEach(cleanup);

function Probe({ hook }: { hook: () => object }) {
  const style = hook();
  return <Animated.View testID="probe" style={style} />;
}

function styleOf(hook: () => object) {
  const { container } = render(
    <ReducedMotionProvider value={true}>
      <Probe hook={hook} />
    </ReducedMotionProvider>,
  );
  return (container.firstElementChild as HTMLElement).style;
}

test('with reduced motion useRise starts at its end state', () => {
  const s = styleOf(() => useRise());
  expect(s.opacity).toBe('1');
  expect(s.transform).toContain('translateY(0');
});

test('with reduced motion a pop stands at its rest', () => {
  const s = styleOf(() => usePop());
  expect(s.opacity).toBe('1');
});

test('with reduced motion a blink stands shown', () => {
  const s = styleOf(() => useBlink());
  expect(s.opacity).toBe('1');
});

test('the game setting reduces motion, and the OS alone does not need a provider', () => {
  expect(renderHook(() => useReducedMotion(true)).result.current).toBe(true);
  expect(renderHook(() => useReducedMotion()).result.current).toBe(false);
  const wrapper = ({ children }: { children: React.ReactNode }) => <ReducedMotionProvider value={true}>{children}</ReducedMotionProvider>;
  expect(renderHook(() => useReducedMotion(), { wrapper }).result.current).toBe(true);
});

test('a count-up stands at its target at once under reduced motion', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => <ReducedMotionProvider value={true}>{children}</ReducedMotionProvider>;
  const { result } = renderHook(() => useCountUp(500), { wrapper });
  expect(result.current).toBe(500);
});

test('a count-up begins at zero and arrives at its target', async () => {
  const { result } = renderHook(() => useCountUp(100, 60));
  expect(result.current).toBe(0);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 250));
  });
  expect(result.current).toBe(100);
});

test('without reduced motion useRise starts at its first frame, waiting to climb', () => {
  const { container } = render(<Probe hook={() => useRise()} />);
  const s = (container.firstElementChild as HTMLElement).style;
  expect(s.opacity).toBe('0');
  expect(s.transform).toContain('translateY(8px)');
});

test('a rise that is not played yet holds its first frame (backwards fill)', () => {
  const { container } = render(<Probe hook={() => useRise({ play: false })} />);
  expect((container.firstElementChild as HTMLElement).style.opacity).toBe('0');
});
