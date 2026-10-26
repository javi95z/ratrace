// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ReducedMotionProvider } from './animations';
import { HapticProvider, type Haptic } from './haptic';
import { CLOSE_MS, LEAVE_MS } from './rowSwipe';
import { SwipeAway } from './SwipeAway';
import { gestures } from './testing/gestures';
import { rea } from './testing/reanimated';

// onLayout is the phone's to send: the test sends it, to the View that asks for one.
type Layout = (event: { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } }) => void;
const layouts = vi.hoisted(() => [] as Layout[]);
vi.mock('react-native-reanimated', async () => (await import('./testing/reanimated')).reanimatedFake());
vi.mock('react-native-gesture-handler', async () => (await import('./testing/gestures')).gestureFake());
// The phone asks for no less motion (react-native-web reads the browser's, which jsdom answers as asking for it).
vi.mock('react-native', async () => {
  const rn = await vi.importActual<typeof import('react-native')>('react-native-web');
  return {
    ...rn,
    AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(false), addEventListener: () => ({ remove() {} }) },
    View: (props: Record<string, unknown>) => {
      if (typeof props.onLayout === 'function') layouts.push(props.onLayout as Layout);
      return <rn.View {...props} />;
    },
  };
});

/* A row of a list swiped to the left to take it away (SwipeAway.tsx), driven as the gesture handler would drive its pan. */

beforeEach(() => {
  vi.useFakeTimers();
  rea.assigned.length = 0;
  gestures.pans.length = 0;
  layouts.length = 0;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const gone: string[] = [];
afterEach(() => void (gone.length = 0));

function row(ui = <SwipeAway label="Remove" gap={8} onAway={() => gone.push('rent')}><span>rent</span></SwipeAway>) {
  const felt: Haptic[] = [];
  render(<HapticProvider value={(kind) => void felt.push(kind)}>{ui}</HapticProvider>);
  // Laid out 400 wide and 52 high, as a phone lays the basket's row.
  act(() => layouts.at(-1)?.({ nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 52 } } }));
  return felt;
}

type Pan = { activeOffsetX: number[]; failOffsetY: number[]; onActivate?: () => void; onUpdate?: (event: object) => void; onDeactivate?: (event: object) => void };
const pan = () => gestures.pans.at(-1) as unknown as Pan;
const wait = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
/** Taken, moved to each of `xs` in turn, let go at the last at `velocity`. */
function swipe(xs: number[], velocity: number) {
  act(() => {
    pan().onActivate?.();
    for (const x of xs) pan().onUpdate?.({ translationX: x, velocityX: velocity });
  });
  act(() => pan().onDeactivate?.({ translationX: xs.at(-1), velocityX: velocity }));
}

test('swiped is a pan of its own that waits for a clear sideways move, and gives way to the scroll up or down', () => {
  row();
  expect(pan().activeOffsetX).toEqual([-14, 14]);
  expect(pan().failOffsetY).toEqual([-10, 10]);
});

test('dragged past four tenths of its width it is felt once, and let go there it leaves, its place closes, and only then is it taken out', async () => {
  const felt = row();
  swipe([-100, -170, -200], 0);
  expect(rea.assigned.at(-1)).toMatchObject({ kind: 'timing', to: -400, duration: LEAVE_MS });
  await wait(LEAVE_MS + 1);
  expect(felt).toEqual(['threshold']);
  expect(rea.assigned.at(-1)).toMatchObject({ kind: 'timing', to: 0, duration: CLOSE_MS });
  expect(gone).toEqual([]);
  await wait(CLOSE_MS + 1);
  expect(gone).toEqual(['rent']);
});

test('let go short of the line it springs back and stays; a flick takes it however short; a flick back keeps it', async () => {
  const felt = row();
  swipe([-100], 0);
  expect(rea.assigned.at(-1)).toMatchObject({ kind: 'spring', to: 0 });
  swipe([-200], 900);
  expect(rea.assigned.at(-1)).toMatchObject({ kind: 'spring', to: 0 });
  await wait(1000);
  expect(gone).toEqual([]);
  // Crossed and crossed back: felt each time it crosses into it.
  expect(felt).toEqual(['threshold']);
  swipe([-40], -1200);
  await wait(LEAVE_MS + CLOSE_MS + 2);
  expect(gone).toEqual(['rent']);
});

test('to the right it only gives a little, and nothing happens', async () => {
  row();
  swipe([300], 2000);
  expect(rea.assigned.at(-1)).toMatchObject({ kind: 'spring', to: 0 });
  await wait(1000);
  expect(gone).toEqual([]);
});

test('under reduced motion a swipe past the line takes it out at once, nothing sliding', async () => {
  row(
    <ReducedMotionProvider value>
      <SwipeAway label="Remove" onAway={() => gone.push('rent')}>
        <span>rent</span>
      </SwipeAway>
    </ReducedMotionProvider>,
  );
  swipe([-300], 0);
  await wait(0);
  expect(gone).toEqual(['rent']);
  expect(rea.assigned.some((one) => one.duration === LEAVE_MS || one.duration === CLOSE_MS)).toBe(false);
});

test('the band behind it says what letting go does, and is hidden from a screen reader (the row keeps its own button)', () => {
  row();
  expect(screen.getByText('Remove')).toBeTruthy();
  expect(screen.getByText('rent')).toBeTruthy();
});
