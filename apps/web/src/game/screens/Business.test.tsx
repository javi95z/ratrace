// @vitest-environment jsdom
import { content, textFor } from '@ratrace/content';
import { quoteBusinesses, viewOf } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatFor } from '@ratrace/core/lib/format';
import type { GameSession, SavedGame } from '@ratrace/core/session/types';
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

// A wide screen, where the orders of the round are listed beside the finances.
beforeEach(() => setWidth('desk'));
afterEach(cleanup);

const fmt = formatFor('en');
const { text } = textFor('en');
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const stateOf = async (services: ReturnType<typeof memoryServices>) => ((await services.store.loadGame()) as SavedGame).state;
const toFinance = async (session: GameSession) => {
  while (session.view().phase === 'cards') await session.answerCard(0);
};
const ordersOf = () => screen.queryAllByRole('button', { name: /^Remove: /, hidden: true }).map((b) => (b.getAttribute('aria-label') ?? '').replace('Remove: ', ''));

/** A life taken to the finances of its first round. The founder starts with a shop of her own. */
async function inFinance(lifeId: string) {
  const services = memoryServices();
  await services.store.saveProfile({ ...(await services.store.loadProfile()), unlocked: { founder: { at: 1, gameId: 'earlier' }, comeback: { at: 1, gameId: 'earlier' }, waiter: { at: 1, gameId: 'earlier' } } });
  const session = await services.sessions.start(lifeId);
  await toFinance(session);
  return { services, session };
}
const openTab = async (user: ReturnType<typeof userEvent.setup>) => user.click(await screen.findByRole('tab', { name: 'Business' }));

describe('the business tab', () => {
  it('shows each kind the player could open: what it asks for, what it makes, how the economy treats it now; and nothing of what is closed', async () => {
    const { services } = await inFinance('nurse');
    const quote = quoteBusinesses(content, viewOf(await stateOf(services)));
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await openTab(user);
    expect(within(screen.getByRole('region', { name: 'Your businesses' })).getByText(/^You have none yet\./)).toBeTruthy();

    // A nurse knows too little about money for anything but her own practice: the others are not offered.
    expect(quote.kinds.map((kind) => kind.lock)).toEqual([null, 'needs-finance-skill', 'needs-finance-skill', 'needs-finance-skill', 'needs-finance-skill']);
    const panel = screen.getByRole('region', { name: 'Open a business' });
    const kinds = within(panel).getAllByRole('listitem');
    expect(kinds).toHaveLength(1);
    const [kind] = quote.kinds;
    const row = within(kinds[0]);
    expect(row.getByText(text.businessTypes[kind.typeId].name)).toBeTruthy();
    expect(row.getByText(`from ${fmt.compact(kind.minCapital)}`)).toBeTruthy();
    expect(row.getByText(`Makes up to ${fmt.rate(kind.yieldBp)} a year`)).toBeTruthy();
    expect(row.getByText(`Manager: ${kind.managerPct}% of the profit`)).toBeTruthy();
    expect(row.getByText(/^The economy now: /)).toBeTruthy();
    expect(row.getByRole('button', { name: 'Open it' })).toBeTruthy();
    // What needs more Finance is not shown, nor said to be coming.
    expect(within(panel).queryByText(/more kinds? of business/)).toBeNull();
  });

  it('says how much cash is missing instead of offering what cannot be paid for', async () => {
    // The waiter starts with next to nothing in hand.
    const { services } = await inFinance('waiter');
    const state = await stateOf(services);
    const kind = quoteBusinesses(content, viewOf(state)).kinds[0];
    expect(state.player.cash).toBeLessThan(kind.minCapital);
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await openTab(user);
    const first = within(screen.getByRole('region', { name: 'Open a business' })).getAllByRole('listitem')[0];
    expect(within(first).queryByRole('button')).toBeNull();
    expect(within(first).getByText(`You are ${fmt.money(kind.minCapital - state.player.cash)} in cash short of opening it.`)).toBeTruthy();
  });

  it('opens one: the capital leaves the cash, a point of focus goes, and it is the player\'s from the next round', async () => {
    const { services } = await inFinance('nurse');
    const before = await stateOf(services);
    const kind = quoteBusinesses(content, viewOf(before)).kinds[0];
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await openTab(user);
    await user.click(within(within(screen.getByRole('region', { name: 'Open a business' })).getAllByRole('listitem')[0]).getByRole('button', { name: 'Open it' }));
    const sheet = screen.getByRole('dialog', { name: 'Open: Your own practice' });
    // The sheet opens on the least it takes.
    expect(within(sheet).getByRole('status').textContent).toBe(fmt.money(kind.minCapital));
    await user.click(within(sheet).getByRole('button', { name: `Confirm ${fmt.money(kind.minCapital)}` }));
    expect(ordersOf()).toEqual([`Open Your own practice with ${fmt.money(kind.minCapital)}`]);

    // It is listed at once, run by its owner, and says it cannot be touched until the round is played.
    const yours = screen.getByRole('region', { name: 'Your businesses' });
    const row = within(yours).getByRole('button', { name: /Your own practice/ });
    expect(row.textContent).toContain('You run it this round');
    expect(row.textContent).toContain(fmt.money(kind.minCapital));
    await user.click(row);
    const own = screen.getByRole('dialog', { name: 'Your own practice' });
    expect(within(own).getByText(/^It opens when the round is played\./)).toBeTruthy();
    expect(within(own).queryByRole('switch')).toBeNull();
    await user.click(within(own).getByRole('button', { name: 'Close' }));

    await user.click(button('Play the round'));
    await screen.findByRole('heading', { name: 'Two years later' });
    const after = await stateOf(services);
    expect(after.player.businesses).toMatchObject([{ typeId: 'services', basis: kind.minCapital, payoutPct: 50, manager: false, tended: false }]);
    expect(screen.getByText('Business profit taken out')).toBeTruthy();
  });

  it('runs one: what the round makes of it, what is taken out, who runs it, more money in, and a sale', async () => {
    const { services } = await inFinance('founder');
    const state = await stateOf(services);
    const [shop] = quoteBusinesses(content, viewOf(state)).owned;
    expect(shop).toMatchObject({ typeId: 'shop', tended: true, manager: false, payoutPct: 50 });
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await openTab(user);
    const yours = screen.getByRole('region', { name: 'Your businesses' });
    const row = within(yours).getByRole('button', { name: /Online shop/ });
    expect(row.textContent).toContain(fmt.money(shop.capital));
    expect(row.textContent).toContain(`${fmt.signed(shop.profit)} this round`);
    await user.click(row);
    let sheet = screen.getByRole('dialog', { name: 'Online shop' });
    const round = within(sheet).getByRole('region', { name: 'This round' });
    expect(within(round).getByText(fmt.signed(shop.profit))).toBeTruthy();
    expect(within(round).getByText(fmt.money(shop.payout))).toBeTruthy();
    expect(within(round).getByText(fmt.signed(shop.retained))).toBeTruthy();

    // All of the profit taken out: one order, and the sheet shows the round as it will then be.
    await user.click(within(sheet).getByRole('radio', { name: /^Take it/ }));
    expect(ordersOf()).toEqual(['Change how Online shop is run']);
    const all = quoteBusinesses(content, { ...viewOf(state), player: { ...state.player, businesses: [{ ...state.player.businesses[0], payoutPct: 100 }] } }).owned[0];
    expect(within(within(sheet).getByRole('region', { name: 'This round' })).getByText(fmt.money(all.payout))).toBeTruthy();
    // A manager on top of that is still the one order; back to how it stood, and there is none.
    await user.click(within(sheet).getByRole('switch', { name: /^Hire a manager/ }));
    expect(ordersOf()).toEqual(['Change how Online shop is run']);
    expect(within(sheet).getByText('A manager runs it')).toBeTruthy();
    await user.click(within(sheet).getByRole('switch', { name: /^Hire a manager/ }));
    await user.click(within(sheet).getByRole('radio', { name: /^Half and half/ }));
    expect(ordersOf()).toEqual([]);

    // More money in.
    await user.click(within(sheet).getByRole('button', { name: 'Put more money in' }));
    const amount = screen.getByRole('dialog', { name: 'Put money into: Online shop' });
    fireEvent.change(within(amount).getByRole('slider', { name: 'Amount' }), { target: { value: '100000' } });
    await user.click(within(amount).getByRole('button', { name: 'Confirm $1,000' }));
    expect(ordersOf()).toEqual(['Put $1,000 into Online shop']);
    expect(within(screen.getByRole('region', { name: 'Your businesses' })).getByRole('button', { name: /Online shop/ }).textContent).toContain(fmt.money(shop.capital + 100_000));

    // Sold: it is gone from the list, and the order says so.
    await user.click(within(screen.getByRole('region', { name: 'Your businesses' })).getByRole('button', { name: /Online shop/ }));
    sheet = screen.getByRole('dialog', { name: 'Online shop' });
    expect(within(sheet).getByText(new RegExp(`^In this economy a buyer pays ${content.business.salePct[state.timeline[0].regime]}% of what is in it\\.`))).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: /^Sell for/ }));
    expect(screen.queryByRole('dialog', { name: 'Online shop' })).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Your businesses' })).queryByRole('button', { name: /Online shop/ })).toBeNull();
    expect(ordersOf()).toContain('Sell Online shop');
  });

  it('asks for the owner\'s focus each round, and says what happens without it', async () => {
    const { services, session } = await inFinance('founder');
    // A round on, nobody has given the shop this round's focus yet.
    await session.playRound({ orders: [] });
    await toFinance(session);
    const state = await stateOf(services);
    const [shop] = quoteBusinesses(content, viewOf(state)).owned;
    expect(shop).toMatchObject({ tended: false, neglected: true });
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await openTab(user);
    // The round begins with the owner running it, as far as the focus goes (core's round defaults); taken back, nobody runs it.
    const row = within(screen.getByRole('region', { name: 'Your businesses' })).getByRole('button', { name: /Online shop/ });
    await user.click(row);
    const sheet = screen.getByRole('dialog', { name: 'Online shop' });
    const tend = within(sheet).getByRole('switch', { name: /^Give it your focus this round/ });
    expect(tend.getAttribute('aria-checked')).toBe('true');
    await user.click(tend);
    expect(tend.getAttribute('aria-checked')).toBe('false');
    expect(within(sheet).getByText(`Without your focus or a manager it makes only ${content.business.neglectProfitPct}% of what it could, and loses value.`)).toBeTruthy();

    await user.click(tend);
    expect(tend.getAttribute('aria-checked')).toBe('true');
    expect(ordersOf()).toEqual(['Give your focus to Online shop']);
    expect(within(sheet).getByText('You run it this round')).toBeTruthy();
    expect(within(sheet).queryByText(/^Without your focus or a manager/)).toBeNull();
    // With a manager the focus is not asked for, and the switch says so.
    await user.click(tend);
    await user.click(within(sheet).getByRole('switch', { name: /^Hire a manager/ }));
    expect((within(sheet).getByRole('switch', { name: /^Give it your focus this round/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(sheet).getByText('With a manager there is no need.')).toBeTruthy();
  });

  it('counts in the portfolio at a glance and in the balance sheet of the profile', async () => {
    const { services } = await inFinance('founder');
    const state = await stateOf(services);
    const user = userEvent.setup();
    renderGame(<Play />, services);
    const glance = await screen.findByRole('region', { name: 'At a glance' });
    expect(within(glance).getByText('Businesses')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Businesses/ }));
    const sheet = screen.getByRole('dialog', { name: 'Businesses' });
    expect(within(sheet).getByText('Online shop')).toBeTruthy();
    expect(within(sheet).getByText(fmt.money(state.player.businesses[0].capital))).toBeTruthy();
  });

  it('shows every business at a glance, all of them summed, and runs each from the list without opening it', async () => {
    const { services } = await inFinance('founder');
    const quote = quoteBusinesses(content, viewOf(await stateOf(services)));
    const [shop] = quote.owned;
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await openTab(user);
    const panel = screen.getByRole('region', { name: 'Your businesses' });
    expect(within(panel).getByText('Worth')).toBeTruthy();
    expect(within(panel).getAllByText(fmt.compact(shop.capital)).length).toBeGreaterThan(0);
    expect(within(panel).getByText(`${fmt.money(shop.payout)} to you`)).toBeTruthy();
    expect(within(panel).getByRole('img', { name: /of 5 stars$/ })).toBeTruthy();
    // The founder runs her shop herself this round: the switch is on, and taking it off is an order like any other.
    const tend = within(panel).getByRole('button', { name: /Run it yourself · 1 focus/ });
    expect(tend.getAttribute('aria-pressed')).toBe(String(shop.tended));
    const manager = within(panel).getByRole('button', { name: `Manager · ${shop.managerPct}%` });
    expect(manager.getAttribute('aria-pressed')).toBe('false');
    await user.click(manager);
    expect(ordersOf()).toContain(`Change how ${text.businessTypes[shop.typeId].name} is run`);
    expect(within(panel).getByRole('button', { name: /Manager · / }).getAttribute('aria-pressed')).toBe('true');
    // With a manager, the player's focus is not asked for.
    expect((within(panel).getByRole('button', { name: /Run it yourself/ }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(within(panel).getByRole('button', { name: /Manager · / }));
    expect(ordersOf()).not.toContain(`Change how ${text.businessTypes[shop.typeId].name} is run`);
  });

  it('gives the focus back when a manager takes over a business the player was to run', async () => {
    // A round on, the shop the founder opened waits to be run again.
    const { services, session } = await inFinance('founder');
    await session.playRound({ orders: [] });
    await toFinance(session);
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await openTab(user);
    const panel = screen.getByRole('region', { name: 'Your businesses' });
    const tend = () => within(panel).getByRole('button', { name: /Run it yourself/ }) as HTMLButtonElement;
    // The round begins with the owner running it (core's round defaults).
    expect(tend().getAttribute('aria-pressed')).toBe('true');
    await user.click(within(panel).getByRole('button', { name: /Manager · / }));
    // Never both: the manager runs it, the order to run it oneself is gone, and nothing is stuck on.
    expect(tend().getAttribute('aria-pressed')).toBe('false');
    expect(tend().disabled).toBe(true);
    // Without the manager, the player may run it again.
    await user.click(within(panel).getByRole('button', { name: /Manager · / }));
    expect(tend().disabled).toBe(false);
  });

  it('shows a business opened by a card this round as no longer the player\'s to run once a manager takes it', async () => {
    // A round on, a card has just handed the founder a shop: it counts as run by them this round, whatever is ordered.
    const { services, session } = await inFinance('founder');
    await session.playRound({ orders: [] });
    await toFinance(session);
    const view = (): GameView => ({ ...session.view(), player: { ...session.view().player, businesses: session.view().player.businesses.map((one) => ({ ...one, tended: true })) } });
    const opened: GameSession = { gameId: session.gameId, lifeId: session.lifeId, view, history: () => session.history(), bankruptcies: () => 0, story: () => [], badges: () => [], answerCard: (option) => session.answerCard(option), playRound: (choices) => session.playRound(choices) };
    services.sessions.resume = async () => ({ lost: null, session: opened });
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await openTab(user);
    const panel = screen.getByRole('region', { name: 'Your businesses' });
    const tend = () => within(panel).getByRole('button', { name: /Run it yourself/ }) as HTMLButtonElement;
    expect(tend().getAttribute('aria-pressed')).toBe('true');
    await user.click(within(panel).getByRole('button', { name: /Manager · / }));
    expect(tend().getAttribute('aria-pressed')).toBe('false');
    expect(tend().disabled).toBe(true);
  });

  it('offers a trade of the player\'s own only to a trade that can be sold on its own', async () => {
    const { services } = await inFinance('civil_servant');
    const quote = quoteBusinesses(content, viewOf(await stateOf(services)));
    expect(quote.kinds.find((kind) => kind.typeId === 'services')?.lock).toBe('not-your-trade');
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await openTab(user);
    expect(within(screen.getByRole('region', { name: 'Open a business' })).queryAllByRole('listitem')).toHaveLength(0);
  });
});
