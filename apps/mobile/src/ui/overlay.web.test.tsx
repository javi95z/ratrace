// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Sheet } from './overlay';
import { browserAt } from './testing/media';

/*
 * A sheet on the web: it rises from the foot of a phone's screen, and sits in the middle of a wide one (the Next web's `items-end justify-center
 * desk:items-center desk:p-6`), at most 448 wide either way.
 */

let restore: (() => void) | null = null;
afterEach(() => {
  cleanup();
  restore?.();
  restore = null;
});

/** The sheet's box over the page: what holds the backdrop and the panel, and places the panel. */
async function sheetAt(width: number) {
  restore = browserAt(width);
  render(
    <Sheet open onClose={() => {}} title="Details" closeLabel="Close">
      <p>inside</p>
    </Sheet>,
  );
  const title = await screen.findByRole('heading', { name: 'Details' });
  return title.closest('[aria-modal="true"]') as HTMLElement;
}

describe('a sheet on the web', () => {
  it('sits in the middle of a screen of desk width, 24 from its edges', async () => {
    const box = await sheetAt(1280);
    expect(box.style.justifyContent).toBe('center');
    expect(box.style.alignItems).toBe('center');
    for (const side of ['Top', 'Bottom', 'Left', 'Right'] as const) expect(box.style[`padding${side}`]).toBe('24px');
  });

  it('rises from the foot of a narrower screen, as on a phone', async () => {
    const box = await sheetAt(1000);
    expect(box.style.justifyContent).toBe('flex-end');
    expect(box.style.paddingBottom).toBe('');
  });
});
