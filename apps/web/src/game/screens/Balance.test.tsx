// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

// On a wide screen the profile is always there, at the side.
beforeEach(() => setWidth('desk'));
afterEach(cleanup);

/** A life on screen, after `rounds` rounds played with the orders given in the first. */
async function life(lifeId: string, orders: Parameters<Awaited<ReturnType<ReturnType<typeof memoryServices>['sessions']['start']>>['playRound']>[0]['orders'] = []) {
  const services = memoryServices();
  await services.store.saveProfile({ ...(await services.store.loadProfile()), unlocked: { heir: { at: 1, gameId: 'earlier' }, crypto_kid: { at: 1, gameId: 'earlier' } } });
  const session = await services.sessions.start(lifeId);
  if (orders.length > 0) {
    while (session.view().phase === 'cards') await session.answerCard(0);
    await session.playRound({ orders });
  }
  const user = userEvent.setup();
  renderGame(<Play />, services);
  await screen.findAllByRole('heading', { name: 'News' });
  const balance = screen.getByRole('region', { name: 'Balance sheet' });
  const open = async (line: RegExp, title: string) => {
    await user.click(within(balance).getByRole('button', { name: line }));
    return screen.getByRole('dialog', { name: title });
  };
  const close = async () => user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
  return { user, open, close, session };
}

describe('the lines of the balance sheet', () => {
  it('each open what they are: cash, savings, the pension and net worth', async () => {
    const { open, close } = await life('nurse');

    let sheet = await open(/^Cash/, 'Cash');
    expect(within(sheet).getByText(/^The money you have on hand/)).toBeTruthy();
    expect(within(sheet).getByText('$3,000')).toBeTruthy();
    await close();

    sheet = await open(/^Savings/, 'Savings');
    expect(within(sheet).getByText('Interest')).toBeTruthy();
    expect(within(sheet).getByText(/^\d+(\.\d+)?% a year$/)).toBeTruthy();
    expect(within(sheet).getByText(/takes it from here first/)).toBeTruthy();
    await close();

    sheet = await open(/^Pension plan/, 'Pension plan');
    expect(within(sheet).getByText('MSCI World')).toBeTruthy();
    expect(within(sheet).getByText('Age 62')).toBeTruthy();
    await close();

    sheet = await open(/^Net worth/, 'Net worth');
    expect(within(sheet).getByText(/half your score/)).toBeTruthy();
    expect(within(sheet).getByText('The one the score counts')).toBeTruthy();
    // No round has been played: there is nothing to draw yet.
    expect(within(sheet).queryByRole('img')).toBeNull();
  });

  it('say so when there is nothing in them', async () => {
    const { open, close } = await life('nurse');
    expect(within(await open(/^Investments/, 'Investments')).getByText(/^You have no investments yet/)).toBeTruthy();
    await close();
    expect(within(await open(/^Property/, 'Property')).getByText('You own no property.')).toBeTruthy();
    await close();
    expect(within(await open(/^Things/, 'Things')).getByText('Nothing yet')).toBeTruthy();
    await close();
    expect(within(await open(/^Debts/, 'Debts')).getByText('You owe nothing.')).toBeTruthy();
  });

  it('list every debt with its rate and its term, and what they cost together', async () => {
    // The engineer starts with a student loan.
    const { open } = await life('engineer');
    const sheet = await open(/^Debts/, 'Debts');
    const [loan] = within(sheet).getAllByRole('listitem');
    expect(within(loan).getByText('Personal loan')).toBeTruthy();
    expect(within(loan).getByText('$18,000')).toBeTruthy();
    expect(within(loan).getByText('6.0% a year')).toBeTruthy();
    expect(within(loan).getByText('5 rounds left')).toBeTruthy();
    expect(within(sheet).getByText('What they cost together')).toBeTruthy();
  });

  it('list what is held in the markets under the name the market gives it, with what it has gained', async () => {
    // The crypto kid starts with a coin.
    const { open } = await life('crypto_kid');
    const sheet = await open(/^Investments/, 'Investments');
    const crypto = within(sheet).getByRole('region', { name: 'Crypto' });
    expect(within(crypto).getByText('Bitcoin')).toBeTruthy();
    expect(within(crypto).getByText('$20,000')).toBeTruthy();
    expect(within(crypto).getByText('$0 gain')).toBeTruthy();
    expect(within(sheet).queryByRole('region', { name: 'Stocks' })).toBeNull();
  });

  it('list each property with where it is, what it is for and what it is worth', async () => {
    // The heir starts with a flat, lived in and owned outright.
    const { open } = await life('heir');
    const sheet = await open(/^Property/, 'Property');
    const [flat] = within(sheet).getAllByRole('listitem');
    expect(within(flat).getByText('Flat')).toBeTruthy();
    expect(within(flat).getByText('Dubai · You live here')).toBeTruthy();
    expect(within(flat).getByText('Worth today')).toBeTruthy();
    expect(within(flat).queryByText('Still owed')).toBeNull();
  });

  it('list the things owned, the dearest first, and open one of them', async () => {
    const { user, open } = await life('heir', [{ type: 'buyItem', itemId: 'watch_casio' }, { type: 'buyItem', itemId: 'watch_tissot' }]);
    const sheet = await open(/^Things/, 'Things');
    const things = within(sheet).getAllByRole('button').filter((b) => b.getAttribute('aria-label') !== 'Close');
    expect(things.map((b) => b.textContent?.replace(/\$.*/, ''))).toEqual(['Tissot PRX', 'Casio F-91W']);
    await user.click(things[0]);
    // The list gives way to the thing.
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'Tissot PRX' })).toBeTruthy();
  });

  it('draw how net worth has moved once a round has been played', async () => {
    const { open } = await life('heir', [{ type: 'depositIn', amount: 100_000 }]);
    const sheet = await open(/^Net worth/, 'Net worth');
    expect(within(sheet).getByRole('img')).toBeTruthy();
  });
});
