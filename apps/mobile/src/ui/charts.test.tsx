// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { barRects } from './chartGeometry';
import { COLORS } from './theme';

vi.mock('@shopify/react-native-skia', async () => (await import('./testing/skia')).skiaFake());

const { drawn } = await import('./testing/skia');
const { Bars, LineChart, barRects: reBarRects, fitScale: reFitScale, lineGeometry: reLineGeometry } = await import('./charts');
const geometry = await import('./chartGeometry');

afterEach(cleanup);

test('the geometry is the pure module\'s, re-exported: the phone and the web export draw from the same numbers', () => {
  expect([reBarRects, reFitScale, reLineGeometry]).toEqual([geometry.barRects, geometry.fitScale, geometry.lineGeometry]);
});

test('LineChart draws, in order, the area at 15 %, the dashed baseline, the 2 point line with round joins, and the end dot, smooth as the web\'s svg', () => {
  const { container } = render(<LineChart points={[1, 1.2, 0.9, 1.5]} tone="teal" label="Price" />);
  const canvas = container.querySelector('[data-skia="Canvas"]')!;
  expect(canvas.getAttribute('data-size')).toBe('280x90');
  const kinds = Array.from(canvas.querySelectorAll('[data-skia]')).map((n) => n.getAttribute('data-skia'));
  expect(kinds).toEqual(['Group', 'Path', 'Line', 'DashPathEffect', 'Path', 'Circle']);
  const [area, line] = drawn(container, 'Path');
  expect(area).toMatchObject({ path: 'M6.0 71.0 L95.3 45.0 L184.7 84.0 L274.0 6.0 L274.0 71.0 L6.0 71.0 Z', color: COLORS['teal-300'], opacity: 0.15 });
  expect(line).toMatchObject({ path: 'M6.0 71.0 L95.3 45.0 L184.7 84.0 L274.0 6.0', style: 'stroke', strokeWidth: 2, strokeJoin: 'round', color: COLORS['teal-300'] });
  const [base] = drawn(container, 'Line');
  expect(base).toMatchObject({ p1: { x: 6, y: 71 }, p2: { x: 274, y: 71 }, style: 'stroke', strokeWidth: 1, color: COLORS['ink-500'] });
  expect(drawn(container, 'DashPathEffect')[0]).toMatchObject({ intervals: [3, 3] });
  expect(drawn(container, 'Circle')[0]).toMatchObject({ cx: 274, cy: 6, r: 3.5, color: COLORS['teal-300'] });
});

test('a wine chart is wine all through; the chart is named for a screen reader and the picture is not read', () => {
  const { container } = render(<LineChart points={[1, 0.8]} tone="wine" label="Price since the start" />);
  for (const kind of ['Path', 'Circle']) for (const p of drawn(container, kind)) expect(p.color).toBe(COLORS['wine-300']);
  const image = container.querySelector('[role="img"]')!;
  expect(image.getAttribute('aria-label')).toBe('Price since the start');
});

test('the drawing is the viewBox scaled to the room: a transform on the whole of it', () => {
  const { container } = render(<LineChart points={[1, 1.5]} tone="teal" width={280} height={90} />);
  expect(drawn(container, 'Group')[0]).toMatchObject({ transform: [{ scale: 1 }] });
});

test('a life with no rounds yet draws no line', () => {
  const { container } = render(<LineChart points={[]} tone="teal" />);
  expect(drawn(container, 'Path')).toEqual([]);
  expect(drawn(container, 'Circle')).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------

const WORTH = {
  zero: 0.7,
  bars: [
    { y: 0.7, h: 0, negative: false },
    { y: 0.69, h: 0.01, negative: false },
    { y: 0.5, h: 0.2, negative: false },
    { y: 0.7, h: 0.15, negative: true },
    { y: 0.1, h: 0.6, negative: false },
  ],
};

test('Bars draw each as a rect on a canvas of the graph\'s size, crisp, in the palette', () => {
  const { container } = render(<Bars {...WORTH} label="Net worth" />);
  const canvas = container.querySelector('[data-skia="Canvas"]')!;
  expect(canvas.getAttribute('data-size')).toBe('66x96');
  const rects = drawn(container, 'Rect');
  const r = barRects(WORTH);
  expect(rects).toHaveLength(r.rects.length);
  expect(rects[0]).toEqual({ x: 14, y: r.rects[0].y, width: 10, height: 2, color: COLORS['gold-500'], antiAlias: false });
  expect(rects.at(-1)).toEqual({ x: 0, y: r.rects.at(-1)!.y, width: 66, height: 1, color: COLORS['ink-300'], antiAlias: false });
  const image = container.querySelector('[role="img"]')!;
  expect(image.getAttribute('aria-label')).toBe('Net worth');
});
