// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { COLORS } from '../../ui/theme';
import { memoryServices, renderGame } from '../../testing/render';
import { CrisisBar } from './Crisis';

afterEach(cleanup);

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};

const CRASH = { id: 'crash', year: 2, of: 3 } as const;

/** The bar of a crisis, drawn in the game's words. */
async function bar(compact: boolean, locale: 'en' | 'es' = 'en') {
  renderGame(<CrisisBar crisis={CRASH} compact={compact} />, memoryServices(), locale);
  return await screen.findByRole('button', { name: locale === 'en' ? 'The Great Crash: year 2 of 3. See what it is.' : /Gran Crac|Crac/ });
}

describe('the bar of a crisis', () => {
  it('says nothing in ordinary times', async () => {
    const { container } = renderGame(<CrisisBar crisis={null} />, memoryServices());
    await new Promise((done) => setTimeout(done, 10));
    expect(container.textContent).toBe('');
  });

  it('names the crisis, how far through it the world is, and what this round of it brings', async () => {
    const button = await bar(false);
    expect(within(button).getByText('CRISIS · YEAR 2 OF 3')).toBeTruthy();
    expect(within(button).getByText('The Great Crash')).toBeTruthy();
    expect(within(button).getByText('Jobs go, and prices keep sliding.')).toBeTruthy();
  });

  it('as the strip under the HUD, says the name and the year only', async () => {
    const button = await bar(true);
    expect(within(button).getByText('The Great Crash')).toBeTruthy();
    expect(within(button).queryByText('Jobs go, and prices keep sliding.')).toBeNull();
  });

  it('has a lamp for each round of it: lit for those gone by, pulsing for the one being lived, dark for those to come', async () => {
    const button = await bar(true);
    const lamps = [...button.querySelectorAll<HTMLElement>('[data-lamp]')];
    expect(lamps.map((lamp) => lamp.getAttribute('data-lamp'))).toEqual(['past', 'now', 'ahead']);
    expect(lamps.map((lamp) => lamp.style.backgroundColor)).toEqual([rgb(COLORS['wine-300']), rgb(COLORS.cream), rgb(COLORS['wine-900'])]);
    for (const lamp of lamps) {
      expect(lamp.style.width).toBe('10px');
      expect(lamp.style.height).toBe('10px');
    }
  });

  it('opens the whole of it, on wine, the round being lived marked', async () => {
    fireEvent.click(await bar(true));
    const sheet = screen.getByRole('heading', { name: 'The Great Crash' }).closest('[aria-modal="true"]') as HTMLElement;
    expect(within(sheet).getByText(/^Markets are in free fall/)).toBeTruthy();
    const years = ['Shares and homes fall hard.', 'Jobs go, and prices keep sliding.', 'The worst is over: markets turn.'];
    for (const line of years) expect(within(sheet).getByText(line)).toBeTruthy();
    const items = within(sheet).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items.map((item) => item.getAttribute('aria-current'))).toEqual([null, 'step', null]);
    expect(within(items[0]).getByText('YEAR 1')).toBeTruthy();
    expect(within(sheet).getByText(/^A crisis punishes whoever has to sell/)).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'The Great Crash' })).toBeNull());
  });

  it('can be open from the start, as a scene draws it, without a tap', async () => {
    renderGame(<CrisisBar crisis={CRASH} compact open />, memoryServices());
    const sheet = (await screen.findByRole('heading', { name: 'The Great Crash' })).closest('[aria-modal="true"]') as HTMLElement;
    expect(within(sheet).getAllByRole('listitem')).toHaveLength(3);
  });
});
