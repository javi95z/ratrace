// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import * as geometry from './chartGeometry';
import { Bars, LineChart, barRects, fitScale, lineGeometry } from './charts.web';
import { COLORS } from './theme';

afterEach(cleanup);

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

test('the geometry is the pure module\'s, re-exported: the web export draws from the same numbers as the phone', () => {
  expect([barRects, fitScale, lineGeometry]).toEqual([geometry.barRects, geometry.fitScale, geometry.lineGeometry]);
});

test('LineChart is the web\'s svg: the viewBox, the area at 15 %, the dashed baseline, the 2 point line with round joins and the end dot, in the order the Next web draws them', () => {
  const points = [1, 1.2, 0.9, 1.5];
  const { container } = render(<LineChart points={points} tone="teal" label="Price" />);
  const svg = container.querySelector('svg')!;
  expect(svg.getAttribute('viewBox')).toBe('0 0 280 90');
  expect(Array.from(svg.children).map((n) => n.tagName.toLowerCase())).toEqual(['path', 'line', 'path', 'circle']);
  const { line, area, base, end } = lineGeometry(points, 280, 90);
  const [areaPath, linePath] = Array.from(svg.querySelectorAll('path'));
  expect(linePath.getAttribute('d')).toBe(line);
  expect(areaPath.getAttribute('d')).toBe(area);
  expect(areaPath.getAttribute('fill')).toBe(COLORS['teal-300']);
  expect(areaPath.getAttribute('opacity')).toBe('0.15');
  expect(linePath.getAttribute('fill')).toBe('none');
  expect(linePath.getAttribute('stroke')).toBe(COLORS['teal-300']);
  expect(linePath.getAttribute('stroke-width')).toBe('2');
  expect(linePath.getAttribute('stroke-linejoin')).toBe('round');
  const dash = svg.querySelector('line')!;
  expect([dash.getAttribute('x1'), dash.getAttribute('x2'), dash.getAttribute('y1'), dash.getAttribute('y2')]).toEqual(['6', '274', String(base), String(base)]);
  expect(dash.getAttribute('stroke')).toBe(COLORS['ink-500']);
  expect(dash.getAttribute('stroke-dasharray')).toBe('3 3');
  const dot = svg.querySelector('circle')!;
  expect([dot.getAttribute('cx'), dot.getAttribute('cy'), dot.getAttribute('r')]).toEqual([String(end.x), String(end.y), '3.5']);
  expect(dot.getAttribute('fill')).toBe(COLORS['teal-300']);
});

test('the chart draws any box it is given, fills the room it is in, and is named for a screen reader as an image', () => {
  const { container } = render(<LineChart points={[1, 2]} tone="wine" width={100} height={50} label="Price since the start" />);
  const svg = container.querySelector('svg')!;
  expect(svg.getAttribute('viewBox')).toBe('0 0 100 50');
  expect(svg.getAttribute('role')).toBe('img');
  expect(svg.getAttribute('aria-label')).toBe('Price since the start');
  expect(svg.style.width).toBe('100%');
  expect(svg.querySelector('path')!.getAttribute('d')).toBe(geometry.lineGeometry([1, 2], 100, 50).area);
  for (const part of svg.querySelectorAll('path, circle')) expect(part.getAttribute('fill') === 'none' || part.getAttribute('fill') === COLORS['wine-300']).toBe(true);
});

test('a chart with no label is hidden from a screen reader; a life with no rounds yet draws no line', () => {
  const { container } = render(<LineChart points={[]} tone="teal" />);
  const svg = container.querySelector('svg')!;
  expect(svg.getAttribute('role')).toBeNull();
  expect(svg.getAttribute('aria-hidden')).toBe('true');
  expect(svg.querySelectorAll('path, circle, line')).toHaveLength(0);
});

test('Bars are one rect each from barRects, in the palette, with crisp edges, and the zero line last', () => {
  const { container } = render(<Bars {...WORTH} label="Net worth" />);
  const svg = container.querySelector('svg')!;
  const graph = geometry.barRects(WORTH);
  expect(svg.getAttribute('viewBox')).toBe('0 0 66 96');
  expect([svg.getAttribute('width'), svg.getAttribute('height')]).toEqual(['66', '96']);
  expect(svg.getAttribute('shape-rendering')).toBe('crispEdges');
  expect(svg.getAttribute('role')).toBe('img');
  expect(svg.getAttribute('aria-label')).toBe('Net worth');
  const rects = Array.from(svg.querySelectorAll('rect'));
  expect(rects).toHaveLength(graph.rects.length);
  graph.rects.forEach((r, i) => {
    expect([rects[i].getAttribute('x'), rects[i].getAttribute('y'), rects[i].getAttribute('width'), rects[i].getAttribute('height'), rects[i].getAttribute('fill')]).toEqual([String(r.x), String(r.y), String(r.w), String(r.h), COLORS[r.color]]);
  });
  expect(rects.at(-1)!.getAttribute('fill')).toBe(COLORS['ink-300']);
  expect(rects[0].getAttribute('fill')).toBe(COLORS['gold-500']);
});

test('a graph of a list is a smaller one, and one with no label is not read', () => {
  const { container } = render(<Bars {...WORTH} height={48} />);
  const svg = container.querySelector('svg')!;
  expect([svg.getAttribute('width'), svg.getAttribute('height')]).toEqual(['66', '48']);
  expect(svg.getAttribute('aria-hidden')).toBe('true');
  expect(svg.getAttribute('role')).toBeNull();
});
