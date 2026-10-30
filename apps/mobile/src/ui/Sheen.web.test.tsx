// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { ReducedMotionProvider } from './animations';
import { SHEEN_MS, sheenX } from './sheen';
import { Sheen } from './Shine.web';
import { rea } from './testing/reanimated';

afterEach(cleanup);

test('the band waits out of sight on either side of its crossing, which takes the first 40 % of a run', () => {
  expect(sheenX(0, 288)).toBeLessThan(-0.22 * 288);
  expect(sheenX(0.4, 288)).toBeGreaterThan(288);
  expect(sheenX(1, 288)).toBe(sheenX(0.4, 288));
  expect(sheenX(0.2, 288)).toBeGreaterThan(0);
  expect(sheenX(0.2, 288)).toBeLessThan(288);
});

test('on the web it is a CSS animation every 2.6 seconds, with nothing moved by the page\'s thread, and hidden from a screen reader', () => {
  rea.assigned.length = 0;
  const { container } = render(<Sheen width={288} height={120} />);
  const band = container.querySelector('[data-sheen]') as HTMLElement;
  expect(SHEEN_MS).toBe(2600);
  expect(band.style.animation).toBe('rr-sheen 2600ms linear infinite');
  expect(band.getAttribute('aria-hidden')).toBe('true');
  expect([band.style.position, band.style.width, band.style.height, band.style.pointerEvents]).toEqual(['absolute', `${0.22 * 288}px`, '120px', 'none']);
  expect(container.querySelector('style')?.textContent).toContain('@keyframes rr-sheen');
  expect(container.querySelector('style')?.textContent).toContain('prefers-reduced-motion');
  expect(rea.assigned).toHaveLength(0);
});

test('stands still where a scene holds it, and is not there where motion is left out', () => {
  const { container } = render(<Sheen width={288} height={120} held={0.2} />);
  const band = container.querySelector('[data-sheen]') as HTMLElement;
  expect(band.style.animation).toBe('');
  expect(band.style.transform).toBe(`translateX(${sheenX(0.2, 288)}px) skewX(-20deg)`);
  cleanup();
  const still = render(
    <ReducedMotionProvider value={true}>
      <Sheen width={288} height={120} />
    </ReducedMotionProvider>,
  );
  expect(still.container.querySelector('[data-sheen]')).toBeNull();
});
