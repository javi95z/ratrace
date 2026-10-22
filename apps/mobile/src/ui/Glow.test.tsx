// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { EXTRA } from './theme';

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
const { Glow, glowOf } = await import('./Glow');

beforeEach(() => {
  layouts.length = 0;
});
afterEach(cleanup);

const layOut = (width: number, height: number) => act(() => layouts[layouts.length - 1]({ nativeEvent: { layout: { x: 0, y: 0, width, height } } }));

test('a glow is the web\'s box-shadow of one layer, no offset and no spread: its blur and its colour; anything else is none', () => {
  expect(glowOf(EXTRA.glow.uncommon)).toEqual({ blur: 6, colour: 'rgba(240,230,210,0.35)' });
  expect(glowOf(EXTRA.glow.rare)).toEqual({ blur: 12, colour: 'rgba(233,177,60,0.6)' });
  expect(glowOf(EXTRA.glow.legendary)).toEqual({ blur: 20, colour: 'rgba(94,224,200,0.7)' });
  for (const none of ['', '0 0 0px rgba(0,0,0,1)', '2px 2px 4px #000', '0 0 6px 2px #000', 'inset 0 0 6px #000']) expect(glowOf(none), none).toBeNull();
});

test('drawn round the box it fills once that box is laid out: the box itself blurred by half the blur (CSS\'s deviation), seen outside the box only', () => {
  const { container } = render(<Glow shadow={EXTRA.glow.rare} />);
  // Nothing is drawn until the box has a size.
  expect(container.querySelector('[data-skia="Canvas"]')).toBeNull();
  const box = container.firstElementChild as HTMLElement;
  expect(box.style.position).toBe('absolute');
  expect([box.style.top, box.style.right, box.style.bottom, box.style.left]).toEqual(['0px', '0px', '0px', '0px']);
  expect(box.style.pointerEvents).toBe('none');

  layOut(300, 80);
  // A deviation of 6 reaches three of them out (18): the canvas stands that far round the box on every side.
  const canvas = container.querySelector('[data-skia="Canvas"]') as HTMLElement;
  expect(canvas.getAttribute('data-size')).toBe('336x116');
  const [group] = drawn(container, 'Group');
  expect(group).toEqual({ clip: { x: 18, y: 18, width: 300, height: 80 }, invertClip: true });
  expect(drawn(container, 'Rect')).toEqual([{ x: 18, y: 18, width: 300, height: 80, color: 'rgba(233,177,60,0.6)' }]);
  expect(drawn(container, 'BlurMask')).toEqual([{ blur: 6, style: 'normal' }]);
});

test('the canvas stands where the box is, as far out as the glow reaches, and grows with the box', () => {
  const { container } = render(<Glow shadow={EXTRA.glow.legendary} />);
  layOut(424, 96);
  const canvas = () => container.querySelector('[data-skia="Canvas"]')!.parentElement as HTMLElement;
  expect([canvas().style.left, canvas().style.top]).toEqual(['-30px', '-30px']);
  expect(container.querySelector('[data-skia="Canvas"]')!.getAttribute('data-size')).toBe('484x156');
  expect(drawn(container, 'BlurMask')).toEqual([{ blur: 10, style: 'normal' }]);
  layOut(424, 120);
  expect(container.querySelector('[data-skia="Canvas"]')!.getAttribute('data-size')).toBe('484x180');
});

test('no glow, nothing at all: not even a box to lay out', () => {
  const { container } = render(<Glow shadow="" />);
  expect(container.innerHTML).toBe('');
  expect(layouts).toHaveLength(0);
});
