// @vitest-environment jsdom
import { badges, content, rarityOf } from '@ratrace/content';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { newProfile } from '@/session/types';
import { memoryServices, renderGame } from '@/testing/render';
import { Collection } from './Collection';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className, 'aria-label': label }: { href: string; children: ReactNode; className?: string; 'aria-label'?: string }) => (
    <a href={href} className={className} aria-label={label}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/collection',
}));

afterEach(cleanup);

describe('the collection', () => {
  it('shows every thing in the game, as a silhouette until it has been owned', async () => {
    const services = memoryServices();
    await services.store.saveProfile({ ...newProfile(), gallery: ['watch_casio', 'car_seat_ibiza'] });
    renderGame(<Collection />, services);

    expect(await screen.findByText(`2 of ${content.items.length} owned`)).toBeTruthy();
    const things = screen.getByRole('tabpanel', { name: 'Things' });
    expect(within(things).getAllByRole('listitem')).toHaveLength(content.items.length);
    // Owned: drawn. Its name is the text beside it, said once, so the picture needs none of its own.
    const casio = within(things).getByText('Casio F-91W').closest('li') as HTMLElement;
    expect(casio.querySelector('img')?.getAttribute('src')).toContain('item.watch_casio');
    expect(casio.querySelector('img')?.getAttribute('alt')).toBe('');
    expect(within(casio).queryByText('Not owned yet')).toBeNull();
    expect((within(things).getByText('SEAT Ibiza').closest('li') as HTMLElement).querySelector('img')?.getAttribute('src')).toContain('car.seat_ibiza');
    // Not owned: a shadow and no name. What it is, the player finds out by owning it.
    expect(within(things).queryByText('Rolex Submariner')).toBeNull();
    const hidden = within(things).getAllByText('Not owned yet');
    expect(hidden).toHaveLength(content.items.length - 2);
    for (const label of hidden) {
      // Said to a screen reader, never drawn.
      expect(label.className).toContain('sr-only');
      const tile = label.closest('li') as HTMLElement;
      expect(within(tile).queryByRole('img')).toBeNull();
      expect(tile.querySelector('[data-silhouette]')).not.toBeNull();
      expect(tile.textContent).toBe('Not owned yet');
    }
    // Grouped as the shop groups them.
    for (const group of ['Cars and bikes', 'Pets', 'Watches', 'Tech', 'Fashion', 'Travel', 'Memberships']) expect(within(things).getByRole('heading', { name: group })).toBeTruthy();
  });

  it('shows every badge, tells how it is earned only of those earned, and never says when', async () => {
    const services = memoryServices();
    await services.store.saveProfile({ ...newProfile(), badges: { millionaire: { at: Date.UTC(2026, 9, 13, 12), gameId: 'g' }, bankrupt: { at: Date.UTC(2026, 0, 2, 12), gameId: 'g' } } });
    const user = userEvent.setup();
    renderGame(<Collection />, services);

    await user.click(await screen.findByRole('tab', { name: 'Badges' }));
    expect(screen.getByText(`2 of ${badges.length} earned`)).toBeTruthy();
    const panel = screen.getByRole('tabpanel', { name: 'Badges' });
    expect(within(panel).getAllByRole('listitem')).toHaveLength(badges.length);
    for (const group of ['Wealth', 'Escape', 'Investing', 'Status', 'Life', 'Misfortune']) expect(within(panel).getByRole('heading', { name: group })).toBeTruthy();

    const earned = within(panel).getByText('Millionaire').closest('li') as HTMLElement;
    expect(within(earned).queryByText(/2026/)).toBeNull();
    expect(within(earned).getByText(/Be worth a million/)).toBeTruthy();
    const pictures = (line: HTMLElement) => [...line.querySelectorAll('img')].map((img) => img.getAttribute('src') ?? '');
    // Set in the rim of its rarity: a millionaire is common, and in bronze.
    expect(pictures(earned)).toEqual([expect.stringContaining('rim.bronze'), expect.stringContaining('badge.millionaire')]);
    expect(within(earned).getByText('Common')).toBeTruthy();

    const waiting = within(panel).getByText('Ten million').closest('li') as HTMLElement;
    expect(within(waiting).getByText('Not earned yet')).toBeTruthy();
    // How to earn it is not told until it has been earned: the name is the clue.
    expect(within(waiting).queryByText(/Be worth ten million/)).toBeNull();
    // Its rarity is seen before it is won: ten million is rare, in gold, with the lock inside.
    expect(pictures(waiting)).toEqual([expect.stringContaining('rim.gold'), expect.stringContaining('badge.locked')]);
    expect(within(waiting).getByText('Rare')).toBeTruthy();
  });

  it('shows one rarity at a time, each saying how many of it are won', async () => {
    const services = memoryServices();
    await services.store.saveProfile({ ...newProfile(), badges: { millionaire: { at: 1, gameId: 'g' }, ten_million: { at: 1, gameId: 'g' } } });
    const user = userEvent.setup();
    renderGame(<Collection />, services);
    await user.click(await screen.findByRole('tab', { name: 'Badges' }));
    const panel = screen.getByRole('tabpanel', { name: 'Badges' });
    const of = (rarity: string) => badges.filter((badge) => rarityOf(badge.id) === rarity);
    const rare = within(panel).getByRole('radio', { name: /^Rare/ });
    expect(rare.textContent).toBe(`Rare1/${of('rare').length}`);
    await user.click(rare);
    expect(within(panel).getAllByRole('listitem')).toHaveLength(of('rare').length);
    expect(within(panel).getByText('Ten million')).toBeTruthy();
    expect(within(panel).queryByText('Millionaire')).toBeNull();
    await user.click(within(panel).getByRole('radio', { name: /^All/ }));
    expect(within(panel).getAllByRole('listitem')).toHaveLength(badges.length);
  });

  it('says how seldom each rarity is earned in lives, never in real players, and hides judged badges until won', async () => {
    const services = memoryServices();
    await services.store.saveProfile({ ...newProfile(), badges: { millionaire: { at: 1, gameId: 'g' } } });
    const user = userEvent.setup();
    renderGame(<Collection />, services);
    await user.click(await screen.findByRole('tab', { name: 'Badges' }));
    const panel = screen.getByRole('tabpanel', { name: 'Badges' });
    expect(within(panel).getAllByText(/More than 30 in 100 lives/).length).toBeGreaterThan(0);
    expect(within(panel).getAllByText(/Fewer than 2 in 100 lives/).length).toBeGreaterThan(0);
    expect(within(panel).getAllByText(/10 to 30 in 100 lives/).length).toBeGreaterThan(0);
    expect(within(panel).getAllByText(/2 to 10 in 100 lives/).length).toBeGreaterThan(0);
    expect(panel.textContent).not.toMatch(/% of players|players have/i);
    // A judged badge, not yet won: its name is not told, only the group it belongs to.
    expect(within(panel).queryByText('Swiss banker')).toBeNull();
    const secrets = [...panel.querySelectorAll('[data-secret]')];
    expect(secrets.length).toBeGreaterThan(0);
    expect(within(secrets[0] as HTMLElement).getByText('???')).toBeTruthy();
    expect(within(secrets[0] as HTMLElement).getByText(/Something to do with: /)).toBeTruthy();
    // A measured badge is still named while locked.
    expect(within(panel).getByText('Ten million')).toBeTruthy();
  });

  it('starts empty for someone new, and leads back home', async () => {
    renderGame(<Collection />, memoryServices());
    expect(await screen.findByText(`0 of ${content.items.length} owned`)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Collection' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/');
  });

  it('speaks Spanish', async () => {
    const services = memoryServices();
    await services.store.saveProfile({ ...newProfile(), badges: { millionaire: { at: Date.UTC(2026, 9, 13, 12), gameId: 'g' } } });
    const user = userEvent.setup();
    renderGame(<Collection />, services, 'es');
    await user.click(await screen.findByRole('tab', { name: 'Insignias' }));
    expect(screen.getByText('Primer millón')).toBeTruthy();
    expect(screen.queryByText(/2026/)).toBeNull();
  });
});
