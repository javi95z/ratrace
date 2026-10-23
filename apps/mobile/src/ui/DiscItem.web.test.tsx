// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { DiscItem } from './DiscItem.web';
import { COLORS } from './theme';

afterEach(cleanup);

test('a line of a list: 20 in from the edge, its words, and a cream disc of 5 points drawn as an SVG circle in the room to its left', () => {
  const { container } = render(<DiscItem>Pay the fine</DiscItem>);
  const item = container.querySelector('[role="listitem"]') as HTMLElement;
  expect(item.style.paddingLeft).toBe('20px');
  expect(item.textContent).toBe('Pay the fine');
  const disc = item.querySelector('[data-disc]') as SVGElement;
  expect([disc.getAttribute('width'), disc.getAttribute('height')]).toEqual(['5', '5']);
  expect([(disc as unknown as HTMLElement).style.left, (disc as unknown as HTMLElement).style.top, (disc as unknown as HTMLElement).style.position]).toEqual(['4px', '7px', 'absolute']);
  const circle = disc.querySelector('circle')!;
  expect([circle.getAttribute('cx'), circle.getAttribute('cy'), circle.getAttribute('r')]).toEqual(['2.5', '2.5', '2.5']);
  expect(circle.getAttribute('fill')).toBe(COLORS.cream);
  // a mark, not a word: nothing for a screen reader, and nothing drawn on a canvas
  expect(disc.getAttribute('aria-hidden')).toBe('true');
  expect(container.querySelector('canvas, [data-skia]')).toBeNull();
});
