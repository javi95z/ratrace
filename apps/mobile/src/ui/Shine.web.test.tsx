// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { ReducedMotionProvider } from './animations';
import * as lights from './lights';
import { Glint, HOLO_COLORS, Holo, holoGradient } from './Shine.web';
import { rea } from './testing/reanimated';
import { COLORS, EXTRA } from './theme';

beforeEach(() => {
  rea.assigned.length = 0;
});
afterEach(cleanup);

const still = ({ children }: { children: ReactNode }) => <ReducedMotionProvider value={true}>{children}</ReducedMotionProvider>;

test('its colours are the web\'s, from the one module the phone reads them from: red, gold, green, sky, blue and red again', () => {
  expect(HOLO_COLORS).toBe(lights.HOLO_COLORS);
  expect(holoGradient).toBe(lights.holoGradient);
  expect(HOLO_COLORS).toEqual([COLORS['wine-500'], COLORS['gold-500'], COLORS['teal-300'], COLORS['sky-300'], COLORS['sky-500'], COLORS['wine-500']]);
});

test('the rainbow is a CSS linear-gradient(110deg) of HOLO_COLORS in order, two boxes wide, laid over the picture as overlay at 40 %', () => {
  const { container } = render(<Holo width={288} height={120} held={0} />);
  const box = container.firstElementChild as HTMLElement;
  expect(box.style.mixBlendMode).toBe('overlay');
  expect(box.style.opacity).toBe('0.4');
  expect([box.style.position, box.style.top, box.style.left, box.style.width, box.style.height, box.style.overflow]).toEqual(['absolute', '0px', '0px', '288px', '120px', 'hidden']);
  expect(box.style.pointerEvents).toBe('none');
  expect(box.getAttribute('aria-hidden')).toBe('true');
  const band = box.querySelector('[data-holo]') as HTMLElement;
  const written = document.createElement('div');
  written.style.backgroundImage = `linear-gradient(110deg, ${HOLO_COLORS.join(', ')})`;
  expect(band.style.backgroundImage).toBe(written.style.backgroundImage);
  // the colours in order, and the angle of the web's gradient
  expect(band.style.backgroundImage.startsWith('linear-gradient(110deg, ')).toBe(true);
  expect(band.style.backgroundImage.match(/rgb\(/g)).toHaveLength(6);
  // the web's `background-size: 200% 100%`, repeated: the gradient twice over, side by side
  expect(band.style.backgroundSize).toBe('576px 120px');
  expect(band.style.backgroundRepeat).toBe('repeat-x');
  expect((band.parentElement as HTMLElement).style.width).toBe('1152px');
  expect(container.querySelector('canvas, [data-skia]')).toBeNull();
});

test('held half way it has slid a whole box to the left, held at the start not at all and at the end two boxes: where it begins again', () => {
  for (const [held, shift] of [[0.5, -288], [0, 0], [1, -576]] as const) {
    const { container, unmount } = render(<Holo width={288} height={120} held={held} />);
    const slide = container.querySelector('[data-holo]')!.parentElement as HTMLElement;
    expect(slide.style.transform).toBe(`translateX(${shift}px)`);
    unmount();
  }
});

test('played, the rainbow loops over its four seconds, with the options the kit gives; once stops it after one', () => {
  render(<Holo width={288} height={120} />);
  expect(rea.assigned).toEqual([{ kind: 'repeat', to: 1, duration: 4000, reps: -1 }]);
  rea.assigned.length = 0;
  render(<Holo width={288} height={120} once />);
  expect(rea.assigned).toEqual([{ kind: 'timing', to: 1, duration: 4000 }]);
});

test('it is not drawn where motion is left out', () => {
  const { container } = render(<Holo width={288} height={120} />, { wrapper: still });
  expect(container.firstElementChild).toBeNull();
  expect(rea.assigned).toEqual([]);
});

test('the glint is a white band a fifth of the box wide, from top to bottom, white at 40 %, crossing in 18 steps', () => {
  const { container } = render(<Glint held={0.35} />);
  const band = container.firstElementChild as HTMLElement;
  expect(band.style.position).toBe('absolute');
  expect([band.style.top, band.style.bottom, band.style.left, band.style.width]).toEqual(['0px', '0px', '0px', '20%']);
  expect(band.style.backgroundColor).toBe('rgba(255, 255, 255, 0.4)');
  expect(EXTRA.glint).toBe('rgba(255,255,255,0.4)');
  expect(band.style.pointerEvents).toBe('none');
  expect(band.style.transform).toContain('translateX(650%)');
  expect(band.style.transform).toContain('skewX(-20deg)');
  expect(band.style.opacity).toBe('1');
});

test('held before its start the glint stands at the left, off the card; a narrower band is a share of the box', () => {
  const { container } = render(<Glint held={0} share={0.25} />);
  const band = container.firstElementChild as HTMLElement;
  expect(band.style.width).toBe('25%');
  expect(band.style.transform).toContain('translateX(-150%)');
});

test('played, the glint repeats over 3.6 seconds; once, it crosses once; rest is the look of the band outside the run', () => {
  render(<Glint />);
  expect(rea.assigned).toEqual([{ kind: 'repeat', to: 1, duration: 3600, reps: -1 }]);
  rea.assigned.length = 0;
  const { container } = render(<Glint once rest={{ opacity: 0 }} />);
  expect(rea.assigned).toEqual([{ kind: 'timing', to: 1, duration: 3600 }]);
  expect(container.firstElementChild).not.toBeNull();
});

test('a glint is not drawn where motion is left out', () => {
  const { container } = render(<Glint />, { wrapper: still });
  expect(container.firstElementChild).toBeNull();
});
