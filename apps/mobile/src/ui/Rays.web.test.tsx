// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import * as phone from './Rays';
import * as geometry from './drawings';
import { Rays, raysOf } from './Rays.web';
import { COLORS } from './theme';

afterEach(cleanup);

test('its rays are the phone\'s: the same function, from the one module both read', () => {
  expect(raysOf).toBe(geometry.raysOf);
  expect(Object.keys(phone).sort()).toEqual(['Rays', 'raysOf']);
});

test('the rays are an SVG square of the size, gold-900 all over and the gold-700 rays of raysOf over it, with no canvas', () => {
  const { container } = render(<Rays size={64} />);
  const svg = container.querySelector('svg')!;
  expect([svg.getAttribute('width'), svg.getAttribute('height'), svg.getAttribute('viewBox')]).toEqual(['64', '64', '0 0 64 64']);
  expect(svg.getAttribute('aria-hidden')).toBe('true');
  expect(Array.from(svg.children).map((n) => n.tagName.toLowerCase())).toEqual(['rect', 'path']);
  expect(svg.querySelector('rect')!.getAttribute('fill')).toBe(COLORS['gold-900']);
  const rays = svg.querySelector('path')!;
  expect(rays.getAttribute('d')).toBe(raysOf(64, 64));
  expect(rays.getAttribute('fill')).toBe(COLORS['gold-700']);
  expect(container.querySelector('canvas, [data-skia]')).toBeNull();
});
