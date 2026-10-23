// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import * as phone from './lights';
import { Glow, glowOf } from './Glow.web';
import { EXTRA } from './theme';

afterEach(cleanup);

/** A value as the browser keeps it once it is set on an element (colours rewritten as it likes). */
const asWritten = (property: 'boxShadow', value: string): string => {
  const probe = document.createElement('div');
  probe.style[property] = value;
  return probe.style[property];
};

test('a glow is read as the phone reads it: the same function, from the same module', () => {
  expect(glowOf).toBe(phone.glowOf);
  expect(glowOf(EXTRA.glow.rare)).toEqual({ blur: 12, colour: 'rgba(233,177,60,0.6)' });
  expect(glowOf('2px 2px 4px #000')).toBeNull();
});

test('the gold glow is the web\'s own box-shadow on a box that fills the one it lights: seen outside it only, as the browser clips an outer shadow', () => {
  const { container } = render(<Glow shadow={EXTRA.glow.rare} />);
  const box = container.firstElementChild as HTMLElement;
  expect(box.style.boxShadow).toBe(asWritten('boxShadow', EXTRA.glow.rare));
  expect(box.style.position).toBe('absolute');
  expect([box.style.top, box.style.right, box.style.bottom, box.style.left]).toEqual(['0px', '0px', '0px', '0px']);
  // it is a light and no more: no touch, no screen reader, no fill of its own, and nothing of Skia
  expect(box.style.pointerEvents).toBe('none');
  expect(box.getAttribute('aria-hidden')).toBe('true');
  expect(box.style.backgroundColor).toBe('');
  expect(container.querySelector('canvas, [data-skia]')).toBeNull();
});

test('every rarity\'s glow is written to the box as it is given', () => {
  for (const shadow of Object.values(EXTRA.glow)) {
    if (glowOf(shadow) === null) continue;
    const { container, unmount } = render(<Glow shadow={shadow} />);
    const blur = glowOf(shadow)!.blur;
    expect((container.firstElementChild as HTMLElement).style.boxShadow).toContain(`0 0 ${blur}px`);
    unmount();
  }
});

test('no glow, nothing at all (none for a bronze badge)', () => {
  const { container } = render(<Glow shadow="" />);
  expect(container.innerHTML).toBe('');
});
