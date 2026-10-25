// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';
import { browserAt } from '../../ui/testing/media';
import { Play } from './Play';

/*
 * A life's page has one `<h1>`, as the Next web's Play: the life and its age (`play.heading`, for someone who cannot see the page), the news under it
 * an `<h2>` (the Next web's `News.tsx`, `<h2 className="sr-only">`), at a phone's width and at a desk's.
 */

let restore: (() => void) | null = null;
afterEach(() => {
  cleanup();
  restore?.();
  restore = null;
});

describe('the headings of a life\'s page', () => {
  it.each([393, 1280])('are one h1, the life and its age, and the news an h2 under it, %i wide', async (width) => {
    restore = browserAt(width);
    const services = memoryServices();
    await services.sessions.start('nurse');
    renderGame(<Play />, services);
    await screen.findByRole('region', { name: 'News' });
    const ones = [...document.querySelectorAll('h1')].map((h) => h.textContent);
    expect(ones).toHaveLength(1);
    expect(ones[0]).toMatch(/, age \d+$/);
    expect(screen.getByRole('heading', { level: 2, name: 'News' })).toBeTruthy();
    // On to the cards: still the one h1, the card's title an h2 (the Next web's `Cards.tsx`).
    fireEvent.click(document.querySelector('[data-primary-action]') as HTMLElement);
    await waitFor(() => expect(screen.getByRole('main').getAttribute('aria-label')).toMatch(/^Card 1 of/));
    expect(document.querySelectorAll('h1')).toHaveLength(1);
    expect(document.querySelectorAll('h2').length).toBeGreaterThan(0);
  });

  it('gives a sheet opened over the life an h2 for its title, as the Next web\'s Sheet', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    renderGame(<Play />, services);
    fireEvent.click(await screen.findByRole('button', { name: 'Open settings' }));
    await screen.findByRole('dialog', { name: 'Settings' });
    expect(screen.getByRole('heading', { level: 2, name: 'Settings' })).toBeTruthy();
    expect(document.querySelectorAll('h1')).toHaveLength(1);
  });
});
