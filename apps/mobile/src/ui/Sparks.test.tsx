// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ReducedMotionProvider } from './animations';
import { rea } from './testing/reanimated';
import { COLORS } from './theme';

vi.mock('react-native-reanimated', async () => (await import('./testing/reanimated')).reanimatedFake());
// react-native-web answers "reduced" where there is no `matchMedia`: the phone's setting here is "off".
vi.mock('react-native', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('react-native-web')),
  AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(false), addEventListener: () => ({ remove: () => {} }) },
}));

const { Sparks, sparkReach } = await import('./Sparks');

beforeEach(() => {
  vi.useFakeTimers();
  rea.assigned.length = 0;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const wait = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};
/** The squares of a burst, in order. */
const sparks = (c: HTMLElement) => Array.from((c.firstElementChild as HTMLElement).children) as HTMLElement[];

test('a spark goes out at an angle each: the burst is spread round a circle, and every other one flies a little shorter', () => {
  const reach = sparkReach(4, 20);
  expect(reach).toEqual([
    { dx: 14, dy: 14 },
    { dx: -10, dy: 10 },
    { dx: -14, dy: -14 },
    { dx: 10, dy: -10 },
  ]);
  // the web's own default burst: eight sparks, 28 away
  const eight = sparkReach(8, 28);
  expect(eight).toHaveLength(8);
  expect(Math.hypot(eight[0].dx, eight[0].dy)).toBeCloseTo(28, 0);
  expect(Math.hypot(eight[1].dx, eight[1].dy)).toBeCloseTo(28 * 0.7, 0);
});

test('square pieces at the middle of what they sit on, in the colours in turn, each its size', () => {
  const { container } = render(<Sparks count={4} reach={20} colours={['gold-500', 'cream']} size={4} />);
  const burst = container.firstElementChild as HTMLElement;
  // a point with no size, at the middle of its parent, that takes no touch and is not read out
  expect(burst.style.position).toBe('absolute');
  expect(burst.style.left).toBe('50%');
  expect(burst.style.top).toBe('50%');
  expect(burst.style.width).toBe('0px');
  expect(burst.style.height).toBe('0px');
  expect(burst.style.pointerEvents).toBe('none');
  expect(burst.getAttribute('aria-hidden')).toBe('true');
  const pieces = sparks(container);
  expect(pieces).toHaveLength(4);
  expect(pieces.map((p) => p.style.backgroundColor)).toEqual([COLORS['gold-500'], COLORS.cream, COLORS['gold-500'], COLORS.cream].map(rgb));
  for (const p of pieces) {
    expect([p.style.width, p.style.height, p.style.left, p.style.top, p.style.position]).toEqual(['4px', '4px', '-2px', '-2px', 'absolute']);
  }
});

test('three sizes of wait, 40 ms apart, on top of the burst\'s own, each running 600 ms; the web\'s defaults are eight pieces of 3', () => {
  const { container } = render(<Sparks colours={['gold-500']} delayMs={450} />);
  expect(sparks(container)).toHaveLength(8);
  expect(sparks(container)[0].style.width).toBe('3px');
  expect(rea.assigned.map((a) => a.duration)).toEqual([0, 40, 80, 0, 40, 80, 0, 40].map((d) => 450 + d + 600));
});

test('each piece ends where the burst sent it, gone', async () => {
  const { container } = render(<Sparks count={4} reach={20} colours={['gold-500']} />);
  const pieces = sparks(container);
  expect(pieces[0].style.opacity).toBe('1');
  await wait(700);
  expect(pieces.map((p) => p.style.opacity)).toEqual(['0', '0', '0', '0']);
  expect(pieces[0].style.transform).toContain('translateX(14px)');
  expect(pieces[0].style.transform).toContain('translateY(14px)');
  expect(pieces[1].style.transform).toContain('translateX(-10px)');
  expect(pieces[3].style.transform).toContain('translateY(-10px)');
});

test('where motion is left out nothing is drawn: it is decoration, and only movement', () => {
  const wrapper = ({ children }: { children: ReactNode }) => <ReducedMotionProvider value={true}>{children}</ReducedMotionProvider>;
  const { container } = render(<Sparks colours={['gold-500']} />, { wrapper });
  expect(container.firstElementChild).toBeNull();
  expect(rea.assigned).toEqual([]);
});

test('held, every piece stands at one place of its flight, as the page that compares a frame needs', () => {
  const { container } = render(<Sparks count={4} reach={20} colours={['gold-500']} held={0.5} />);
  const pieces = sparks(container);
  // half way: half the reach, half faded; no piece waiting, and nothing played
  expect(pieces[0].style.opacity).toBe('0.5');
  expect(pieces[0].style.transform).toContain('translateX(7px)');
  expect(pieces[1].style.transform).toContain('translateX(-5px)');
  expect(rea.assigned).toEqual([]);
});
