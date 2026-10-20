// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { PIXEL_X_HEIGHT } from '@ratrace/core/game/share';
import { JERSEY_X_HEIGHT, OSWALD_X_HEIGHT } from './fonts';
import { PixelText, ReadText } from './text';

const spans = (container: HTMLElement) => Array.from(container.firstElementChild!.children) as HTMLElement[];

test('PixelText lays Jersey and Oswald runs in one outer text, each at its own scaled size', () => {
  const { container } = render(<PixelText size={20}>{'Ранг 3'}</PixelText>);
  const [cyr, fig] = spans(container);
  expect(cyr.textContent).toBe('Ранг');
  expect(cyr.style.fontFamily).toContain('Oswald_500Medium');
  expect(parseFloat(cyr.style.fontSize)).toBeCloseTo((20 * PIXEL_X_HEIGHT) / OSWALD_X_HEIGHT, 1);
  expect(fig.textContent).toBe(' 3');
  expect(fig.style.fontFamily).toContain('Jersey15_400Regular');
  expect(parseFloat(fig.style.fontSize)).toBeCloseTo((20 * PIXEL_X_HEIGHT) / JERSEY_X_HEIGHT, 1);
  const outer = container.firstElementChild as HTMLElement;
  expect(parseFloat(outer.style.lineHeight)).toBeCloseTo(22, 5);
});

test('ReadText is 15 pt, line height 1.45, cream, Chakra', () => {
  const { container } = render(<ReadText>{'Hello'}</ReadText>);
  const outer = container.firstElementChild as HTMLElement;
  expect(outer.style.fontSize).toBe('15px');
  expect(parseFloat(outer.style.lineHeight)).toBeCloseTo(21.75, 5);
  expect(outer.style.color).toBe('rgb(244, 241, 228)');
  expect(spans(container)[0].style.fontFamily).toContain('ChakraPetch_400Regular');
});
