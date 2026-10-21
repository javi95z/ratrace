// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ReducedMotionProvider } from '../../ui/animations';
import { rea } from '../../ui/testing/reanimated';
import { Loop, loopFrame } from './Loop';

beforeEach(() => {
  rea.assigned.length = 0;
});
afterEach(cleanup);

const sprites = (root: Element) => [...root.querySelectorAll('[data-sprite]')].map((el) => el.getAttribute('data-sprite'));
/** Where a loop's strip of frames stands under its box of one frame. */
const strip = (root: Element) => root.querySelector<HTMLElement>('[data-loop-strip]')?.style.transform;

describe('a loop of frames', () => {
  it('draws its four frames once, side by side on one strip, and shows the first: the strip at its start, under a box of one frame', () => {
    const { container } = render(<Loop name="coin" />);
    expect(sprites(container)).toEqual(['anim.coin.0', 'anim.coin.1', 'anim.coin.2', 'anim.coin.3']);
    expect(container.querySelectorAll('[data-strip]')).toHaveLength(1);
    expect(strip(container)).toMatch(/^translateX\(-?0(px)?\)$/);
  });

  it('turns on the phone\'s animation thread, not by drawing the page again: one run of a frame\'s time each, over and over', () => {
    render(<Loop name="wheel" outfit="tracksuit" ms={120} />);
    // One timing from the first frame to past the last, at the loop's pace, repeated for ever.
    expect(rea.assigned).toEqual([{ kind: 'repeat', to: 4, duration: 480, reps: -1, delay: undefined }]);
  });

  it('shows, at each moment of the run, the frame the web\'s timer would have reached: a frame for `ms` each, then the first again', () => {
    expect([0, 0.99, 1, 2.5, 3.99, 4].map((at) => loopFrame(at, 4))).toEqual([0, 0, 1, 2, 3, 0]);
  });

  it('dresses the rat in the wheel as the life is lived, and keeps the plain wheel for an outfit not drawn', () => {
    const { container, unmount } = render(<Loop name="wheel" outfit="tracksuit" />);
    expect(sprites(container)[0]).toBe('anim.wheel_tracksuit.0');
    unmount();
    const plain = render(<Loop name="wheel" outfit="suit" />);
    expect(sprites(plain.container)[0]).toBe('anim.wheel.0');
  });

  it('draws every frame into the box it is given, where the web forces one (a flying coin\'s 24 square, for art twice that)', () => {
    const { container } = render(<Loop name="coin" ms={90} size={{ w: 24, h: 24 }} />);
    const box = container.firstElementChild as HTMLElement;
    expect([box.style.width, box.style.height]).toEqual(['24px', '24px']);
    expect([...container.querySelectorAll('[data-sprite]')].map((el) => el.getAttribute('data-size'))).toEqual(['24x24', '24x24', '24x24', '24x24']);
    cleanup();
    const still = render(
      <ReducedMotionProvider value>
        <Loop name="coin" size={{ w: 24, h: 24 }} />
      </ReducedMotionProvider>,
    );
    expect(still.container.querySelector('[data-sprite="anim.coin.0"]')?.getAttribute('data-size')).toBe('24x24');
  });

  it('stands still on its first frame where motion is left out: one frame, and nothing running', () => {
    const { container } = render(
      <ReducedMotionProvider value>
        <Loop name="coin" />
      </ReducedMotionProvider>,
    );
    expect(sprites(container)).toEqual(['anim.coin.0']);
    expect(rea.assigned).toEqual([]);
  });
});
