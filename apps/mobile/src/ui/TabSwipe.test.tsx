// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ReducedMotionProvider } from './animations';
import { HapticProvider } from './haptic';
import type { Haptic } from './haptic';
import { TabSwipe } from './TabSwipe';
import { ENTER_MS, LEAVE_MS } from './tabTurn';
import { gestures } from './testing/gestures';
import { rea } from './testing/reanimated';

// Reanimated needs the worklets runtime, and the gesture handler its native side: their stand-ins.
vi.mock('react-native-reanimated', async () => (await import('./testing/reanimated')).reanimatedFake());
vi.mock('react-native-gesture-handler', async () => (await import('./testing/gestures')).gestureFake());
// The phone asks for no less motion (react-native-web reads the browser's, which jsdom answers as asking for it).
vi.mock('react-native', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('react-native-web')),
  AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(false), addEventListener: () => ({ remove() {} }) },
}));

/*
 * A panel of tabs swiped sideways (TabSwipe.tsx), driven as the gesture handler would drive its pan. jsdom lays nothing out, so the panel's width is
 * never known here: a flick turns it (a quarter of its width is tabTurn.test.ts's).
 */

beforeEach(() => {
  vi.useFakeTimers();
  rea.assigned.length = 0;
  gestures.pans.length = 0;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const TABS = ['portfolio', 'market', 'property'] as const;
type Tab = (typeof TABS)[number];
const moves: Tab[] = [];

function Strip({ start = 'portfolio' as Tab }: { start?: Tab }) {
  const [tab, setTab] = useState<Tab>(start);
  return (
    <>
      <button type="button" onClick={() => setTab('property')}>
        property
      </button>
      <TabSwipe
        tabs={TABS}
        value={tab}
        onChange={(next) => {
          moves.push(next);
          setTab(next);
        }}
      >
        <span>{`panel ${tab}`}</span>
      </TabSwipe>
    </>
  );
}

function feeling(ui: React.ReactElement) {
  const felt: Haptic[] = [];
  render(<HapticProvider value={(kind) => void felt.push(kind)}>{ui}</HapticProvider>);
  return felt;
}

type Pan = { onActivate?: () => void; onUpdate?: (event: object) => void; onDeactivate?: (event: object) => void };
const pan = () => gestures.pans.at(-1) as unknown as Pan;
const wait = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
/** A swipe: taken, moved to `x`, let go there at `velocity`. */
function swipe(x: number, velocity: number) {
  act(() => {
    pan().onActivate?.();
    pan().onUpdate?.({ translationX: x, velocityX: velocity });
  });
  act(() => pan().onDeactivate?.({ translationX: x, velocityX: velocity }));
}

afterEach(() => void (moves.length = 0));

test('swiped is a pan of its own that waits for a clear sideways move, and gives way to the page\'s scroll up or down', () => {
  feeling(<Strip />);
  const config = gestures.pans.at(-1) as unknown as { activeOffsetX: number[]; failOffsetY: number[] };
  expect(config.activeOffsetX).toEqual([-14, 14]);
  expect(config.failOffsetY).toEqual([-10, 10]);
});

test('flicked to the left, the panel leaves and the next tab comes, felt as a choice taken; to the right, the one before', async () => {
  const felt = feeling(<Strip />);
  swipe(-60, -900);
  expect(rea.assigned.at(-1)).toMatchObject({ kind: 'timing', duration: LEAVE_MS });
  await wait(LEAVE_MS + 1);
  expect(moves).toEqual(['market']);
  expect(felt).toEqual(['select']);
  expect(screen.getByText('panel market')).toBeTruthy();
  // Never measured here, the new tab stands at its rest (a laid-out one comes in from the side it was swiped from).
  expect(rea.assigned.filter((one) => one.duration === ENTER_MS)).toEqual([]);
  swipe(60, 900);
  await wait(LEAVE_MS + 1);
  expect(moves).toEqual(['market', 'portfolio']);
});

test('let go slowly short of turning, it goes back and nothing changes; past the last tab it only gives a little', async () => {
  const felt = feeling(<Strip start="property" />);
  swipe(40, 0);
  expect(rea.assigned.at(-1)).toMatchObject({ kind: 'spring', to: 0 });
  swipe(-400, -2000);
  expect(rea.assigned.at(-1)).toMatchObject({ kind: 'spring', to: 0 });
  await wait(1000);
  expect(moves).toEqual([]);
  expect(felt).toEqual([]);
});

test('a tab chosen in the strip comes in from its side too', () => {
  feeling(<Strip />);
  rea.assigned.length = 0;
  act(() => screen.getByRole('button', { name: 'property' }).click());
  expect(screen.getByText('panel property')).toBeTruthy();
  // Never measured here: it stands in its place at once (a laid-out panel comes in from the right).
  expect(rea.assigned.filter((one) => one.duration === ENTER_MS)).toEqual([]);
});

test('under reduced motion a flick turns the tab at once, nothing sliding', async () => {
  const felt = feeling(
    <ReducedMotionProvider value>
      <Strip />
    </ReducedMotionProvider>,
  );
  swipe(-60, -900);
  await wait(0);
  expect(moves).toEqual(['market']);
  expect(felt).toEqual(['select']);
  expect(rea.assigned.some((one) => one.duration === LEAVE_MS || one.duration === ENTER_MS)).toBe(false);
});
