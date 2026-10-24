// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';
import { browserAt } from '../../ui/testing/media';
import { Play } from './Play';
import { deskColumns } from './PlayDesk.web';

let restore: (() => void) | null = null;
afterEach(() => {
  cleanup();
  restore?.();
  restore = null;
});

/** A life begun, on a browser `width` wide, at its first news. */
async function playingAt(width: number) {
  restore = browserAt(width);
  const services = memoryServices();
  await services.sessions.start('nurse');
  renderGame(<Play />, services);
  await screen.findByRole('main');
  return services;
}

describe('the desk\'s columns', () => {
  it('are sized as Chrome sizes the web\'s grid: each at its least, the sides grown equally to their most, the rest to the middle', () => {
    // 1280: 1216 inside the padding and the gaps; the sides at their most (372, 340), the middle the rest.
    expect(deskColumns(1280)).toEqual({ left: 372, middle: 504, right: 340 });
    // 1024: 60 to share, 30 to each side.
    expect(deskColumns(1024)).toEqual({ left: 310, middle: 360, right: 290 });
    // 1140: 176 to share, the right stops at 340 (80), the left takes 12 more, the middle the 4 left.
    expect(deskColumns(1140)).toEqual({ left: 372, middle: 364, right: 340 });
    // Never wider than 1480.
    expect(deskColumns(2560)).toEqual(deskColumns(1480));
  });
});

describe('a life at desk width', () => {
  it('lays the page in three columns, in the web\'s order: the profile, the round, the news', async () => {
    await playingAt(1280);
    const profile = screen.getByRole('complementary', { name: 'Your life' });
    const round = screen.getByRole('main');
    const news = screen.getByRole('complementary', { name: 'News' });
    expect(profile.compareDocumentPosition(round) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(round.compareDocumentPosition(news) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Each its width of the web's grid at 1280, the sides sticking to the top of the window, as tall as it at most.
    expect(profile.style.width).toBe('372px');
    expect(news.style.width).toBe('340px');
    expect(round.parentElement?.style.width).toBe('504px');
    for (const side of [profile, news]) {
      expect(side.style.position).toBe('sticky');
      expect(side.style.top).toBe('0px');
      expect(side.style.maxHeight).toBe('800px');
    }
    // The round opens on its own title (the headlines are at the side), the profile is no sheet but the column, and its portrait no button.
    expect(within(round).queryByRole('region', { name: 'News' })).toBeNull();
    expect(within(news).getByRole('region', { name: 'News' })).toBeTruthy();
    expect(within(profile).getAllByRole('button', { name: /cash/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Open your profile' })).toBeNull();
    expect(screen.getByRole('main').style.maxWidth).toBe('680px');
  });

  it('leads the keyboard to each column with skip links, in the web\'s order, out of sight until one has the focus', async () => {
    await playingAt(1280);
    const nav = screen.getByRole('navigation');
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Skip to the round', 'Skip to profile', 'Skip to news', 'Skip to round actions']);
    expect(nav.style.transform).toBe('translateY(-180%)');
    fireEvent.focus(links[1]);
    await waitFor(() => expect(nav.style.transform).toBe('translateY(0)'));
    fireEvent.click(links[1]);
    expect(document.activeElement).toBe(screen.getByRole('complementary', { name: 'Your life' }));
    fireEvent.blur(links[1]);
    await waitFor(() => expect(nav.style.transform).toBe('translateY(-180%)'));
    // Each one's target is where the keyboard can land.
    for (const id of ['round-stage', 'player-profile', 'round-news', 'round-actions']) expect(document.getElementById(id)?.getAttribute('tabindex')).toBe('-1');
  });

  it('keeps the round\'s orders at the side in the finances, with a link to them, and no button to open them', async () => {
    await playingAt(1280);
    fireEvent.click(screen.getByRole('button', { name: /See what life brings|To your finances/ }));
    // Through the cards, if the round has any, to the finances.
    for (;;) {
      await waitFor(() => expect(screen.getByRole('main').getAttribute('aria-label')).not.toBe('News'));
      const label = screen.getByRole('main').getAttribute('aria-label') ?? '';
      if (/finance/i.test(label)) break;
      const choices = screen.queryByRole('group', { name: /^Your choices/ });
      if (choices) fireEvent.click(within(choices).getAllByRole('button')[0]);
      const next = await screen.findByRole('button', { name: /Next card|To your finances/ });
      fireEvent.click(next);
    }
    const news = screen.getByRole('complementary', { name: 'News' });
    expect(within(news).getByText(/this round's orders/i)).toBeTruthy();
    expect(within(document.getElementById('round-orders') as HTMLElement).getByText(/this round's orders/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /orders?$/ })).toBeNull();
    expect(within(screen.getByRole('navigation')).getAllByRole('link').map((link) => link.textContent)).toContain('Skip to orders');
    // The tabs stick to the top of the page, the button of the round to its foot.
    expect(screen.getByRole('tablist').parentElement?.parentElement?.style.position).toBe('sticky');
    expect(document.getElementById('round-actions')?.style.position).toBe('sticky');
  });

  it('is the phone\'s one column under the desk\'s width, with the skip links to the round and to its actions', async () => {
    await playingAt(1000);
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open your profile' })).toBeTruthy();
    const nav = screen.getByRole('navigation');
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Skip to the round', 'Skip to round actions']);
    fireEvent.click(links[1]);
    expect(document.activeElement).toBe(document.getElementById('round-actions'));
    fireEvent.click(links[0]);
    expect(document.activeElement).toBe(screen.getByRole('main'));
  });
});
