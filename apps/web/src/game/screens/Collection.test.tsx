// @vitest-environment jsdom
import { badges, content } from '@ratrace/content';
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
    // Not owned: its name is there to aim for, its picture is a shadow.
    const rolex = within(things).getByText('Rolex Submariner').closest('li') as HTMLElement;
    expect(within(rolex).queryByRole('img')).toBeNull();
    expect(within(rolex).getByText('Not owned yet')).toBeTruthy();
    expect(rolex.querySelector('[data-silhouette]')).not.toBeNull();
    // Grouped as the shop groups them.
    for (const group of ['Cars', 'Watches', 'Tech', 'Fashion', 'Travel', 'Memberships']) expect(within(things).getByRole('heading', { name: group })).toBeTruthy();
  });

  it('shows every badge with how each is earned, and marks the ones earned with the day', async () => {
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
    expect(within(earned).getByText('Earned 13 Oct 2026')).toBeTruthy();
    expect(within(earned).getByText(/Be worth a million/)).toBeTruthy();
    expect(earned.querySelector('img')?.getAttribute('src')).toContain('badge.millionaire');

    const waiting = within(panel).getByText('Ten million').closest('li') as HTMLElement;
    expect(within(waiting).getByText('Not earned yet')).toBeTruthy();
    expect(within(waiting).getByText(/Be worth ten million/)).toBeTruthy();
    expect(waiting.querySelector('img')?.getAttribute('src')).toContain('badge.locked');
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
    expect(screen.getByText('Millonario')).toBeTruthy();
    expect(screen.getByText(/Conseguida el 13 oct 2026/)).toBeTruthy();
  });
});
