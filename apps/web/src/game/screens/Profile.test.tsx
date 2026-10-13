// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame, setWidth } from '@/testing/render';
import { Play } from './Play';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/play',
}));

afterEach(cleanup);

/** A nurse who bought a watch and joined a gym in her first round. */
async function withThings() {
  const services = memoryServices();
  const session = await services.sessions.start('nurse');
  while (session.view().phase === 'cards') await session.answerCard(0);
  await session.playRound({ orders: [{ type: 'buyItem', itemId: 'watch_casio' }, { type: 'buyItem', itemId: 'member_gym' }] });
  expect(session.view().player.life.items.map((owned) => owned.itemId)).toEqual(['watch_casio', 'member_gym']);
  return services;
}

describe('what the player owns, in the profile', () => {
  it('opens on a tap: what it is, what it gives, what it would fetch, and where to sell it', async () => {
    setWidth('phone');
    const user = userEvent.setup();
    renderGame(<Play />, await withThings());
    await screen.findByRole('heading', { name: 'News' });
    await user.click(screen.getByRole('button', { name: 'Open your profile' }));
    const profile = screen.getByRole('dialog', { name: 'Your life' });

    await user.click(within(profile).getByRole('button', { name: 'Casio F-91W' }));
    const watch = screen.getByRole('dialog', { name: 'Casio F-91W' });
    expect(within(watch).getByText('Watches')).toBeTruthy();
    expect(within(watch).getByText('Status +1')).toBeTruthy();
    expect(within(watch).getByText(/^Would sell for \$\d+ today$/)).toBeTruthy();
    expect(within(watch).getByText('Sell or cancel it in the Shop tab.')).toBeTruthy();

    // Closing it leaves the profile where it was.
    await user.click(within(watch).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Casio F-91W' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Your life' })).toBeTruthy();

    // A membership has a fee and no resale value.
    await user.click(within(screen.getByRole('dialog', { name: 'Your life' })).getByRole('button', { name: 'Basic-Fit' }));
    const gym = screen.getByRole('dialog', { name: 'Basic-Fit' });
    expect(within(gym).getByText(/a year upkeep|\/yr|upkeep/)).toBeTruthy();
    expect(within(gym).queryByText(/Would sell for/)).toBeNull();
  });

  it('opens from the side column of a wide screen too', async () => {
    setWidth('desk');
    const user = userEvent.setup();
    renderGame(<Play />, await withThings());
    await screen.findAllByRole('heading', { name: 'News' });
    await user.click(screen.getByRole('button', { name: 'Casio F-91W' }));
    expect(screen.getByRole('dialog', { name: 'Casio F-91W' })).toBeTruthy();
  });
});
