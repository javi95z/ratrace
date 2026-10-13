// @vitest-environment jsdom
import { content } from '@ratrace/content';
import { previewRound, quoteProperty, viewOf } from '@ratrace/engine';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatFor } from '@/lib/format';
import type { GameSession, SavedGame } from '@/session/types';
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

beforeEach(() => setWidth('phone'));
afterEach(cleanup);

const fmt = formatFor('en');
const button = (name: string | RegExp) => screen.getByRole('button', { name });

/** A life taken to the finances of its current round, without the screen. */
async function inFinance(lifeId: string) {
  const services = memoryServices();
  // The heir is a life a player has to unlock before choosing it.
  await services.store.saveProfile({ ...(await services.store.loadProfile()), unlocked: { heir: { at: 1, gameId: 'earlier' } } });
  const session = await services.sessions.start(lifeId);
  await toFinance(session);
  return { services, session };
}
async function toFinance(session: GameSession) {
  while (session.view().phase === 'cards') await session.answerCard(0);
}
const stateOf = async (services: ReturnType<typeof memoryServices>) => ((await services.store.loadGame()) as SavedGame).state;

describe('the pension', () => {
  it('offers exactly what the round still allows, and the whole of that is accepted', async () => {
    // The heir has more cash than a round's pension cap, so the room is the cap and not the cash.
    const { services } = await inFinance('heir');
    const room = previewRound(content, viewOf(await stateOf(services)), { orders: [] }).pensionRoom;
    expect(room).toBeGreaterThan(0);
    expect(room).toBeLessThan((await stateOf(services)).player.cash);
    const user = userEvent.setup();
    renderGame(<Play />, services);

    expect(await screen.findByText(`Up to ${fmt.money(room)} more this round`)).toBeTruthy();
    await user.click(button('Add'));
    const sheet = screen.getByRole('dialog', { name: 'Pay into your pension' });
    expect(within(sheet).getByText(`Up to ${fmt.money(room)}`)).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: '100%' }));
    await user.click(within(sheet).getByRole('button', { name: /^Confirm/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(button('1 order')).toBeTruthy();
    // The room is used up, and the screen says so instead of offering a sheet that would refuse everything.
    expect(screen.getByText('Nothing more can go in this round.')).toBeTruthy();
    expect((button('Add') as HTMLButtonElement).disabled).toBe(true);
  });

  it('offers nothing to someone who owes more than they own, instead of a sheet that refuses every amount', async () => {
    // The engineer starts with a student loan larger than their cash.
    const { services } = await inFinance('engineer');
    expect(previewRound(content, viewOf(await stateOf(services)), { orders: [] }).pensionRoom).toBe(0);
    renderGame(<Play />, services);
    expect(await screen.findByText('Nothing more can go in this round.')).toBeTruthy();
    expect((button('Add') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('the homes a player owns', () => {
  it('keeps a home that was just put up for sale in its place, so a second tap cannot sell the next one', async () => {
    const { services } = await inFinance('heir');
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Property' }));
    const owned = screen.getByRole('region', { name: 'Your properties' });
    expect(within(owned).getByText('Flat')).toBeTruthy();
    expect(within(owned).getByText(/You live here/)).toBeTruthy();

    await user.click(within(owned).getByRole('button', { name: /^Sell for/ }));
    expect(button('1 order')).toBeTruthy();
    expect(within(owned).getByText('Flat')).toBeTruthy();
    const selling = within(owned).getByRole('button', { name: 'Sold when the round is played' }) as HTMLButtonElement;
    expect(selling.disabled).toBe(true);
    expect(within(owned).queryByRole('button', { name: /^Sell for/ })).toBeNull();
    await user.click(selling);
    expect(button('1 order')).toBeTruthy();
  });

  it('says "You live here" of the one home the engine says the player lives in, not of every home in town', async () => {
    const { services, session } = await inFinance('heir');
    const quote = quoteProperty(content, session.view(), 'studio');
    const bought = await session.playRound({ orders: [{ type: 'buyProperty', typeId: 'studio', downPayment: quote.minDown, mortgage: 'fixed', rented: false }] });
    expect(bought.events.filter((e) => e.kind === 'orderRejected')).toEqual([]);
    expect(session.view().player.properties).toHaveLength(2);
    await toFinance(session);
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Property' }));
    const owned = screen.getByRole('region', { name: 'Your properties' });
    expect(within(owned).getAllByText(/You live here/)).toHaveLength(1);
    expect(within(owned).getAllByText(/Standing empty/)).toHaveLength(1);
  });
});
