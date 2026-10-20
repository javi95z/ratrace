// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { COLORS } from './theme';

// The gesture handler's native side cannot be loaded here: a stand-in that hands the test the pan's callbacks.
type Touch = { x: number; y?: number };
const pans = vi.hoisted(
  () =>
    [] as Array<
      Record<'onBegin' | 'onUpdate' | 'onFinalize', (event: { x: number; y: number }) => void> & {
        minDistance?: number;
        activeOffsetX?: [number, number];
        failOffsetY?: [number, number];
        runOnJS?: boolean;
        enabled?: boolean;
      }
    >,
);
/** The pan's callbacks as a finger on the track gives them (y defaults to the middle of the 44). */
const touch = {
  begin: (t: Touch) => last(pans).onBegin({ x: t.x, y: t.y ?? 22 }),
  update: (t: Touch) => last(pans).onUpdate({ x: t.x, y: t.y ?? 22 }),
  end: (t: Touch) => last(pans).onFinalize({ x: t.x, y: t.y ?? 22 }),
};
vi.mock('react-native-gesture-handler', () => ({
  usePanGesture: (config: (typeof pans)[number]) => {
    pans.push(config);
    return config;
  },
  GestureDetector: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// onLayout and the screen reader's actions are the phone's to send; here the test sends them. What the slider hands its View is kept.
const layouts = vi.hoisted(() => [] as Array<(event: { nativeEvent: { layout: { width: number; height: number } } }) => void>);
const adjustables = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock('react-native', async (orig) => {
  const rn = (await orig()) as typeof import('react-native');
  return {
    ...rn,
    View: (props: Record<string, unknown>) => {
      if (typeof props.onLayout === 'function') layouts.push(props.onLayout as (typeof layouts)[number]);
      if (props.accessibilityRole === 'adjustable') adjustables.push(props);
      return <rn.View {...(props as Record<string, unknown>)} />;
    },
  };
});

const last = <T,>(list: T[]) => list[list.length - 1];

const { Slider, THUMB, valueAtX } = await import('./Slider');

beforeEach(() => {
  pans.length = 0;
  layouts.length = 0;
  adjustables.length = 0;
});
afterEach(cleanup);

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};

test('the value under a finger: the thumb\'s middle follows it, snapped to a step, and the last step that fits under max', () => {
  // a 300 wide track: the thumb travels 280, from x = 10 to x = 290
  expect(valueAtX(10, 300, 0, 1000, 10)).toBe(0);
  expect(valueAtX(150, 300, 0, 1000, 10)).toBe(500);
  expect(valueAtX(290, 300, 0, 1000, 10)).toBe(1000);
  expect(valueAtX(-50, 300, 0, 1000, 10)).toBe(0);
  expect(valueAtX(999, 300, 0, 1000, 10)).toBe(1000);
  // between two steps it goes to the nearer
  expect(valueAtX(10 + 280 * 0.0149, 300, 0, 1000, 10)).toBe(10);
  expect(valueAtX(10 + 280 * 0.0151, 300, 0, 1000, 10)).toBe(20);
  // a max that no step reaches (a native range cannot be set past its last step): the far end is the last step
  expect(valueAtX(290, 300, 0, 1000, 300)).toBe(900);
  // counted from min
  expect(valueAtX(150, 300, 100, 500, 50)).toBe(300);
});

test('a track of 44 points, 8 high in the middle with its 2 point outline, and a thumb of 20 x 28 with a darker outline', () => {
  const { container } = render(<Slider label="Amount" value={500} min={0} max={1000} step={10} onChange={() => {}} />);
  expect(THUMB).toEqual({ w: 20, h: 28 });
  const slider = container.querySelector('[role="slider"]') as HTMLElement;
  expect(slider.style.height).toBe('44px');
  expect(slider.style.width).toBe('100%');
  const filled = (colour: string) => Array.from(slider.querySelectorAll('div')).filter((d) => d.style.backgroundColor === rgb(colour));
  // the track: night-600, 8 high, centred in the 44
  const [track] = filled(COLORS['night-600']);
  expect(track.style.height).toBe('8px');
  expect(track.parentElement).toBe(slider);
  // its outline is the night-900 strips of a frame, 2 points thick, and none at the corners
  expect(filled(COLORS['night-900']).length).toBeGreaterThanOrEqual(4);
  // the thumb: gold-500, 20 x 28, outlined gold-900
  const [thumb] = filled(COLORS['gold-500']);
  expect([thumb.style.width, thumb.style.height]).toEqual(['20px', '28px']);
  expect(filled(COLORS['gold-900']).length).toBeGreaterThanOrEqual(4);
});

test('the thumb stands at its share of the travel, in a lane 20 narrower than the track, so it needs no measuring to be drawn', () => {
  const at = (value: number) => {
    const { container, unmount } = render(<Slider label="a" value={value} min={0} max={1000} step={10} onChange={() => {}} />);
    const thumb = Array.from(container.querySelectorAll('div')).find((d) => d.style.backgroundColor === rgb(COLORS['gold-500']))!;
    const lane = thumb.parentElement!;
    const out = { thumbLeft: thumb.style.left, laneRight: lane.style.right, laneLeft: lane.style.left, top: thumb.style.top };
    unmount();
    return out;
  };
  expect(at(0)).toEqual({ thumbLeft: '0%', laneRight: '20px', laneLeft: '0px', top: '8px' });
  expect(at(250).thumbLeft).toBe('25%');
  expect(at(1000).thumbLeft).toBe('100%');
});

test('it is an adjustable: named, with its value and range read out', () => {
  const { container } = render(<Slider label="Amount" value={500} min={0} max={1000} step={100} onChange={() => {}} valueText="500 $" />);
  const slider = container.querySelector('[role="slider"]') as HTMLElement;
  expect(slider.getAttribute('aria-label')).toBe('Amount');
  expect(slider.getAttribute('aria-valuenow')).toBe('500');
  expect(slider.getAttribute('aria-valuemin')).toBe('0');
  expect(slider.getAttribute('aria-valuemax')).toBe('1000');
  expect(slider.getAttribute('aria-valuetext')).toBe('500 $');
  const props = last(adjustables);
  expect(props.accessible).toBe(true);
  expect(props.accessibilityLabel).toBe('Amount');
  expect(props.accessibilityValue).toEqual({ min: 0, max: 1000, now: 500, text: '500 $' });
  expect(props.accessibilityActions).toEqual([{ name: 'increment' }, { name: 'decrement' }]);
});

test('increment and decrement move one step, and stop at the ends', () => {
  const onChange = vi.fn();
  const { rerender } = render(<Slider label="a" value={500} min={0} max={1000} step={100} onChange={onChange} />);
  const act = (name: string) => (last(adjustables).onAccessibilityAction as (e: { nativeEvent: { actionName: string } }) => void)({ nativeEvent: { actionName: name } });
  act('increment');
  expect(onChange).toHaveBeenLastCalledWith(600);
  act('decrement');
  expect(onChange).toHaveBeenLastCalledWith(400);
  act('magic');
  expect(onChange).toHaveBeenCalledTimes(2);
  rerender(<Slider label="a" value={1000} min={0} max={1000} step={100} onChange={onChange} />);
  onChange.mockClear();
  act('increment');
  expect(onChange).not.toHaveBeenCalled();
  rerender(<Slider label="a" value={0} min={0} max={1000} step={100} onChange={onChange} />);
  act('decrement');
  expect(onChange).not.toHaveBeenCalled();
  // a max no step reaches: the last step is the end
  rerender(<Slider label="a" value={900} min={0} max={1000} step={300} onChange={onChange} />);
  act('increment');
  expect(onChange).not.toHaveBeenCalled();
});

test('only a sideways move takes the pan, and a move up or down gives the touch to the scroll behind it: no minimum distance', () => {
  render(<Slider label="a" value={0} min={0} max={1000} step={10} onChange={() => {}} />);
  expect(last(pans).minDistance).toBeUndefined();
  expect(last(pans).activeOffsetX).toEqual([-6, 6]);
  expect(last(pans).failOffsetY).toEqual([-10, 10]);
  expect(last(pans).runOnJS).toBe(true);
});

test('dragging puts the thumb under the finger and follows it, once the track is measured', () => {
  const onChange = vi.fn();
  const slider = (value: number) => <Slider label="a" value={value} min={0} max={1000} step={10} onChange={onChange} />;
  const { rerender } = render(slider(0));
  // not measured yet: a touch cannot be placed, and nothing changes
  touch.update({ x: 150 });
  expect(onChange).not.toHaveBeenCalled();
  act(() => last(layouts)({ nativeEvent: { layout: { width: 300, height: 44 } } }));
  touch.begin({ x: 100 });
  touch.update({ x: 150 });
  expect(onChange).toHaveBeenLastCalledWith(500);
  rerender(slider(500));
  touch.update({ x: 290 });
  expect(onChange).toHaveBeenLastCalledWith(1000);
  rerender(slider(1000));
  touch.update({ x: -20 });
  expect(onChange).toHaveBeenLastCalledWith(0);
});

test('a finger put down changes nothing: the amount does not move until the touch is known to be a tap or a drag', () => {
  const onChange = vi.fn();
  render(<Slider label="a" value={0} min={0} max={1000} step={10} onChange={onChange} />);
  act(() => last(layouts)({ nativeEvent: { layout: { width: 300, height: 44 } } }));
  touch.begin({ x: 200 });
  expect(onChange).not.toHaveBeenCalled();
});

test('a tap sets the value where it lands, when it ends', () => {
  const onChange = vi.fn();
  render(<Slider label="a" value={0} min={0} max={1000} step={10} onChange={onChange} />);
  act(() => last(layouts)({ nativeEvent: { layout: { width: 300, height: 44 } } }));
  touch.begin({ x: 150, y: 20 });
  touch.end({ x: 150, y: 21 });
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenLastCalledWith(500);
});

test('a touch that starts on the track and moves up or down is a scroll: the value is left as it was', () => {
  const onChange = vi.fn();
  render(<Slider label="a" value={300} min={0} max={1000} step={10} onChange={onChange} />);
  act(() => last(layouts)({ nativeEvent: { layout: { width: 300, height: 44 } } }));
  touch.begin({ x: 150, y: 20 });
  // the pan fails on the vertical move and ends where the finger had got to
  touch.end({ x: 152, y: 44 });
  expect(onChange).not.toHaveBeenCalled();
  // up as well as down
  touch.begin({ x: 150, y: 20 });
  touch.end({ x: 150, y: 3 });
  expect(onChange).not.toHaveBeenCalled();
});

test('a drag that ends does not set the value again, and the next tap is a tap again', () => {
  const onChange = vi.fn();
  const slider = (value: number) => <Slider label="a" value={value} min={0} max={1000} step={10} onChange={onChange} />;
  const { rerender } = render(slider(0));
  act(() => last(layouts)({ nativeEvent: { layout: { width: 300, height: 44 } } }));
  touch.begin({ x: 20 });
  touch.update({ x: 150 });
  rerender(slider(500));
  onChange.mockClear();
  // it ends a little off the last update: the drag had already put the thumb where it was
  touch.end({ x: 160 });
  expect(onChange).not.toHaveBeenCalled();
  touch.begin({ x: 250 });
  touch.end({ x: 250 });
  expect(onChange).toHaveBeenLastCalledWith(860);
});

test('a track with nothing to choose from takes no touch', () => {
  const onChange = vi.fn();
  render(<Slider label="a" value={0} min={0} max={0} step={10} onChange={onChange} />);
  expect(last(pans).enabled).toBe(false);
  act(() => last(layouts)({ nativeEvent: { layout: { width: 300, height: 44 } } }));
  touch.begin({ x: 150 });
  touch.end({ x: 150 });
  expect(onChange).not.toHaveBeenCalled();
});

test('a touch that lands on the value it already has says nothing', () => {
  const onChange = vi.fn();
  render(<Slider label="a" value={500} min={0} max={1000} step={10} onChange={onChange} />);
  act(() => last(layouts)({ nativeEvent: { layout: { width: 300, height: 44 } } }));
  touch.update({ x: 150 });
  expect(onChange).not.toHaveBeenCalled();
});
