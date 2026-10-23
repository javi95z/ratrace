// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ruleOf } from './drawings';
import { COLORS } from './theme';

vi.mock('@shopify/react-native-skia', async () => (await import('./testing/skia')).skiaFake());

// onLayout is the phone's to send: the test sends it, to the View that asks for one.
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

const { drawn } = await import('./testing/skia');
const { DashedRule, Dashes } = await import('./DashedRule');

beforeEach(() => {
  layouts.length = 0;
});
afterEach(cleanup);

test('a rule draws nothing until its room is measured, then the dashes of that length on a canvas 1 high, in ink-300', () => {
  const { container } = render(<DashedRule />);
  expect(container.querySelector('[data-skia]')).toBeNull();
  act(() => layouts[layouts.length - 1]({ nativeEvent: { layout: { x: 0, y: 0, width: 346, height: 1 } } }));
  expect(container.querySelector('[data-skia="Canvas"]')!.getAttribute('data-size')).toBe('346x1');
  expect(drawn(container, 'Path')[0]).toMatchObject({ path: ruleOf(346), color: COLORS['ink-300'] });
});

test('the dashes alone take a tone', () => {
  const { container } = render(<Dashes length={50} tone="gold-500" />);
  expect(drawn(container, 'Path')[0]).toMatchObject({ path: ruleOf(50), color: COLORS['gold-500'] });
});
