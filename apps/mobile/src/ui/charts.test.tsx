// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { COLORS } from './theme';

vi.mock('@shopify/react-native-skia', async () => (await import('./testing/skia')).skiaFake());

const { drawn } = await import('./testing/skia');
const { Bars, LineChart, barRects, fitScale, lineGeometry } = await import('./charts');

afterEach(cleanup);

/** The web's PriceChart (Finance.tsx), line for line, to hold the geometry to: a 280 x 90 box, 6 in from each side. */
function webPriceChart(values: number[]) {
  const w = 280;
  const h = 90;
  const pad = 6;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 1);
  const span = max - min || 1;
  const x = (i: number) => (values.length > 1 ? pad + (i * (w - pad * 2)) / (values.length - 1) : w / 2);
  const y = (value: number) => pad + (1 - (value - min) / span) * (h - pad * 2);
  const last = values[values.length - 1] ?? 1;
  const line = values.map((value, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(value).toFixed(1)}`).join(' ');
  const base = y(1);
  const area = `${line} L${x(values.length - 1).toFixed(1)} ${base.toFixed(1)} L${x(0).toFixed(1)} ${base.toFixed(1)} Z`;
  return { line, area, base, end: { x: x(values.length - 1), y: y(last) } };
}

test('the line, the area under it and the baseline are the web\'s, written out: four rounds, up and down and up', () => {
  const g = lineGeometry([1, 1.2, 0.9, 1.5]);
  expect(g.line).toBe('M6.0 71.0 L95.3 45.0 L184.7 84.0 L274.0 6.0');
  expect(g.area).toBe('M6.0 71.0 L95.3 45.0 L184.7 84.0 L274.0 6.0 L274.0 71.0 L6.0 71.0 Z');
  expect(g.base).toBe(71);
  expect(g.end).toEqual({ x: 274, y: 6 });
});

test('the same as the web\'s PriceChart for a rise, a fall, a flat line, one round, two, and a long life', () => {
  const lives = [
    [1, 1.1, 1.3, 1.25, 1.6],
    [1, 0.9, 0.7, 0.8, 0.4],
    [1, 1, 1, 1],
    [1],
    [1, 2],
    Array.from({ length: 30 }, (_, i) => 1 + Math.sin(i / 3) * 0.4 + i * 0.01),
  ];
  for (const values of lives) {
    const web = webPriceChart(values);
    const g = lineGeometry(values);
    expect(g.line, String(values)).toBe(web.line);
    expect(g.area, String(values)).toBe(web.area);
    expect(g.base, String(values)).toBeCloseTo(web.base, 9);
    expect(g.end.x).toBeCloseTo(web.end.x, 9);
    expect(g.end.y).toBeCloseTo(web.end.y, 9);
  }
});

test('the box can be told: the chart is drawn in the viewBox it is given, 6 in from each side', () => {
  const g = lineGeometry([1, 2], 100, 50);
  expect(g.line).toBe('M6.0 44.0 L94.0 6.0');
  expect(g.end).toEqual({ x: 94, y: 6 });
});

test('a chart fills the width it has, as the web\'s svg does: its scale is the room over its own width, one until it is measured', () => {
  expect(fitScale(null, 280)).toBe(1);
  expect(fitScale(0, 280)).toBe(1);
  expect(fitScale(350, 280)).toBe(1.25);
  expect(fitScale(140, 280)).toBe(0.5);
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

/** The web's WorthGraph (WorthGraph.tsx), line for line. */
function webWorthGraph(zero: number, bars: Array<{ y: number; h: number; negative: boolean }>, height = 96) {
  const BAR = 10;
  const STEP = 14;
  const width = Math.max(BAR, bars.length * STEP - (STEP - BAR));
  const line = Math.min(height - 1, Math.round(zero * height));
  const last = bars.length - 1;
  const rects = bars.map((bar, i) => {
    const tall = bar.h > 0 ? Math.max(2, Math.round(bar.h * height)) : 0;
    const top = bar.negative ? line : Math.min(Math.round(bar.y * height), line - tall);
    return { x: i * STEP, y: Math.max(0, top), w: BAR, h: tall, fill: bar.negative ? 'wine-500' : i === last ? 'gold-200' : 'gold-500' };
  });
  return { width, rects, line };
}

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

test('Bars are the web\'s rects: ten wide every fourteen, never thinner than two where they stand for something, the last one lighter', () => {
  const r = barRects(WORTH);
  const web = webWorthGraph(WORTH.zero, WORTH.bars);
  expect(r.width).toBe(web.width);
  expect(r.width).toBe(5 * 14 - 4);
  expect(r.height).toBe(96);
  // a bar of nothing is not drawn; the others are the web's, in order
  expect(r.rects.filter((b) => b.kind === 'bar').map(({ x, y, w, h, color }) => ({ x, y, w, h, fill: color }))).toEqual(web.rects.filter((b) => b.h > 0).map(({ x, y, w, h, fill }) => ({ x, y, w, h, fill })));
  // the thin one is two, the debt hangs from the zero line in wine, the last is gold-200
  const bars = r.rects.filter((b) => b.kind === 'bar');
  expect(bars[0]).toMatchObject({ x: 14, h: 2, color: 'gold-500' });
  expect(bars[2]).toMatchObject({ x: 42, color: 'wine-500', y: web.line });
  expect(bars[3]).toMatchObject({ x: 56, color: 'gold-200' });
  // and the zero line across the graph, one point thick, in ink-300
  expect(r.rects.at(-1)).toEqual({ kind: 'zero', x: 0, y: web.line, w: web.width, h: 1, color: 'ink-300' });
});

test('a graph of one round is one bar wide, and the zero line never leaves the graph', () => {
  const r = barRects({ zero: 1, bars: [{ y: 0, h: 1, negative: false }], height: 40 });
  expect(r.width).toBe(10);
  expect(r.rects.at(-1)).toMatchObject({ kind: 'zero', y: 39 });
  expect(barRects({ zero: 0.5, bars: [], height: 40 }).width).toBe(10);
});

test('a smaller graph is the same graph in less height', () => {
  const web = webWorthGraph(WORTH.zero, WORTH.bars, 48);
  const r = barRects({ ...WORTH, height: 48 });
  expect(r.height).toBe(48);
  expect(r.rects.filter((b) => b.kind === 'bar').map((b) => [b.x, b.y, b.h])).toEqual(web.rects.filter((b) => b.h > 0).map((b) => [b.x, b.y, b.h]));
});

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
