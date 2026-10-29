// @vitest-environment jsdom
import { businessStageArt, content, textFor } from '@ratrace/content';
import { messagesFor } from '@ratrace/i18n';
import type { RoundActions, RoundState } from '@ratrace/core/game/store';
import { formatFor } from '@ratrace/core/lib/format';
import type { GameSession, SavedGame } from '@ratrace/core/session/types';
import { focusLeft, previewRound, quoteBusinesses, viewOf } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame, spriteRenders } from '../../testing/render';
import { settled } from '../../testing/renders';
import { TOUCH } from '../../ui/theme';
import { useGame } from '../context';
import { Play } from './Play';

/*
 * The businesses of the finances (the web's Business.test.tsx, all of it), on the phone: there the orders of the round are in the basket's sheet,
 * not beside the finances. And what the phone adds: a business is opened and sold once for a double tap, its line is drawn again only for what it
 * shows, its small switches take a thumb's 44, and in Russian its line is laid out to wrap.
 */

// The slider's gesture is the phone's (its native side cannot be loaded here): a stand-in that keeps what the sheet hands it, for a test to move.
type SliderProps = { value: number; min: number; max: number; step: number; onChange(value: number): void; label: string; valueText?: string };
const sliders = vi.hoisted(() => [] as SliderProps[]);
vi.mock('../../ui/Slider', () => ({
  Slider: (props: SliderProps) => {
    sliders.push(props);
    return createElement('div', { role: 'slider', 'aria-label': props.label, 'aria-valuenow': props.value, 'aria-valuetext': props.valueText });
  },
}));

beforeEach(() => {
  sliders.length = 0;
});
afterEach(cleanup);

const fmt = formatFor('en');
const ru = messagesFor('ru');
const { text } = textFor('en');
const button = (name: string | RegExp) => screen.getByRole('button', { name });
/** A sheet by its title: the window that holds it. */
const sheetTitled = (title: string) => screen.getByRole('heading', { name: title }).closest('[aria-modal="true"]') as HTMLElement;
const sheetGone = (title: string) => waitFor(() => expect(screen.queryByRole('heading', { name: title })).toBeNull());
/** A panel by the name it is given: the web's `section`, named. */
const panel = (name: string) => screen.getByLabelText(name);
const slide = (value: number) => act(() => sliders[sliders.length - 1].onChange(value));
const stateOf = async (services: ReturnType<typeof memoryServices>) => ((await services.store.loadGame()) as SavedGame).state;
const toFinance = async (session: GameSession) => {
  while (session.view().phase === 'cards') await session.answerCard(0);
};

/** The round store as it stands, and its actions. */
const probe: { state: (RoundState & RoundActions) | null } = { state: null };
function Probe() {
  probe.state = useGame((s) => s);
  return null;
}
/** The orders of the round, by their names in the basket (the web lists them beside the finances; on the phone they are what the basket names). */
const ordersOf = (): string[] => {
  const orders = probe.state?.orders ?? [];
  if (orders.length === 0) return [];
  fireEvent.click(button(orders.length === 1 ? '1 order' : `${orders.length} orders`));
  const names = within(sheetTitled("This round's orders"))
    .queryAllByRole('button', { name: /^Remove: / })
    .map((b) => (b.getAttribute('aria-label') ?? '').replace('Remove: ', ''));
  fireEvent.click(within(sheetTitled("This round's orders")).getByRole('button', { name: 'Close' }));
  return names;
};

/** A life taken to the finances of its first round. The founder starts with a shop of her own. */
async function inFinance(lifeId: string) {
  const services = memoryServices();
  await services.store.saveProfile({ ...(await services.store.loadProfile()), unlocked: { founder: { at: 1, gameId: 'earlier' }, comeback: { at: 1, gameId: 'earlier' }, waiter: { at: 1, gameId: 'earlier' } } });
  const session = await services.sessions.start(lifeId);
  await toFinance(session);
  return { services, session };
}
/** A life whose view is changed as the test needs it, played on as the real one is. */
function changed(services: ReturnType<typeof memoryServices>, session: GameSession, change: (view: GameView) => GameView) {
  const view = (): GameView => change(session.view());
  const life: GameSession = { gameId: session.gameId, lifeId: session.lifeId, view, history: () => session.history(), bankruptcies: () => 0, story: () => [], badges: () => [], answerCard: (option) => session.answerCard(option), playRound: (choices) => session.playRound(choices) };
  services.sessions.resume = async () => ({ lost: null, session: life });
}
async function openTab(services: ReturnType<typeof memoryServices>, locale: 'en' | 'ru' = 'en') {
  renderGame(
    <>
      <Play />
      <Probe />
    </>,
    services,
    locale,
  );
  fireEvent.click(await screen.findByRole('tab', { name: (locale === 'en' ? messagesFor('en') : ru).finance.tabs.business }));
  await settled();
}
const yours = () => panel('Your businesses');
const opening = () => panel('Open a business');

describe('the business tab', () => {
  it('shows each kind the player could open: what it asks for, what it makes, how the economy treats it now; and nothing of what is closed', async () => {
    const { services } = await inFinance('nurse');
    const quote = quoteBusinesses(content, viewOf(await stateOf(services)));
    await openTab(services);
    expect(within(yours()).getByText(/^You have none yet\./)).toBeTruthy();

    // A nurse knows too little about money for anything but her own practice: the others are not offered.
    expect(quote.kinds.map((kind) => kind.lock)).toEqual([null, 'needs-finance-skill', 'needs-finance-skill', 'needs-finance-skill', 'needs-finance-skill']);
    const kinds = within(opening()).getAllByRole('listitem');
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
    expect(within(opening()).queryByText(/more kinds? of business/)).toBeNull();
  });

  it('says how much cash is missing instead of offering what cannot be paid for', async () => {
    // The waiter starts with next to nothing in hand.
    const { services } = await inFinance('waiter');
    const state = await stateOf(services);
    const kind = quoteBusinesses(content, viewOf(state)).kinds[0];
    expect(state.player.cash).toBeLessThan(kind.minCapital);
    await openTab(services);
    const first = within(opening()).getAllByRole('listitem')[0];
    expect(within(first).queryByRole('button')).toBeNull();
    expect(within(first).getByText(`You are ${fmt.money(kind.minCapital - state.player.cash)} in cash short of opening it.`)).toBeTruthy();
  });

  it('opens one: the capital leaves the cash, a point of focus goes, and it is the player\'s from the next round', async () => {
    const { services } = await inFinance('nurse');
    const before = await stateOf(services);
    const kind = quoteBusinesses(content, viewOf(before)).kinds[0];
    await openTab(services);
    fireEvent.click(within(within(opening()).getAllByRole('listitem')[0]).getByRole('button', { name: 'Open it' }));
    const sheet = sheetTitled('Open: Your own practice');
    // The sheet opens on the least it takes, and says what it asks for.
    expect(sliders[sliders.length - 1].value).toBe(kind.minCapital);
    expect(within(sheet).getByText(fmt.money(kind.minCapital))).toBeTruthy();
    expect(within(sheet).getByText(/^It takes at least /)).toBeTruthy();
    const confirm = within(sheet).getByRole('button', { name: `Confirm ${fmt.money(kind.minCapital)}` });
    // A double tap: one business opened, and nothing refused.
    act(() => {
      fireEvent.click(confirm);
      fireEvent.click(confirm);
    });
    await sheetGone('Open: Your own practice');
    expect(probe.state!.orders).toEqual([{ type: 'startBusiness', typeId: 'services', capital: kind.minCapital }]);
    expect(probe.state!.refusal).toBeNull();
    expect(ordersOf()).toEqual([`Open Your own practice with ${fmt.money(kind.minCapital)}`]);
    await sheetGone("This round's orders");

    // It is listed at once, run by its owner, and says it cannot be touched until the round is played.
    const row = within(yours()).getByRole('button', { name: /Your own practice/ });
    expect(row.textContent).toContain('You run it this round');
    expect(row.textContent).toContain(fmt.money(kind.minCapital));
    fireEvent.click(row);
    const own = sheetTitled('Your own practice');
    expect(within(own).getByText(/^It opens when the round is played\./)).toBeTruthy();
    expect(within(own).queryByRole('switch')).toBeNull();
    fireEvent.click(within(own).getByRole('button', { name: 'Close' }));
    await sheetGone('Your own practice');

    fireEvent.click(button('Play the round'));
    await screen.findByRole('heading', { name: 'Two years later' });
    await waitFor(async () => expect((await stateOf(services)).round).toBe(before.round + 1));
    const after = await stateOf(services);
    expect(after.player.businesses).toMatchObject([{ typeId: 'services', basis: kind.minCapital, payoutPct: 50, manager: false, tended: false }]);
    // The year's ledger says what the business gave the player.
    expect(screen.getByText('Business profit taken out')).toBeTruthy();
  });

  it('runs one: what the round makes of it, what is taken out, who runs it, more money in, and a sale', async () => {
    const { services } = await inFinance('founder');
    const state = await stateOf(services);
    const [shop] = quoteBusinesses(content, viewOf(state)).owned;
    expect(shop).toMatchObject({ typeId: 'shop', tended: true, manager: false, payoutPct: 50 });
    await openTab(services);
    const row = within(yours()).getByRole('button', { name: /Online shop/ });
    expect(row.textContent).toContain(fmt.money(shop.capital));
    expect(row.textContent).toContain(`${fmt.signed(shop.profit)} this round`);
    fireEvent.click(row);
    let sheet = sheetTitled('Online shop');
    const round = within(sheet).getByLabelText('This round');
    expect(within(round).getByText(fmt.signed(shop.profit))).toBeTruthy();
    expect(within(round).getByText(fmt.money(shop.payout))).toBeTruthy();
    expect(within(round).getByText(fmt.signed(shop.retained))).toBeTruthy();

    // All of the profit taken out: one order, and the sheet shows the round as it will then be.
    fireEvent.click(within(sheet).getByRole('radio', { name: /^Take it/ }));
    await settled();
    expect(probe.state!.orders).toEqual([{ type: 'setBusiness', businessId: shop.id, payoutPct: 100 }]);
    const all = quoteBusinesses(content, { ...viewOf(state), player: { ...state.player, businesses: [{ ...state.player.businesses[0], payoutPct: 100 }] } }).owned[0];
    expect(within(within(sheetTitled('Online shop')).getByLabelText('This round')).getByText(fmt.money(all.payout))).toBeTruthy();
    // A manager on top of that is still the one order; back to how it stood, and there is none.
    fireEvent.click(within(sheetTitled('Online shop')).getByRole('switch', { name: /^Hire a manager/ }));
    await settled();
    expect(probe.state!.orders).toEqual([{ type: 'setBusiness', businessId: shop.id, payoutPct: 100, manager: true }]);
    expect(within(sheetTitled('Online shop')).getByText('A manager runs it')).toBeTruthy();
    fireEvent.click(within(sheetTitled('Online shop')).getByRole('switch', { name: /^Hire a manager/ }));
    fireEvent.click(within(sheetTitled('Online shop')).getByRole('radio', { name: /^Half and half/ }));
    await settled();
    expect(probe.state!.orders).toEqual([]);

    // More money in: the sheet of the amount takes the business's place, and gives it back.
    fireEvent.click(within(sheetTitled('Online shop')).getByRole('button', { name: 'Put more money in' }));
    const amount = sheetTitled('Put money into: Online shop');
    expect(screen.queryByRole('heading', { name: 'Online shop' })).toBeNull();
    slide(100_000);
    const confirm = within(amount).getByRole('button', { name: 'Confirm $1,000' });
    // A double tap puts in $1,000, not twice that.
    act(() => {
      fireEvent.click(confirm);
      fireEvent.click(confirm);
    });
    await settled();
    expect(probe.state!.orders).toEqual([{ type: 'investBusiness', businessId: shop.id, amount: 100_000 }]);
    expect(screen.getByRole('heading', { name: 'Online shop' })).toBeTruthy();
    fireEvent.click(within(sheetTitled('Online shop')).getByRole('button', { name: 'Close' }));
    await sheetGone('Online shop');
    expect(ordersOf()).toEqual(['Put $1,000 into Online shop']);
    await sheetGone("This round's orders");
    expect(within(yours()).getByRole('button', { name: /Online shop/ }).textContent).toContain(fmt.money(shop.capital + 100_000));

    // Sold: it is gone from the list, and the order says so; a double tap sells it once.
    fireEvent.click(within(yours()).getByRole('button', { name: /Online shop/ }));
    sheet = sheetTitled('Online shop');
    expect(within(sheet).getByText(new RegExp(`^In this economy a buyer pays ${content.business.salePct[state.timeline[0].regime]}% of what is in it\\.`))).toBeTruthy();
    const sell = within(sheet).getByRole('button', { name: /^Sell for/ });
    expect(sell.querySelector('[data-sprite="icon.handover"]')).not.toBeNull();
    act(() => {
      fireEvent.click(sell);
      fireEvent.click(sell);
    });
    await sheetGone('Online shop');
    expect(within(yours()).queryByRole('button', { name: /Online shop/ })).toBeNull();
    expect(probe.state!.orders.filter((order) => order.type === 'sellBusiness')).toEqual([{ type: 'sellBusiness', businessId: shop.id }]);
    expect(probe.state!.refusal).toBeNull();
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
    await openTab(services);
    // The round begins with the owner running it, as an order the player can take out.
    expect(probe.state!.orders).toEqual([{ type: 'tendBusiness', businessId: shop.id }]);
    expect(within(yours()).getByRole('button', { name: /Online shop/ }).textContent).toContain('You run it this round');
    fireEvent.click(within(yours()).getByRole('button', { name: /Run it yourself/ }));
    await settled();
    expect(probe.state!.orders).toEqual([]);
    const row = within(yours()).getByRole('button', { name: /Online shop/ });
    expect(row.textContent).toContain('Nobody runs it: it makes half and wears down');
    fireEvent.click(row);
    const sheet = () => sheetTitled('Online shop');
    expect(within(sheet()).getByText(`Without your focus or a manager it makes only ${content.business.neglectProfitPct}% of what it could, and loses value.`)).toBeTruthy();

    const tend = () => within(sheet()).getByRole('switch', { name: /^Give it your focus this round/ });
    fireEvent.click(tend());
    await settled();
    expect(tend().getAttribute('aria-checked')).toBe('true');
    expect(probe.state!.orders).toEqual([{ type: 'tendBusiness', businessId: shop.id }]);
    expect(within(sheet()).getByText('You run it this round')).toBeTruthy();
    expect(within(sheet()).queryByText(/^Without your focus or a manager/)).toBeNull();
    // A manager takes over from the player's focus; and the player can take it back, which lets the manager go.
    const manager = () => within(sheet()).getByRole('switch', { name: /^Hire a manager/ });
    fireEvent.click(manager());
    await settled();
    expect(tend().getAttribute('aria-checked')).toBe('false');
    expect(tend().getAttribute('aria-disabled')).not.toBe('true');
    expect(probe.state!.orders.some((order) => order.type === 'tendBusiness')).toBe(false);
    fireEvent.click(tend());
    await settled();
    expect(tend().getAttribute('aria-checked')).toBe('true');
    expect(manager().getAttribute('aria-checked')).toBe('false');
    expect(probe.state!.orders).toEqual([{ type: 'tendBusiness', businessId: shop.id }]);
    fireEvent.click(manager());
    await settled();
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Close' }));
    await sheetGone('Online shop');
    expect(ordersOf()).toEqual(['Change how Online shop is run']);
  });

  it('counts in the portfolio at a glance and in the balance sheet of the profile', async () => {
    const { services } = await inFinance('founder');
    const state = await stateOf(services);
    renderGame(<Play />, services);
    const glance = await screen.findByLabelText('At a glance');
    expect(within(glance).getByText('Businesses')).toBeTruthy();
    // The balance sheet is the profile's, which the portrait opens on a phone (the web's wide screen keeps it beside the game).
    fireEvent.click(button('Open your profile'));
    fireEvent.click(within(within(sheetTitled('Your life')).getByLabelText('Balance sheet')).getByRole('button', { name: /^Businesses/ }));
    const sheet = sheetTitled('Businesses');
    expect(within(sheet).getByText('Online shop')).toBeTruthy();
    expect(within(sheet).getByText(fmt.money(state.player.businesses[0].capital))).toBeTruthy();
  });

  it('shows every business at a glance, all of them summed, and runs each from the list without opening it', async () => {
    const { services } = await inFinance('founder');
    const quote = quoteBusinesses(content, viewOf(await stateOf(services)));
    const [shop] = quote.owned;
    await openTab(services);
    expect(within(yours()).getByText('Worth')).toBeTruthy();
    expect(within(yours()).getAllByText(fmt.compact(shop.capital)).length).toBeGreaterThan(0);
    expect(within(yours()).getByText(`${fmt.money(shop.payout)} to you`)).toBeTruthy();
    expect(within(yours()).getByRole('img', { name: /of 5 stars$/ })).toBeTruthy();
    // The founder runs her shop herself this round: the switch is on, and taking it off is an order like any other.
    const tend = () => within(yours()).getByRole('button', { name: /Run it yourself · 1 focus/ });
    expect(tend().getAttribute('aria-selected')).toBe(String(shop.tended));
    const manager = () => within(yours()).getByRole('button', { name: new RegExp(`Manager · ${shop.managerPct}%`) });
    expect(manager().getAttribute('aria-selected')).toBe('false');
    fireEvent.click(manager());
    await settled();
    expect(ordersOf()).toContain(`Change how ${text.businessTypes[shop.typeId].name} is run`);
    expect(manager().getAttribute('aria-selected')).toBe('true');
    expect(manager().textContent).toBe(`✓ Manager · ${shop.managerPct}%`);
    // With a manager the player's own switch is off (taking it back is the next tests').
    expect(tend().getAttribute('aria-selected')).toBe('false');
    fireEvent.click(manager());
    await settled();
    expect(ordersOf()).not.toContain(`Change how ${text.businessTypes[shop.typeId].name} is run`);
  });

  it('gives the focus back when a manager takes over a business the player was to run', async () => {
    // A round on, the shop the founder opened waits to be run again.
    const { services, session } = await inFinance('founder');
    await session.playRound({ orders: [] });
    await toFinance(session);
    await openTab(services);
    const tend = () => within(yours()).getByRole('button', { name: /Run it yourself/ });
    const manager = () => within(yours()).getByRole('button', { name: /Manager · / });
    // The round begins with the owner running it.
    expect(tend().getAttribute('aria-selected')).toBe('true');
    fireEvent.click(manager());
    await settled();
    // Never both: the manager runs it, the order to run it oneself is gone, and nothing is stuck on.
    expect(tend().getAttribute('aria-selected')).toBe('false');
    expect(probe.state!.orders.some((order) => order.type === 'tendBusiness')).toBe(false);
    // The player takes it back from the manager with their own switch: the manager goes, and the focus runs it.
    expect(tend().getAttribute('aria-disabled')).not.toBe('true');
    fireEvent.click(tend());
    await settled();
    expect(tend().getAttribute('aria-selected')).toBe('true');
    expect(manager().getAttribute('aria-selected')).toBe('false');
    expect(probe.state!.orders.filter((order) => order.type === 'tendBusiness' || order.type === 'setBusiness')).toEqual([{ type: 'tendBusiness', businessId: expect.any(String) }]);
  });

  it('drops the order to run it oneself when the business becomes the job, and gives its focus back', async () => {
    // The founder's shop, strong enough to leave her job for, and nobody running it yet this round.
    const { services, session } = await inFinance('founder');
    changed(services, session, (view) => ({ ...view, player: { ...view.player, businesses: view.player.businesses.map((b) => ({ ...b, tended: false, strong: content.life.fullTime.strongRounds })) } }));
    await openTab(services);
    const view = probe.state!.view!;
    const shopId = view.player.businesses[0].id;
    expect(probe.state!.orders).toEqual([{ type: 'tendBusiness', businessId: shopId }]);
    fireEvent.click(within(yours()).getByRole('button', { name: /Online shop/ }));
    fireEvent.click(within(sheetTitled('Online shop')).getByRole('button', { name: 'Leave your job for it' }));
    await settled();
    // Only the job's change is left: run full time it needs no focus of the owner's, and the point is free again.
    expect(probe.state!.orders).toEqual([{ type: 'goFullTime', businessId: shopId }]);
    expect(focusLeft(probe.state!.preview!.player)).toBe(focusLeft(previewRound(content, view, { orders: [{ type: 'goFullTime', businessId: shopId }] }).player));
    expect(focusLeft(probe.state!.preview!.player)).toBeGreaterThan(focusLeft(previewRound(content, view, { orders: [{ type: 'tendBusiness', businessId: shopId }, { type: 'goFullTime', businessId: shopId }] }).player));
    // Nothing to run: neither switch is offered, in the list or in its sheet.
    fireEvent.click(within(sheetTitled('Online shop')).getByRole('button', { name: 'Close' }));
    await sheetGone('Online shop');
    expect(within(yours()).queryByRole('button', { name: /Run it yourself/ })).toBeNull();
    expect(within(yours()).queryByRole('button', { name: /Manager · / })).toBeNull();
  });

  it('offers no switch for a business run full time, and the round begins with no order for it', async () => {
    const { services, session } = await inFinance('founder');
    changed(services, session, (view) => ({ ...view, player: { ...view.player, businesses: view.player.businesses.map((b) => ({ ...b, tended: false, fullTime: true })) } }));
    await openTab(services);
    expect(probe.state!.orders).toEqual([]);
    expect(within(yours()).queryByRole('button', { name: /Run it yourself/ })).toBeNull();
    expect(within(yours()).queryByRole('button', { name: /Manager · / })).toBeNull();
  });

  it('gives a business taken off full time this round no order of its own: it is run only once the player switches it on', async () => {
    const { services, session } = await inFinance('founder');
    changed(services, session, (view) => ({
      ...view,
      player: { ...view.player, life: { ...view.player.life, formerCareer: view.player.life.career, career: null }, businesses: view.player.businesses.map((b) => ({ ...b, tended: false, fullTime: true })) },
    }));
    await openTab(services);
    const shopId = probe.state!.view!.player.businesses[0].id;
    act(() => {
      probe.state!.setOrder((order) => order.type === 'backToWork', { type: 'backToWork' });
    });
    await settled();
    // The defaults were made at the round's start, when it was the job: it is nobody's to run until the player says so.
    expect(probe.state!.orders).toEqual([{ type: 'backToWork' }]);
    const tend = () => within(yours()).getByRole('button', { name: /Run it yourself/ });
    expect(tend().getAttribute('aria-selected')).toBe('false');
    fireEvent.click(tend());
    await settled();
    expect(probe.state!.orders).toEqual([{ type: 'backToWork' }, { type: 'tendBusiness', businessId: shopId }]);
  });

  it('lets the player take back a business a manager has run since an earlier round: the manager goes, and the focus runs it', async () => {
    const { services, session } = await inFinance('founder');
    const [shop] = (await stateOf(services)).player.businesses;
    await session.playRound({ orders: [{ type: 'setBusiness', businessId: shop.id, manager: true }] });
    await toFinance(session);
    await openTab(services);
    const tend = () => within(yours()).getByRole('button', { name: /Run it yourself/ });
    const manager = () => within(yours()).getByRole('button', { name: /Manager · / });
    expect(manager().getAttribute('aria-selected')).toBe('true');
    expect(tend().getAttribute('aria-disabled')).not.toBe('true');
    fireEvent.click(tend());
    await settled();
    expect(tend().getAttribute('aria-selected')).toBe('true');
    expect(manager().getAttribute('aria-selected')).toBe('false');
    expect(probe.state!.orders).toEqual(expect.arrayContaining([{ type: 'setBusiness', businessId: shop.id, manager: false }, { type: 'tendBusiness', businessId: shop.id }]));
  });

  it('shows a business opened by a card this round as no longer the player\'s to run once a manager takes it', async () => {
    // A round on, a card has just handed the founder a shop: it counts as run by them this round, whatever is ordered.
    const { services, session } = await inFinance('founder');
    await session.playRound({ orders: [] });
    await toFinance(session);
    changed(services, session, (view) => ({ ...view, player: { ...view.player, businesses: view.player.businesses.map((one) => ({ ...one, tended: true })) } }));
    await openTab(services);
    const tend = () => within(yours()).getByRole('button', { name: /Run it yourself/ });
    expect(tend().getAttribute('aria-selected')).toBe('true');
    fireEvent.click(within(yours()).getByRole('button', { name: /Manager · / }));
    await settled();
    expect(tend().getAttribute('aria-selected')).toBe('false');
    expect(tend().getAttribute('aria-disabled')).toBe('true');
  });

  it('offers a trade of the player\'s own only to a trade that can be sold on its own', async () => {
    const { services } = await inFinance('civil_servant');
    const quote = quoteBusinesses(content, viewOf(await stateOf(services)));
    expect(quote.kinds.find((kind) => kind.typeId === 'services')?.lock).toBe('not-your-trade');
    await openTab(services);
    expect(within(opening()).queryAllByRole('listitem')).toHaveLength(0);
  });
});

describe('a business\'s line, on the phone', () => {
  it('draws its picture as big as the business has grown, and its two small switches take a thumb\'s 44 without moving what is round them', async () => {
    const { services } = await inFinance('founder');
    const [shop] = quoteBusinesses(content, viewOf(await stateOf(services))).owned;
    await openTab(services);
    const type = content.business.types.find((one) => one.id === shop.typeId);
    if (!type) throw new Error('the shop is a kind of business');
    const row = within(yours()).getByRole('button', { name: /Online shop/ });
    expect(row.querySelector(`[data-sprite="${businessStageArt(shop.typeId, shop.capital, type.scale)}"]`)).not.toBeNull();
    for (const name of [/Run it yourself/, /Manager · /]) {
      const quick = within(yours()).getByRole('button', { name });
      const style = getComputedStyle(quick);
      // 36 high as the web's `min-h-9`, reaching 4 above and 4 below it: 44 in all, and the line round it stays where it is.
      expect(getComputedStyle(quick.firstElementChild as HTMLElement).minHeight).toBe('36px');
      expect(parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + 36).toBeGreaterThanOrEqual(TOUCH);
      expect(parseFloat(style.marginTop)).toBe(-parseFloat(style.paddingTop));
      expect(parseFloat(style.marginBottom)).toBe(-parseFloat(style.paddingBottom));
    }
  });

  it('is drawn again only for what it shows: its switch changes it, and an order of something else draws it not again', async () => {
    const { services } = await inFinance('founder');
    const [shop] = quoteBusinesses(content, viewOf(await stateOf(services))).owned;
    const type = content.business.types.find((one) => one.id === shop.typeId);
    if (!type) throw new Error('the shop is a kind of business');
    await openTab(services);
    const art = businessStageArt(shop.typeId, shop.capital, type.scale);
    const drawn = () => spriteRenders.get(art) ?? 0;
    const before = drawn();
    expect(before).toBeGreaterThan(0);
    // Cash to savings: the business's line shows none of it.
    await settled(() => void probe.state!.addOrder({ type: 'depositIn', amount: 10_000 }));
    expect(probe.state!.orders).toHaveLength(1);
    expect(drawn()).toBe(before);
    // An order the round refuses: nothing changes, nothing is drawn again.
    await settled(() => void probe.state!.addOrder({ type: 'sell', assetId: 'sp500', amount: 999_999_999 }));
    expect(probe.state!.refusal).not.toBeNull();
    expect(drawn()).toBe(before);
    // A manager hired from its line: the line is drawn again, once.
    fireEvent.click(within(yours()).getByRole('button', { name: /Manager · / }));
    await settled();
    expect(drawn()).toBe(before + 1);
  });
});

describe('the businesses in Russian, their structure (what wraps and what is cut; widths are the batch pass\'s)', () => {
  it('wrap a business\'s line and the kinds to open: only the name of an owned one is cut to its line, as the web cuts it', async () => {
    const { services } = await inFinance('founder');
    await openTab(services, 'ru');
    const mine = panel(ru.finance.business.yours);
    const row = within(mine).getAllByRole('button')[0];
    const texts = [...row.querySelectorAll<HTMLElement>('[dir="auto"]')];
    const [name, ...rest] = texts;
    expect(name.textContent).toBe(textFor('ru').text.businessTypes.shop.name);
    // The name is the web's `truncate`; every other line of it wraps.
    expect(/r-textOverflow-/.test(name.className)).toBe(true);
    for (const words of rest) expect(/r-textOverflow-|r-WebkitLineClamp/.test(words.className), words.textContent ?? '').toBe(false);
    // Its words are a share of the line beside the figures (the web's `min-w-0 flex-1`), and the two small switches share their row, each allowed to be narrower than its words.
    expect(getComputedStyle(name.parentElement as HTMLElement).minWidth).toBe('0px');
    for (const quick of within(mine).getAllByRole('button').slice(1)) {
      expect(getComputedStyle(quick).minWidth).toBe('0px');
      for (const words of quick.querySelectorAll<HTMLElement>('[dir="auto"]')) expect(/r-textOverflow-|r-WebkitLineClamp/.test(words.className)).toBe(false);
    }
    const open = panel(ru.finance.business.open);
    for (const item of within(open).getAllByRole('listitem')) {
      for (const words of item.querySelectorAll<HTMLElement>('[dir="auto"]')) expect(/r-textOverflow-|r-WebkitLineClamp/.test(words.className), words.textContent ?? '').toBe(false);
    }
  });
});
