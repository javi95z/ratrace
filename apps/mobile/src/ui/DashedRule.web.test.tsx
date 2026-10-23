// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as phone from './DashedRule';
import { DashedRule, Dashes, dashesOf, ruleOf } from './DashedRule.web';
import * as geometry from './drawings';
import { COLORS } from './theme';

// onLayout is the browser's to send: the test sends it, to the View that asks for one.
type Layout = (event: { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } }) => void;
const layouts = vi.hoisted(() => [] as Layout[]);
vi.mock('react-native', async (orig) => {
  const rn = (await orig()) as typeof import('react-native');
  return {
    ...rn,
    View: (props: Record<string, unknown>) => {
      if (typeof props.onLayout === 'function') layouts.push(props.onLayout as Layout);
      return <rn.View {...(props as Record<string, unknown>)} />;
    },
  };
});

beforeEach(() => {
  layouts.length = 0;
});
afterEach(cleanup);

test('its dashes are the phone\'s: the same functions, from the one module both read', () => {
  expect([dashesOf, ruleOf]).toEqual([geometry.dashesOf, geometry.ruleOf]);
  expect(Object.keys(phone).sort()).toEqual(['DashedRule', 'Dashes', 'dashesOf', 'ruleOf']);
});

test('a rule draws nothing until its room is measured, then an SVG of that length, 1 high, with the dashes in ink-300 and no canvas', () => {
  const { container } = render(<DashedRule />);
  expect(container.querySelector('svg')).toBeNull();
  act(() => layouts[layouts.length - 1]({ nativeEvent: { layout: { x: 0, y: 0, width: 346, height: 1 } } }));
  const svg = container.querySelector('svg')!;
  expect([svg.getAttribute('width'), svg.getAttribute('height'), svg.getAttribute('viewBox')]).toEqual(['346', '1', '0 0 346 1']);
  expect(svg.getAttribute('aria-hidden')).toBe('true');
  const path = svg.querySelector('path')!;
  expect(path.getAttribute('d')).toBe(ruleOf(346));
  expect(path.getAttribute('fill')).toBe(COLORS['ink-300']);
  expect(container.querySelector('canvas, [data-skia]')).toBeNull();
});

test('the dashes alone take a tone', () => {
  const { container } = render(<Dashes length={50} tone="gold-500" />);
  expect(container.querySelector('path')!.getAttribute('fill')).toBe(COLORS['gold-500']);
});
