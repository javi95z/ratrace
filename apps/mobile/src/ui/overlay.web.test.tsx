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
  await screen.findByRole('heading', { name: 'Details' });
  // The box over the page that holds the backdrop and places the panel (the panel itself is the dialog).
  return screen.getByTestId('sheet-backdrop').parentElement as HTMLElement;
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

describe('the foot of a sheet', () => {
  /** The strips of the sheet's frame that draw an edge along its foot. */
  async function footEdges(width: number) {
    await sheetAt(width);
    // The frame's box: the nearest box round the sheet's words that holds the frame's strips, boxes laid over it that hold nothing.
    const isStrip = (el: Element): el is HTMLElement => el instanceof HTMLElement && el.style.position === 'absolute' && el.children.length === 0;
    let framed = screen.getByText('inside') as HTMLElement;
    while (framed.parentElement && ![...framed.children].some(isStrip)) framed = framed.parentElement;
    const strips = [...framed.children].filter(isStrip);
    expect(strips.length).toBeGreaterThan(0);
    return strips.filter((strip) => Number.parseFloat(strip.style.borderBottomWidth || '0') > 0);
  }

  it('has no frame along it where the sheet rises from the foot of the screen: it runs off the screen', async () => {
    expect(await footEdges(1000)).toEqual([]);
  });

  it('keeps the whole frame on a sheet in the middle of a wide screen', async () => {
    expect((await footEdges(1280)).length).toBeGreaterThan(0);
  });
});
