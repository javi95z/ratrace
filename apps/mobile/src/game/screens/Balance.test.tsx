// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';
import { Play } from './Play';

afterEach(cleanup);

/** A sheet by its title: the window that holds it. */
const sheetTitled = (title: string) => screen.getByRole('heading', { name: title }).closest('[aria-modal="true"]') as HTMLElement;

/**
 * A life on screen, after `rounds` rounds played with the orders given in the first, its profile open (on a phone the profile is a sheet the portrait
 * opens; the web's test reads the desk's side column).
 */
async function life(lifeId: string, orders: Parameters<Awaited<ReturnType<ReturnType<typeof memoryServices>['sessions']['start']>>['playRound']>[0]['orders'] = []) {
  const services = memoryServices();
  await services.store.saveProfile({ ...(await services.store.loadProfile()), unlocked: { heir: { at: 1, gameId: 'earlier' }, crypto_kid: { at: 1, gameId: 'earlier' } } });
  const session = await services.sessions.start(lifeId);
  if (orders.length > 0) {
    while (session.view().phase === 'cards') await session.answerCard(0);
    await session.playRound({ orders });
  }
  renderGame(<Play />, services);
  await screen.findByRole('heading', { name: 'News' });
  fireEvent.click(screen.getByRole('button', { name: 'Open your profile' }));
  const balance = screen.getByLabelText('Balance sheet');
  const open = (line: RegExp, title: string) => {
    fireEvent.click(within(balance).getByRole('button', { name: line }));
    return sheetTitled(title);
  };
  const close = async (title: string) => {
    fireEvent.click(within(sheetTitled(title)).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: title })).toBeNull());
  };
  return { open, close, session };
}

describe('the lines of the balance sheet', () => {
  it('each open what they are: cash, savings, the pension and net worth', async () => {
    const { open, close } = await life('nurse');

    let sheet = open(/^Cash/, 'Cash');
    expect(within(sheet).getByText(/^The money you have on hand/)).toBeTruthy();
    expect(within(sheet).getByText('$3,000')).toBeTruthy();
    await close('Cash');

    sheet = open(/^Savings/, 'Savings');
    expect(within(sheet).getByText('Interest')).toBeTruthy();
    expect(within(sheet).getByText(/^\d+(\.\d+)?% a year$/)).toBeTruthy();
    expect(within(sheet).getByText(/takes it from here first/)).toBeTruthy();
    await close('Savings');

    sheet = open(/^Pension plan/, 'Pension plan');
    expect(within(sheet).getByText('MSCI World')).toBeTruthy();
    expect(within(sheet).getByText('Age 62')).toBeTruthy();
    await close('Pension plan');

    sheet = open(/^Net worth/, 'Net worth');
    expect(within(sheet).getByText(/half your score/)).toBeTruthy();
    expect(within(sheet).getByText('The one the score counts')).toBeTruthy();
    // The net worth after inflation is named in words, never by a key: the web's key is not in the messages, and the phone says it in its own.
    expect(within(sheet).getByText('Net worth, after inflation')).toBeTruthy();
    expect(sheet.textContent).not.toMatch(/\b(end|phone)\.\w+/);
    // No round has been played: there is nothing to draw yet.
    expect(within(sheet).queryByRole('img')).toBeNull();
  });

  it('say so when there is nothing in them', async () => {
    const { open, close } = await life('nurse');
    expect(within(open(/^Investments/, 'Investments')).getByText(/^You have no investments yet/)).toBeTruthy();
    await close('Investments');
    expect(within(open(/^Property/, 'Property')).getByText('You own no property.')).toBeTruthy();
    await close('Property');
    expect(within(open(/^Things/, 'Things')).getByText('Nothing yet')).toBeTruthy();
    await close('Things');
    expect(within(open(/^Debts/, 'Debts')).getByText('You owe nothing.')).toBeTruthy();
  });

  it('list every debt with its rate and its term, and what they cost together', async () => {
    // The engineer starts with a student loan.
    const { open } = await life('engineer');
    const sheet = open(/^Debts/, 'Debts');
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
    const sheet = open(/^Investments/, 'Investments');
    const crypto = within(sheet).getByLabelText('Crypto');
    expect(within(crypto).getByText('Bitcoin')).toBeTruthy();
    expect(within(crypto).getByText('$20,000')).toBeTruthy();
    expect(within(crypto).getByText('$0 gain')).toBeTruthy();
    expect(within(sheet).queryByLabelText('Stocks')).toBeNull();
  });

  it('list each property with where it is, what it is for and what it is worth', async () => {
    // The heir starts with a flat, lived in and owned outright.
    const { open } = await life('heir');
    const sheet = open(/^Property/, 'Property');
    const [flat] = within(sheet).getAllByRole('listitem');
    expect(within(flat).getByText('Apartment in the Marina')).toBeTruthy();
    expect(within(flat).getByText('Dubai · You live here')).toBeTruthy();
    expect(within(flat).getByText('Worth today')).toBeTruthy();
    expect(within(flat).queryByText('Still owed')).toBeNull();
  });

  it('list the things owned, the dearest first, and open one of them', async () => {
    const { open } = await life('heir', [{ type: 'buyItem', itemId: 'watch_casio' }, { type: 'buyItem', itemId: 'watch_tissot' }]);
    const sheet = open(/^Things/, 'Things');
    const things = within(sheet).getAllByRole('button').filter((b) => b.getAttribute('aria-label') !== 'Close');
    expect(things.map((b) => b.textContent?.replace(/\$.*/, ''))).toEqual(['Tissot PRX', 'Casio F-91W']);
    fireEvent.click(things[0]);
    // The list gives way to the thing, over the profile.
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Things' })).toBeNull());
    expect(sheetTitled('Tissot PRX')).toBeTruthy();
    expect(sheetTitled('Your life')).toBeTruthy();
  });

  it('draw how net worth has moved once a round has been played', async () => {
    const { open } = await life('heir', [{ type: 'depositIn', amount: 100_000 }]);
    const sheet = open(/^Net worth/, 'Net worth');
    const graph = within(sheet).getByRole('img');
    expect(graph.getAttribute('aria-label')).toBe('Your net worth through life, after inflation');
    // Two rounds' bars (the start, the round played), ten wide and four apart, from 22 to 24.
    expect(graph.style.width).toBe('24px');
    expect(within(sheet).getByText('22')).toBeTruthy();
    expect(within(sheet).getByText('24')).toBeTruthy();
  });
});
