// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ReducedMotionProvider } from './animations';
import { COLORS, EXTRA } from './theme';

vi.mock('@shopify/react-native-skia', async () => (await import('./testing/skia')).skiaFake());
vi.mock('react-native-reanimated', async () => (await import('./testing/reanimated')).reanimatedFake());
// react-native-web answers "reduced" where there is no `matchMedia`: the phone's setting here is "off".
vi.mock('react-native', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('react-native-web')),
  AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(false), addEventListener: () => ({ remove: () => {} }) },
}));

const { Canvas } = await import('@shopify/react-native-skia');
const { drawn } = await import('./testing/skia');
const { rea } = await import('./testing/reanimated');
const { Glint, Holo, HOLO_COLORS, holoGradient } = await import('./Shine');

beforeEach(() => {
  rea.assigned.length = 0;
});
afterEach(cleanup);

test('the rainbow is the web\'s linear-gradient(110deg, ...) over a box of two cards: its line runs across the box corner to corner', () => {
  const { start, end } = holoGradient(576, 120);
  // CSS: the line's length is |w sin a| + |h cos a|, centred on the box, pointing right and a little down at 110 degrees
  const length = 576 * Math.sin((110 * Math.PI) / 180) + 120 * Math.abs(Math.cos((110 * Math.PI) / 180));
  expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeCloseTo(length, 6);
  expect((start.x + end.x) / 2).toBeCloseTo(288, 6);
  expect((start.y + end.y) / 2).toBeCloseTo(60, 6);
  expect((end.y - start.y) / (end.x - start.x)).toBeCloseTo(-Math.cos((110 * Math.PI) / 180) / Math.sin((110 * Math.PI) / 180), 6);
});

test('its colours are the web\'s: red, gold, green, sky, blue and red again, all from the palette', () => {
  expect(HOLO_COLORS).toEqual([COLORS['wine-500'], COLORS['gold-500'], COLORS['teal-300'], COLORS['sky-300'], COLORS['sky-500'], COLORS['wine-500']]);
  expect(HOLO_COLORS).toEqual(['#d1495b', '#f2c14e', '#7fd1b9', '#9ad1d4', '#3b6ea5', '#d1495b']);
});

test('the rainbow is two gradients, each over two boxes, side by side, blended over the picture as overlay at 40 %', () => {
  const { container } = render(
    <Canvas style={{ width: 288, height: 120 }}>
      <Holo width={288} height={120} held={0.5} />
    </Canvas>,
  );
  const [blend, slide] = drawn(container, 'Group');
  // the web's `opacity-40 mix-blend-overlay`, drawn into the picture's own canvas, where there is something to blend with
  expect(blend).toMatchObject({ blendMode: 'overlay', opacity: 0.4 });
  // held half way: 100 % of the background, a whole box to the left
  expect(slide).toMatchObject({ transform: [{ translateX: -288 }] });
  const rects = drawn(container, 'Rect');
  expect(rects).toEqual([
    { x: 0, y: 0, width: 576, height: 120 },
    { x: 576, y: 0, width: 576, height: 120 },
  ]);
  const gradients = drawn(container, 'LinearGradient');
  const { start, end } = holoGradient(576, 120);
  expect(gradients.map((g) => g.colors)).toEqual([HOLO_COLORS, HOLO_COLORS]);
  expect(gradients[0]).toMatchObject({ start, end });
  expect(gradients[1]).toMatchObject({ start: { x: start.x + 576, y: start.y }, end: { x: end.x + 576, y: end.y } });
});

test('held at the start it has not slid, and at the end two boxes: where it begins again', () => {
  for (const [held, shift] of [[0, 0], [1, -576]] as const) {
    const { container, unmount } = render(
      <Canvas style={{ width: 288, height: 120 }}>
        <Holo width={288} height={120} held={held} />
      </Canvas>,
    );
    expect(drawn(container, 'Group')[1]).toMatchObject({ transform: [{ translateX: shift }] });
    unmount();
  }
});

test('played, the rainbow loops over its four seconds', () => {
  render(
    <Canvas style={{ width: 288, height: 120 }}>
      <Holo width={288} height={120} />
    </Canvas>,
  );
  expect(rea.assigned).toEqual([{ kind: 'repeat', to: 1, duration: 4000, reps: -1 }]);
});

test('it is not drawn where motion is left out', () => {
  const still = render(
    <Canvas style={{ width: 288, height: 120 }}>
      <Holo width={288} height={120} />
    </Canvas>,
    { wrapper: ({ children }: { children: ReactNode }) => <ReducedMotionProvider value={true}>{children}</ReducedMotionProvider> },
  );
  expect(drawn(still.container, 'Group')).toEqual([]);
  expect(rea.assigned).toEqual([]);
});

test('the glint is a white band a fifth of the box wide, from top to bottom, white at 40 %, crossing in 18 steps', () => {
  const { container } = render(<Glint held={0.35} />);
  const band = container.firstElementChild as HTMLElement;
  expect(band.style.position).toBe('absolute');
  expect([band.style.top, band.style.bottom, band.style.left, band.style.width]).toEqual(['0px', '0px', '0px', '20%']);
  expect(band.style.backgroundColor).toBe('rgba(255, 255, 255, 0.4)');
  expect(EXTRA.glint).toBe('rgba(255,255,255,0.4)');
  expect(band.style.pointerEvents).toBe('none');
  // across the whole card (650 % of its own width, on a skew) and still lit
  expect(band.style.transform).toContain('translateX(650%)');
  expect(band.style.transform).toContain('skewX(-20deg)');
  expect(band.style.opacity).toBe('1');
});

test('held before its start the glint stands at the left, off the card; a narrower band is a share of the box', () => {
  const { container } = render(<Glint held={0} share={0.25} />);
  const band = container.firstElementChild as HTMLElement;
  expect(band.style.width).toBe('25%');
  expect(band.style.transform).toContain('translateX(-150%)');
});

test('a glint is not drawn where motion is left out', () => {
  const { container } = render(<Glint />, { wrapper: ({ children }: { children: ReactNode }) => <ReducedMotionProvider value={true}>{children}</ReducedMotionProvider> });
  expect(container.firstElementChild).toBeNull();
});
