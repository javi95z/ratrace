// @vitest-environment jsdom
import { MAP_PLACES } from '@ratrace/content';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import * as phone from './RouteLayer';
import * as geometry from './drawings';
import { RouteLayer, routeLights } from './RouteLayer.web';
import { COLORS } from './theme';

afterEach(cleanup);

const places = [MAP_PLACES.madrid, MAP_PLACES.london, MAP_PLACES.new_york];

test('its numbers are the phone\'s: the same function, from the one module both read', () => {
  expect(routeLights).toBe(geometry.routeLights);
  expect(Object.keys(phone).sort()).toEqual(['RouteLayer', 'routeLights']);
});

test('it is an SVG as large as the map, laid over it: the dashed gold line, then a light on each city with its outline, as the Next web draws them', () => {
  const { container } = render(<RouteLayer places={places} width={350} ratio={0.5} />);
  const { line, lights } = routeLights(places, 350, 0.5);
  const svg = container.querySelector('svg')!;
  expect([svg.getAttribute('width'), svg.getAttribute('height'), svg.getAttribute('viewBox')]).toEqual(['350', '175', '0 0 350 175']);
  expect(svg.getAttribute('aria-hidden')).toBe('true');
  expect(svg.style.position).toBe('absolute');
  expect(Array.from(svg.children).map((n) => n.tagName.toLowerCase())).toEqual(['path', 'rect', 'rect', 'rect']);
  const path = svg.querySelector('path')!;
  expect(path.getAttribute('d')).toBe(line!.path);
  expect(path.getAttribute('fill')).toBe('none');
  expect(path.getAttribute('stroke')).toBe(COLORS['gold-500']);
  expect(path.getAttribute('stroke-width')).toBe(String(line!.strokeWidth));
  expect(path.getAttribute('stroke-dasharray')).toBe(line!.dash.join(' '));
  expect(path.getAttribute('stroke-linejoin')).toBe('round');
  const rects = Array.from(svg.querySelectorAll('rect'));
  rects.forEach((rect, i) => {
    expect([rect.getAttribute('x'), rect.getAttribute('y'), rect.getAttribute('width'), rect.getAttribute('height')]).toEqual([lights[i].x, lights[i].y, lights[i].size, lights[i].size].map(String));
    expect([rect.getAttribute('fill'), rect.getAttribute('stroke'), rect.getAttribute('stroke-width')]).toEqual([lights[i].fill, COLORS['night-900'], String(lights[i].edgeWidth)]);
  });
  expect(rects[2].getAttribute('fill')).toBe(COLORS.cream);
  expect(container.querySelector('canvas, [data-skia]')).toBeNull();
});

test('a life lived in one city is a light and no line', () => {
  const { container } = render(<RouteLayer places={[MAP_PLACES.madrid]} width={350} ratio={0.5} />);
  expect(container.querySelector('path')).toBeNull();
  expect(container.querySelectorAll('rect')).toHaveLength(1);
});
