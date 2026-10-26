// @vitest-environment jsdom
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { memoryServices, renderGame, router } from '../../testing/render';
import { Home } from './Home';

/*
 * The front door on the web, as the Next web's (frontDoor.web.ts): the language's square in its corner, and the privacy and legal notice in its small
 * print at the foot. (The phone keeps both in its settings: Home.test.tsx.)
 */

afterEach(cleanup);

describe('the front door on the web', () => {
  it('leads to the privacy and legal notice, small, at the very foot', async () => {
    renderGame(<Home />, memoryServices());
    const link = await screen.findByRole('link', { name: 'Privacy and legal notice' });
    fireEvent.click(link);
    expect(router.push).toHaveBeenCalledWith('/en/legal');
    const all = screen.getAllByRole('link');
    expect(all[all.length - 1]).toBe(link);
  });

  it('gives its small print the 44 a thumb needs in its own box, reaching no further than the gap above it and the page\'s foot below', async () => {
    renderGame(<Home />, memoryServices());
    const link = await screen.findByRole('link', { name: 'Privacy and legal notice' });
    const px = (value: string) => Number.parseFloat(value || '0');
    expect(link.getAttribute('hitSlop')).toBeNull();
    const line = px((link.querySelector('[dir]') as HTMLElement).style.lineHeight);
    // The web sets its lines as Chrome does (ui/strut.web.ts): to a hundredth of a point.
    expect(line).toBeCloseTo(12 * 1.45, 1);
    expect(line + px(link.style.paddingTop) + px(link.style.paddingBottom)).toBeGreaterThanOrEqual(44);
    // It takes no room: the padding is given back.
    expect(px(link.style.marginTop)).toBe(-px(link.style.paddingTop));
    expect(px(link.style.marginBottom)).toBe(-px(link.style.paddingBottom));
    // Over nothing that takes a touch: no further up than the page's gap above it, no further down than the page's foot.
    const page = link.parentElement as HTMLElement;
    expect(px(link.style.paddingTop)).toBeLessThanOrEqual(px(page.style.rowGap || page.style.gap));
    expect(px(link.style.paddingBottom)).toBeLessThanOrEqual(px(page.style.paddingBottom));
  });

  it('shows the language in use as its code, and drops the others from it; choosing one speaks it from then on', async () => {
    renderGame(<Home />, memoryServices());
    await screen.findByRole('link', { name: 'New life' });
    const square = screen.getByRole('button', { name: 'Language' });
    expect(square.textContent).toBe('en');
    expect(square.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(square);
    const menu = await screen.findByRole('menu');
    expect(square.getAttribute('aria-expanded')).toBe('true');
    expect(within(menu).getAllByRole('menuitem').map((item) => [item.textContent, item.getAttribute('aria-selected')])).toEqual([
      ['English', 'true'],
      ['Español', 'false'],
      ['Русский', 'false'],
    ]);
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Español' }));
    expect(await screen.findByRole('link', { name: 'Nueva vida' })).toBeTruthy();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('button', { name: 'Idioma' }).textContent).toBe('es');
  });

  it('is shut by pressing outside it, by pressing the square again, and by Back', async () => {
    renderGame(<Home />, memoryServices());
    await screen.findByRole('link', { name: 'New life' });
    const square = screen.getByRole('button', { name: 'Language' });
    fireEvent.click(square);
    await screen.findByRole('menu');
    // Outside: the page behind the menu is a button the width of the screen.
    fireEvent.click(document.querySelector('[data-testid="menu-backdrop"]') as HTMLElement);
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(square);
    await screen.findByRole('menu');
    fireEvent.click(square);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

