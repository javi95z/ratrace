// @vitest-environment jsdom
import { content, itemArt, textFor } from '@ratrace/content';
import { messagesFor } from '@ratrace/i18n';
import type { RoundActions, RoundState } from '@ratrace/core/game/store';
import { formatFor } from '@ratrace/core/lib/format';
import type { GameSession, SavedGame } from '@ratrace/core/session/types';
import { quoteItem, viewOf } from '@ratrace/engine';
import type { GameView, ItemQuote } from '@ratrace/engine';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { memoryServices, renderGame, spriteRenders } from '../../testing/render';
import { settled } from '../../testing/renders';
import { useGame } from '../context';
import { FinanceOpened } from './Finance';
import { Play } from './Play';

/*
 * The shop of the finances (the web's Finance.test.tsx: the catalogue, a thing owned, what a thing is good for, buying on instalments, the
 * second-hand shop, what is sold without an invoice, and the shelf half of what belongs to a city), on the phone; and what the phone adds:
 * each tile is drawn again only when what it shows changes, an order is given once for a double tap, and in Russian on a narrow phone the
 * tiles wrap their words.
 */

afterEach(cleanup);

const fmt = formatFor('en');
const ru = messagesFor('ru');
const { names, text } = textFor('en');
const button = (name: string | RegExp) => screen.getByRole('button', { name });
/** A sheet by its title: the window that holds it. */
const sheetTitled = (title: string) => screen.getByRole('heading', { name: title }).closest('[aria-modal="true"]') as HTMLElement;
const sheetGone = (title: string) => waitFor(() => expect(screen.queryByRole('heading', { name: title })).toBeNull());

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

/** The round store as it stands, and its actions: an order given without the screen. */
const probe: { state: (RoundState & RoundActions) | null } = { state: null };
function Probe() {
  probe.state = useGame((s) => s);
  return null;
}
function played(services: ReturnType<typeof memoryServices>, ui: ReactNode = <Play />, locale: 'en' | 'ru' = 'en') {
  return renderGame(
    <>
      {ui}
      <Probe />
    </>,
    services,
    locale,
  );
}

/** What the shop sells in the player's city, and what of it is in reach, as the engine quotes it for the round as it stands. */
function shelfOf(view: GameView) {
  const all = content.items.map((item) => ({ item, quote: quoteItem(content, view, item.id), owned: view.player.life.items.some((owned) => owned.itemId === item.id) })).filter((entry) => entry.quote.soldHere);
  const reach = (entry: { quote: ItemQuote; owned: boolean }) =>
    entry.owned || entry.quote.price <= view.player.cash || entry.quote.finance?.lock === null || entry.quote.used?.lock === null || entry.quote.noInvoice?.lock === null;
  return { all, inReach: all.filter(reach) };
}

/** The panel of the tab on screen (the shop's, in whatever language). */
/** Long enough for every shelf to be put on screen, a few a frame, on a machine that is busy. */
const DRAWN = { timeout: 5_000 };
const shopPanel = () => screen.getByRole('tabpanel');
/** The tiles on the shelves: every button of the shop's panel (its two views are radios). */
const tiles = () => within(shopPanel()).queryAllByRole('button');
/**
 * Play, on the Shop tab of the finances, in the view asked for, once every shelf is on screen (they are put on it a few at a time, so that
 * opening the tab is not one long stop of the screen).
 */
async function openShop(services: ReturnType<typeof memoryServices>, view: 'affordable' | 'all' = 'all', locale: 'en' | 'ru' = 'en') {
  played(services, <Play />, locale);
  const words = locale === 'en' ? messagesFor('en') : ru;
  fireEvent.click(await screen.findByRole('tab', { name: words.finance.tabs.shop }));
  if (view === 'all') fireEvent.click(within(shopPanel()).getByRole('radio', { name: words.finance.shop.all }));
  const shelf = shelfOf(viewOf(await stateOf(services)));
  const count = view === 'all' ? shelf.all.length : shelf.inReach.length;
  await waitFor(() => expect(tiles()).toHaveLength(count), DRAWN);
  await settled();
  return shelf;
}

describe('the shop catalogue', () => {
  it('opens on what is in reach, leaving out empty shelves, and shows everything on asking', async () => {
    const { services } = await inFinance('nurse');
    const { all, inReach } = await openShop(services, 'affordable');

    expect(screen.queryByRole('radio', { name: 'Recommended' })).toBeNull();
    expect(within(shopPanel()).getByRole('radio', { name: 'In reach' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('What you own and what you can buy now, including on instalments or second hand.')).toBeTruthy();
    expect(inReach.length).toBeGreaterThan(0);
    expect(inReach.length).toBeLessThan(all.length);
    expect(tiles()).toHaveLength(inReach.length);
    // No shelf stands empty: a shelf is drawn for each kind of thing with something in reach, and for no other.
    const ladders = (entries: typeof all) => [...new Set(entries.map(({ item }) => item.ladder))].map((ladder) => text.ladders[ladder].toUpperCase());
    expect(within(shopPanel()).getAllByRole('heading').map((heading) => heading.textContent)).toEqual(ladders(inReach));
    // Nothing sends the player off to see everything.
    expect(screen.queryByRole('button', { name: /^See all/ })).toBeNull();

    fireEvent.click(within(shopPanel()).getByRole('radio', { name: 'All' }));
    await waitFor(() => expect(tiles()).toHaveLength(all.length), DRAWN);
    expect(screen.getByText('The complete catalogue in your city.')).toBeTruthy();
    expect(within(shopPanel()).getAllByRole('heading').map((heading) => heading.textContent)).toEqual(ladders(all));
  });

  it('keeps the view asked for while the player looks at another tab, and opens the next finances on what is in reach again', async () => {
    const { services } = await inFinance('nurse');
    const { all } = await openShop(services, 'all');
    fireEvent.click(screen.getByRole('tab', { name: 'Portfolio' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Shop' }));
    expect(within(shopPanel()).getByRole('radio', { name: 'All' }).getAttribute('aria-checked')).toBe('true');
    await waitFor(() => expect(tiles()).toHaveLength(all.length), DRAWN);
  });
});

describe('a tile of the shop', () => {
  it('shows the thing, its price and what it does to status; a thing owned is lit gold and says it is yours; a long trip says the focus it gives', async () => {
    const { services, session } = await inFinance('nurse');
    await session.playRound({ orders: [{ type: 'buyItem', itemId: 'watch_casio' }] });
    await toFinance(session);
    const view = viewOf(await stateOf(services));
    await openShop(services);

    const casio = button(/Casio F-91W/);
    expect(within(casio).getByText('Yours')).toBeTruthy();
    expect(casio.querySelector(`[data-sprite="${itemArt('watch_casio')}"]`)).not.toBeNull();
    const ibiza = quoteItem(content, view, 'car_seat_ibiza');
    const seat = button(/SEAT Ibiza/);
    expect(within(seat).getByText(fmt.compact(ibiza.price))).toBeTruthy();
    expect(within(seat).getByText(`Status +${ibiza.statusReal}`)).toBeTruthy();
    expect(seat.querySelector('[data-sprite="car.seat_ibiza"]')).not.toBeNull();
    // A safari is a rest as well: the focus it gives beside its status.
    const safari = content.items.find((item) => item.id === 'travel_safari');
    expect(safari?.perks?.focus).toBeGreaterThan(0);
    expect(within(button(new RegExp(names.items.travel_safari))).getByText(`Focus +${safari?.perks?.focus}`)).toBeTruthy();
    expect(within(seat).queryByText(/^Focus/)).toBeNull();
  });

  it('lays the picture above the words in a narrow column, and beside them from 400 wide (the web\'s container query), two to a row either way', async () => {
    const { services } = await inFinance('nurse');
    await openShop(services);
    const seat = button(/SEAT Ibiza/);
    // The tile's frame lays out what it holds: a column, centred, under 400 (a phone's panel is narrower than that).
    const frameOf = (tile: HTMLElement) => tile.firstElementChild as HTMLElement;
    expect(getComputedStyle(frameOf(seat)).flexDirection).toBe('column');
    // Two to a row: each tile half its shelf.
    const cell = seat.parentElement as HTMLElement;
    expect(getComputedStyle(cell).width).toBe('50%');
    // Its shelf laid out 400 wide (the box that measures it, as the web's `@container` is measured): a row, the picture beside the words.
    type Measured = HTMLElement & { __reactLayoutHandler?: (event: unknown) => void };
    let shelf = cell.parentElement as Measured | null;
    while (shelf && shelf.__reactLayoutHandler === undefined) shelf = shelf.parentElement as Measured | null;
    const layOut = (width: number) => act(() => shelf?.__reactLayoutHandler?.({ nativeEvent: { layout: { x: 0, y: 0, width, height: 300 } } }));
    expect(shelf).not.toBeNull();
    layOut(400);
    expect(getComputedStyle(frameOf(button(/SEAT Ibiza/))).flexDirection).toBe('row');
    layOut(399);
    expect(getComputedStyle(frameOf(button(/SEAT Ibiza/))).flexDirection).toBe('column');
  });
});

describe('a thing the player owns, in the shop', () => {
  it('shows what it cost beside the price to sell it at, and nothing of the kind for a thing not owned', async () => {
    const { services, session } = await inFinance('nurse');
    await session.playRound({ orders: [{ type: 'buyItem', itemId: 'watch_casio' }] });
    await toFinance(session);
    const [casio] = (await stateOf(services)).player.life.items;
    expect(casio.paid).toBe(content.items.find((item) => item.id === 'watch_casio')?.price);
    await openShop(services);

    fireEvent.click(button(/Casio F-91W/));
    const mine = sheetTitled('Casio F-91W');
    expect(within(mine).getByRole('button', { name: `Sell for ${fmt.money(casio.value)}` })).toBeTruthy();
    expect(within(mine).getByText(`It cost you ${fmt.money(casio.paid)}`)).toBeTruthy();
    expect(within(mine).getByText(`Sell it today and you lose ${fmt.money(casio.paid - casio.value)}`)).toBeTruthy();
    fireEvent.click(within(mine).getByRole('button', { name: 'Close' }));
    await sheetGone('Casio F-91W');

    fireEvent.click(button(/Soho House/));
    const notMine = sheetTitled('Soho House');
    expect(within(notMine).queryByText(/It cost you/)).toBeNull();
    expect(within(notMine).queryByText(/Sell it today/)).toBeNull();
  });

  it('is sold from its sheet, which closes, once for a double tap', async () => {
    const { services, session } = await inFinance('nurse');
    await session.playRound({ orders: [{ type: 'buyItem', itemId: 'watch_casio' }] });
    await toFinance(session);
    const [casio] = (await stateOf(services)).player.life.items;
    await openShop(services);
    fireEvent.click(button(/Casio F-91W/));
    const sell = within(sheetTitled('Casio F-91W')).getByRole('button', { name: `Sell for ${fmt.money(casio.value)}` });
    act(() => {
      fireEvent.click(sell);
      fireEvent.click(sell);
    });
    await sheetGone('Casio F-91W');
    expect(probe.state!.orders).toEqual([{ type: 'sellItem', itemId: 'watch_casio' }]);
    expect(probe.state!.refusal).toBeNull();
  });
});

describe('a thing in the basket, in the shop', () => {
  it('is taken out of the basket with its sheet\'s Cancel', async () => {
    const { services } = await inFinance('nurse');
    await openShop(services);
    fireEvent.click(button(/Casio F-91W/));
    fireEvent.click(within(sheetTitled('Casio F-91W')).getByRole('button', { name: /^Buy for / }));
    await sheetGone('Casio F-91W');
    expect(probe.state!.orders).toEqual([{ type: 'buyItem', itemId: 'watch_casio' }]);
    // Opened again, the thing ordered is taken out of the basket from here.
    fireEvent.click(button(/Casio F-91W/));
    fireEvent.click(within(sheetTitled('Casio F-91W')).getByRole('button', { name: 'Cancel' }));
    await sheetGone('Casio F-91W');
    expect(probe.state!.orders).toEqual([]);
  });
});

describe('what a thing is good for', () => {
  it('is said on its sheet in the shop, and nothing is said of a thing that is status and nothing else', async () => {
    const { services } = await inFinance('nurse');
    await openShop(services);

    const uses = async (name: RegExp, title: string) => {
      fireEvent.click(button(name));
      const sheet = sheetTitled(title);
      const region = within(sheet).queryByRole('region', { name: 'Good for' });
      const lines = region ? within(region).getAllByRole('listitem').map((li) => li.textContent) : null;
      fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
      await sheetGone(title);
      return lines;
    };
    expect(await uses(/SEAT Ibiza/, 'SEAT Ibiza')).toEqual(['Moving city costs 30% less']);
    expect(await uses(/Rolex Submariner/, 'Rolex Submariner')).toEqual(['+6 points of chance on a job hunt']);
    expect(await uses(new RegExp(names.items.tech_laptop), names.items.tech_laptop)).toEqual(['+1 career skill when you study']);
    expect(await uses(/Soho House/, 'Soho House')).toEqual(['+6 points of chance on a job hunt']);
    expect(await uses(new RegExp(names.items.travel_safari), names.items.travel_safari)).toEqual(['+1 focus in the round after']);
    expect(await uses(new RegExp(names.items.travel_weekend), names.items.travel_weekend)).toBeNull();
    expect(await uses(new RegExp(names.items.art_photo), names.items.art_photo)).toBeNull();
  });

  it('shows in the focus of the round: a laptop owned makes study worth more', async () => {
    const { services, session } = await inFinance('nurse');
    await session.playRound({ orders: [{ type: 'buyItem', itemId: 'tech_laptop' }] });
    await toFinance(session);
    played(services);
    fireEvent.click(await screen.findByRole('tab', { name: 'Lifestyle' }));
    expect(screen.getByRole('switch', { name: /^Clinical training/ }).textContent).toContain(`+${content.life.studySkill + 1} career skill`);
  });
});

describe('buying', () => {
  it('buys a thing from its sheet, which closes; the order waits in the basket under the thing\'s name, and is given once for a double tap', async () => {
    const { services } = await inFinance('nurse');
    const view = viewOf(await stateOf(services));
    const casio = quoteItem(content, view, 'watch_casio');
    await openShop(services);
    fireEvent.click(button(/Casio F-91W/));
    const buy = within(sheetTitled('Casio F-91W')).getByRole('button', { name: `Buy for ${fmt.money(casio.price)}` });
    // Two taps before the screen is drawn again: one order, and nothing refused.
    act(() => {
      fireEvent.click(buy);
      fireEvent.click(buy);
    });
    await sheetGone('Casio F-91W');
    expect(probe.state!.orders).toEqual([{ type: 'buyItem', itemId: 'watch_casio' }]);
    expect(probe.state!.refusal).toBeNull();
    // Bought, the tile says it is the player's.
    expect(within(button(/Casio F-91W/)).getByText('Yours')).toBeTruthy();
    fireEvent.click(button('1 order'));
    expect(within(sheetTitled("This round's orders")).getByRole('button', { name: 'Remove: Buy Casio F-91W' })).toBeTruthy();
  });

  it('keeps the sheet open and says why when the round refuses the purchase', async () => {
    const { services } = await inFinance('nurse');
    await openShop(services);
    fireEvent.click(button(/Porsche 911/));
    const sheet = sheetTitled('Porsche 911');
    fireEvent.click(within(sheet).getByRole('button', { name: /^Buy for / }));
    await settled();
    expect(probe.state!.orders).toEqual([]);
    expect(probe.state!.refusal).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Porsche 911' })).toBeTruthy();
  });
});

describe('buying on instalments', () => {
  it('offers a thing that lasts for a share down and a loan, says what the loan costs, and buys it that way', async () => {
    // The civil servant starts with the fifth of a small car in hand, and pay enough for the loan.
    const { services } = await inFinance('civil_servant');
    const before = await stateOf(services);
    const plan = quoteItem(content, viewOf(before), 'car_seat_ibiza').finance;
    if (plan === null || plan.lock !== null) throw new Error('a civil servant can buy a small car on instalments');
    await openShop(services);

    fireEvent.click(button(/SEAT Ibiza/));
    const sheet = sheetTitled('SEAT Ibiza');
    const years = plan.termRounds * content.yearsPerRound;
    expect(within(sheet).getByText(`The rest, ${fmt.money(plan.loan)}, is a loan at ${fmt.rate(plan.rateBp)} over ${years} years: about ${fmt.money(plan.annual)} a year at first. Sell it and the debt stays with you.`)).toBeTruthy();
    const instalments = within(sheet).getByRole('button', { name: `On instalments · ${fmt.money(plan.down)} down` });
    // A double tap: one order.
    act(() => {
      fireEvent.click(instalments);
      fireEvent.click(instalments);
    });
    await sheetGone('SEAT Ibiza');
    expect(probe.state!.orders).toEqual([{ type: 'buyItem', itemId: 'car_seat_ibiza', financed: true }]);
    expect(probe.state!.refusal).toBeNull();

    // It waits in the basket under its own name, and the round then takes the down payment and opens the loan.
    fireEvent.click(button('1 order'));
    const basket = sheetTitled("This round's orders");
    expect(within(basket).getByRole('button', { name: 'Remove: Buy SEAT Ibiza on instalments' })).toBeTruthy();
    fireEvent.click(within(basket).getByRole('button', { name: 'Close' }));
    await sheetGone("This round's orders");
    fireEvent.click(button('Play the round'));
    await waitFor(async () => expect((await stateOf(services)).round).toBe(before.round + 1));
    const after = await stateOf(services);
    expect(after.player.life.items.map((owned) => owned.itemId)).toContain('car_seat_ibiza');
    expect(after.player.debts.filter((debt) => debt.kind === 'personalLoan')).toHaveLength(before.player.debts.filter((debt) => debt.kind === 'personalLoan').length + 1);
  });

  it('names the debt after the thing it bought, and shows it on the thing until it is paid, sold or not', async () => {
    const { services, session } = await inFinance('civil_servant');
    await session.playRound({ orders: [{ type: 'buyItem', itemId: 'car_seat_ibiza', financed: true }] });
    await toFinance(session);
    const state = await stateOf(services);
    const quote = quoteItem(content, viewOf(state), 'car_seat_ibiza');
    expect(quote.owed).toBeGreaterThan(0);
    played(services);

    fireEvent.click(await screen.findByRole('tab', { name: 'Debt' }));
    expect(within(screen.getByRole('tabpanel', { name: 'Debt' })).getByText('Personal loan · SEAT Ibiza')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Shop' }));
    fireEvent.click(await screen.findByRole('button', { name: /SEAT Ibiza/ }));
    const note = within(sheetTitled('SEAT Ibiza')).getByRole('note');
    expect(within(note).getByText('Still owed on the loan')).toBeTruthy();
    expect(within(note).getByText(fmt.money(quote.owed))).toBeTruthy();
    // A car loses value faster than the loan is paid: the sale is said to fall short, and by how much.
    const short = quote.owed - quote.resale;
    expect(within(note).getByText(short > 0 ? `You bought it on instalments. Selling it today would not clear the debt: you would be ${fmt.money(short)} short.` : 'You bought it on instalments. Sell it and the debt stays with you.')).toBeTruthy();
    cleanup();

    // Sold: the thing is gone from the life, and the debt is still on its sheet in the shop.
    await session.playRound({ orders: [{ type: 'sellItem', itemId: 'car_seat_ibiza' }] });
    await toFinance(session);
    await openShop(services);
    fireEvent.click(button(/SEAT Ibiza/));
    const gone = within(sheetTitled('SEAT Ibiza')).getByRole('note');
    expect(within(gone).getByText('You bought it on instalments and no longer have it. The debt stays.')).toBeTruthy();
  });

  it('is not offered for what is used up or costs little, and says why when the bank will not lend', async () => {
    // A nurse's pay does not stretch to the loan a sports car needs.
    const { services } = await inFinance('nurse');
    const view = viewOf(await stateOf(services));
    const porsche = quoteItem(content, view, 'car_porsche_911').finance;
    if (porsche === null || porsche.lock === null) throw new Error('a nurse cannot have a Porsche on instalments');
    await openShop(services);

    fireEvent.click(button(/Casio F-91W/));
    const casio = sheetTitled('Casio F-91W');
    expect(within(casio).queryByRole('button', { name: /^On instalments/ })).toBeNull();
    fireEvent.click(within(casio).getByRole('button', { name: 'Close' }));
    await sheetGone('Casio F-91W');

    fireEvent.click(button(/Porsche 911/));
    const sheet = sheetTitled('Porsche 911');
    expect(within(sheet).getByRole('button', { name: /^On instalments/ }).getAttribute('aria-disabled')).toBe('true');
    expect(within(sheet).getByText(text.reasons[porsche.lock])).toBeTruthy();
  });
});

describe('the second-hand shop', () => {
  it('keeps the used price off the shelf, then shows its age, status and repairs in the sheet and buys it for cash, once for a double tap', async () => {
    // The heir has the cash for a used car.
    const { services } = await inFinance('heir');
    const quote = quoteItem(content, viewOf(await stateOf(services)), 'car_seat_ibiza');
    const used = quote.used;
    if (!used) throw new Error('a car is sold second hand');
    await openShop(services);
    // The shelf stays easy to scan: the used offer belongs inside the item's sheet.
    expect(within(button(/SEAT Ibiza/)).queryByText(`Used: ${fmt.compact(used.price)}`)).toBeNull();

    fireEvent.click(button(/SEAT Ibiza/));
    const second = within(sheetTitled('SEAT Ibiza')).getByRole('region', { name: 'Second hand' });
    expect(within(second).getByText(`Status +${used.status}`)).toBeTruthy();
    expect(used.status).toBeLessThan(quote.statusNew);
    expect(within(second).getByText(`${used.ageRounds * content.yearsPerRound} years old`)).toBeTruthy();
    expect(within(second).getByText(`Each round, a ${used.repairChancePct}% chance of a repair of about ${fmt.money(used.repairCost)}. The warranty covers the first round.`)).toBeTruthy();
    expect(within(second).getByText(`Would resell for about ${fmt.money(used.resale)} tomorrow`)).toBeTruthy();
    const buy = within(second).getByRole('button', { name: `Buy used for ${fmt.money(used.price)}` });
    act(() => {
      fireEvent.click(buy);
      fireEvent.click(buy);
    });
    // The order is given once, the sheet is put away, and the round's list says what was ordered.
    await sheetGone('SEAT Ibiza');
    expect(probe.state!.orders).toEqual([{ type: 'buyItem', itemId: 'car_seat_ibiza', used: true }]);
    expect(probe.state!.refusal).toBeNull();
    fireEvent.click(button('1 order'));
    expect(within(sheetTitled("This round's orders")).getByRole('button', { name: 'Remove: Buy SEAT Ibiza second hand' })).toBeTruthy();
  });

  it('says why a used one cannot be had, and offers none of what is only sold new', async () => {
    // The nurse has three thousand dollars: not enough for a used car.
    const { services } = await inFinance('nurse');
    await openShop(services);
    fireEvent.click(button(/SEAT Ibiza/));
    const second = within(sheetTitled('SEAT Ibiza')).getByRole('region', { name: 'Second hand' });
    expect(within(second).getByRole('button', { name: /^Buy used for/ }).getAttribute('aria-disabled')).toBe('true');
    expect(within(second).getByText('You do not have enough cash.')).toBeTruthy();
    fireEvent.click(within(sheetTitled('SEAT Ibiza')).getByRole('button', { name: 'Close' }));
    await sheetGone('SEAT Ibiza');
    // A phone is only sold new.
    expect(within(button(/iPhone/)).queryByText(/^Used:/)).toBeNull();
    fireEvent.click(button(/iPhone/));
    expect(within(sheetTitled('iPhone')).queryByRole('region', { name: 'Second hand' })).toBeNull();
  });

  it('marks what was bought second hand on the shelf', async () => {
    const { services, session } = await inFinance('heir');
    await session.playRound({ orders: [{ type: 'buyItem', itemId: 'watch_omega', used: true }] });
    await toFinance(session);
    await openShop(services);
    expect(within(within(shopPanel()).getByRole('button', { name: /Omega Speedmaster/ })).getByText('Yours · used')).toBeTruthy();
    // (Among what the player owns, beside the game, is the web's wide screen; on the phone it is the profile's, Task 17.)
  });
});

describe('what is sold without an invoice', () => {
  it('sells a watch without an invoice, once for a double tap', async () => {
    const { services } = await inFinance('nurse');
    const quote = quoteItem(content, viewOf(await stateOf(services)), 'watch_casio');
    const offer = quote.noInvoice;
    if (!offer) throw new Error('a watch is sold without an invoice');
    await openShop(services);
    fireEvent.click(within(shopPanel()).getByRole('button', { name: /Casio F-91W/ }));
    const part = within(sheetTitled('Casio F-91W')).getByRole('region', { name: 'Without an invoice' });
    expect(within(part).getByText(new RegExp(`^${offer.discountPct}% cheaper, in cash\\.`))).toBeTruthy();
    const buy = within(part).getByRole('button', { name: `Buy without an invoice for ${fmt.money(offer.price)}` });
    act(() => {
      fireEvent.click(buy);
      fireEvent.click(buy);
    });
    await sheetGone('Casio F-91W');
    expect(probe.state!.orders).toEqual([{ type: 'buyItem', itemId: 'watch_casio', noInvoice: true }]);
    fireEvent.click(button('1 order'));
    expect(within(sheetTitled("This round's orders")).getByRole('button', { name: 'Remove: Buy Casio F-91W without an invoice' })).toBeTruthy();
    fireEvent.click(within(sheetTitled("This round's orders")).getByRole('button', { name: 'Close' }));
    await sheetGone("This round's orders");
    // A car is not sold so.
    fireEvent.click(within(shopPanel()).getByRole('button', { name: /SEAT Ibiza/ }));
    expect(within(sheetTitled('SEAT Ibiza')).queryByRole('region', { name: 'Without an invoice' })).toBeNull();
  });

  it('does not sell a watch without an invoice where no tax is paid', async () => {
    const { services } = await inFinance('heir');
    const state = await stateOf(services);
    expect(content.cities.find((city) => city.id === state.player.cityId)?.tax.incomeRatesBp).toEqual([0, 0, 0]);
    expect(quoteItem(content, viewOf(state), 'watch_omega').noInvoice).toBeNull();
    await openShop(services);
    fireEvent.click(within(shopPanel()).getByRole('button', { name: /Omega Speedmaster/ }));
    expect(within(sheetTitled('Omega Speedmaster')).queryByRole('region', { name: 'Without an invoice' })).toBeNull();
  });
});

describe('what belongs to a city', () => {
  it('is on the shelf only in that city, and says it will not come along', async () => {
    // The nurse lives in Madrid.
    const { services } = await inFinance('nurse');
    await openShop(services);
    expect(button(/Bernabéu season seat/)).toBeTruthy();
    for (const elsewhere of [/Arsenal season ticket/, /Knicks season seats/, /Jumeirah beach club/, /Paddock Club/, /Rajadamnern/]) expect(screen.queryByRole('button', { name: elsewhere })).toBeNull();
    // What is sold everywhere is still there.
    expect(button(/Soho House/)).toBeTruthy();

    fireEvent.click(button(/Bernabéu season seat/));
    expect(within(sheetTitled('Bernabéu season seat')).getByText('Only in Madrid. Move away and it is gone.')).toBeTruthy();
  });
});

describe('a thing\'s sheet, open from the start', () => {
  it('is open where a scene says so (the phone\'s initial state, as the pension\'s): the shop on its tab, and the thing\'s own sheet, not a tap', async () => {
    const { services } = await inFinance('nurse');
    played(
      services,
      <FinanceOpened value={{ tab: 'shop', sheet: 'item-watch_casio' }}>
        <Play />
      </FinanceOpened>,
    );
    expect(await screen.findByRole('heading', { name: 'Casio F-91W' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Shop' }).getAttribute('aria-selected')).toBe('true');
    expect(within(sheetTitled('Casio F-91W')).getByRole('button', { name: /^Buy for / })).toBeTruthy();
  });
});

describe('the shop, drawn again', () => {
  /** How many times each thing's picture has been drawn so far: a tile is drawn again when its picture is. */
  const pictures = (ids: readonly string[]) => new Map(ids.map((id) => [id, spriteRenders.get(itemArt(id)) ?? 0]));

  it('draws only the tiles that come on the shelf when everything is asked for, and for an order of one thing draws no other tile', async () => {
    const { services } = await inFinance('nurse');
    const { all, inReach } = await openShop(services, 'affordable');
    const ids = all.map(({ item }) => item.id);
    const before = pictures(ids);
    for (const { item } of inReach) expect(before.get(item.id), item.id).toBeGreaterThan(0);

    // Everything: what was on the shelf is not drawn again, and what comes on it is drawn once.
    fireEvent.click(within(shopPanel()).getByRole('radio', { name: 'All' }));
    await waitFor(() => expect(tiles()).toHaveLength(all.length), DRAWN);
    await settled();
    const shown = new Set(inReach.map(({ item }) => item.id));
    const switched = pictures(ids);
    for (const id of ids) expect(switched.get(id), id).toBe(shown.has(id) ? before.get(id) : 1);

    // Back to what is in reach: nothing is drawn again, what is out of reach leaves the shelf.
    fireEvent.click(within(shopPanel()).getByRole('radio', { name: 'In reach' }));
    await waitFor(() => expect(tiles()).toHaveLength(inReach.length), DRAWN);
    await settled();
    expect(pictures(ids)).toEqual(switched);

    // A dog bought (the only thing of its kind, so nothing else's figures change): its tile is drawn again, says it is the player's, and no other is drawn.
    fireEvent.click(within(shopPanel()).getByRole('radio', { name: 'All' }));
    await waitFor(() => expect(tiles()).toHaveLength(all.length), DRAWN);
    await settled();
    const once = pictures(ids);
    await settled(() => void probe.state!.addOrder({ type: 'buyItem', itemId: 'pet_dog' }));
    expect(probe.state!.orders).toEqual([{ type: 'buyItem', itemId: 'pet_dog' }]);
    expect(within(button(new RegExp(names.items.pet_dog))).getByText('Yours')).toBeTruthy();
    const after = pictures(ids);
    for (const id of ids) expect(after.get(id), id).toBe(id === 'pet_dog' ? (once.get(id) ?? 0) + 1 : once.get(id));

    // Cash put in savings: no tile shows the cash in the complete catalogue, so none is drawn again.
    await settled(() => void probe.state!.addOrder({ type: 'depositIn', amount: 10_000 }));
    expect(probe.state!.orders).toHaveLength(2);
    expect(pictures(ids)).toEqual(after);
  });
});

describe('the shop in Russian, on a narrow phone', () => {
  /** How a text is cut: to one line (`truncate`), to a few (`line-clamp`), or not at all. */
  function cutOf(text: HTMLElement): 'line' | 'lines' | null {
    if (!/r-textOverflow-|r-WebkitLineClamp/.test(text.className)) return null;
    return getComputedStyle(text).whiteSpace === 'nowrap' ? 'line' : 'lines';
  }

  it('wraps every tile\'s words: each tile half its shelf, its figures wrapping under its name, nothing cut but the name, at two lines as the web clamps it', async () => {
    const { services } = await inFinance('engineer');
    await openShop(services, 'all', 'ru');
    const all = tiles();
    expect(all.length).toBeGreaterThan(40);
    for (const tile of all) {
      // A share of its shelf, as the web's grid cell is: half of it, and allowed to be narrower than its words.
      expect(getComputedStyle(tile.parentElement as HTMLElement).width, tile.textContent ?? '').toBe('50%');
      expect(getComputedStyle(tile).minWidth, tile.textContent ?? '').toBe('0px');
      // Each text whole (its runs by font are inside it): the name first, clamped to two lines (the web's `line-clamp-2`); nothing else is ever cut.
      const [name, ...rest] = [...tile.querySelectorAll<HTMLElement>('[dir="auto"]')];
      expect(cutOf(name), name.textContent ?? '').toBe('lines');
      for (const words of rest) expect(cutOf(words), words.textContent ?? '').toBeNull();
    }
    // The line of figures under the name wraps (the web's `flex-wrap`): the price and the tags go under each other where the tile is narrow.
    const seat = within(shopPanel()).getByRole('button', { name: /SEAT Ibiza/ });
    const said = formatFor('ru').compact(quoteItem(content, viewOf(await stateOf(services)), 'car_seat_ibiza').price);
    // (A text whole: its figures and its sign are runs of their own.)
    const price = [...seat.querySelectorAll<HTMLElement>('[dir="auto"]')].find((words) => words.textContent === said) as HTMLElement;
    expect(price).toBeTruthy();
    expect(getComputedStyle(price.parentElement as HTMLElement).flexWrap).toBe('wrap');
    expect(getComputedStyle(price.parentElement as HTMLElement).flexDirection).toBe('row');
  });
});
