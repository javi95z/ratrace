// @vitest-environment jsdom
import { content } from '@ratrace/content';
import { previewRound, quoteProperty, viewOf } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
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

describe('property that is only for letting', () => {
  it('shows homes and what is only for letting apart, every one on the same dark tile, and says of a parking space what it lets for', async () => {
    const { services, session } = await inFinance('heir');
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Property' }));
    const kinds = (region: HTMLElement) => within(region).getAllByRole('button').map((tile) => tile.querySelector('img')?.getAttribute('src')?.replace(/^.*home\./, '').replace('.png', ''));
    const homes = screen.getByRole('region', { name: 'Homes in Madrid' });
    const lets = screen.getByRole('region', { name: 'To let in Madrid' });
    // Each list in the order the game keeps them: the cheapest first.
    expect(kinds(homes)).toEqual(content.propertyTypes.filter((type) => !type.rentalOnly).map((type) => type.id));
    expect(kinds(lets)).toEqual(content.propertyTypes.filter((type) => type.rentalOnly).map((type) => type.id));
    expect(kinds(homes)).toHaveLength(11);
    expect(kinds(lets)).toHaveLength(5);
    // No tile is a cream card: property sits on the same navy as everything else that can be bought.
    for (const tile of [...within(homes).getAllByRole('button'), ...within(lets).getAllByRole('button')]) expect(tile.className).not.toMatch(/bg-cream/);

    const parking = quoteProperty(content, session.view(), 'parking');
    const tile = within(lets).getByRole('button', { name: /^Parking space/ });
    expect(within(tile).getByText(`Lets for ${fmt.compact(parking.rentAnnual)} a year`)).toBeTruthy();
    expect(within(tile).queryByText(/^Status/)).toBeNull();
    // A home says what living in it is worth.
    expect(within(within(homes).getByRole('button', { name: /^Flat/ })).getByText('Status +14')).toBeTruthy();
  });

  it('does not ask what a parking space is for, and says why someone without the skill cannot buy one', async () => {
    const { services } = await inFinance('heir');
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Property' }));
    await user.click(screen.getByRole('button', { name: /^Parking space/ }));
    const sheet = screen.getByRole('dialog', { name: 'Buy to let: Parking space' });
    expect(within(sheet).queryByRole('radiogroup', { name: 'What for' })).toBeNull();
    expect(within(sheet).getByText('Renting out needs finance skill 2')).toBeTruthy();
    expect((within(sheet).getByRole('button', { name: 'Buy' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('buys a parking space to let, for someone who has the skill', async () => {
    const { services, session } = await inFinance('heir');
    // The same life, having learnt what a landlord must know.
    const skilled = (): GameView => ({ ...session.view(), player: { ...session.view().player, life: { ...session.view().player.life, financeSkill: 2 } } });
    const landlord: GameSession = { gameId: session.gameId, lifeId: session.lifeId, view: skilled, history: () => session.history(), bankruptcies: () => 0, story: () => [], badges: () => [], answerCard: (option) => session.answerCard(option), playRound: (choices) => session.playRound(choices) };
    services.sessions.resume = async () => ({ lost: null, session: landlord });
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Property' }));
    await user.click(screen.getByRole('button', { name: /^Parking space/ }));
    const sheet = screen.getByRole('dialog', { name: 'Buy to let: Parking space' });
    await user.click(within(sheet).getByRole('radio', { name: /^Pay in full/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Buy' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    // It is in the basket as a let, and in the list as rented out with nothing to switch off.
    const owned = screen.getByRole('region', { name: 'Your properties' });
    expect(within(owned).getByText('Parking space')).toBeTruthy();
    expect(within(owned).getByText(/Rented out/)).toBeTruthy();
    expect(within(owned).queryByRole('button', { name: 'Stop renting it out' })).toBeNull();
  });
});

describe('a parking space already owned', () => {
  it('offers to sell it and nothing else: there is no renting to stop', async () => {
    const { services, session } = await inFinance('heir');
    // The same life, with a parking space bought in an earlier round, and beside it a flat that is let.
    const owning = (): GameView => {
      const view = session.view();
      const let_ = (id: string, typeId: string) => ({ id, cityId: view.player.cityId, typeId, value: 4_000_000, basis: 4_000_000, rented: true, mortgageId: null });
      return { ...view, player: { ...view.player, properties: [...view.player.properties, let_('property-8', 'parking'), let_('property-9', 'flat')] } };
    };
    const landlord: GameSession = { gameId: session.gameId, lifeId: session.lifeId, view: owning, history: () => session.history(), bankruptcies: () => 0, story: () => [], badges: () => [], answerCard: (option) => session.answerCard(option), playRound: (choices) => session.playRound(choices) };
    services.sessions.resume = async () => ({ lost: null, session: landlord });
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Property' }));
    const owned = screen.getByRole('region', { name: 'Your properties' });
    // The flat can be taken off the market; the parking space cannot.
    expect(within(owned).getAllByRole('button', { name: 'Stop renting it out' })).toHaveLength(1);
    expect(within(owned).getAllByRole('button', { name: /^Sell for/ }).length).toBeGreaterThanOrEqual(2);
  });
});

describe('the lifestyle tab', () => {
  it('draws a picture on every choice: how to work, how to live, where, and each insurance', async () => {
    const { services } = await inFinance('nurse');
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Lifestyle' }));
    const pictured = (control: HTMLElement) => control.querySelector('img') !== null;
    for (const group of ['How you live', 'Where you live']) {
      for (const choice of within(screen.getByRole('radiogroup', { name: group })).getAllByRole('radio')) expect(pictured(choice), `${group}: ${choice.textContent}`).toBe(true);
    }
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(3 + 4);
    for (const one of switches) expect(pictured(one), one.textContent ?? '').toBe(true);
  });
});

describe('what belongs to a city', () => {
  it('is on the shelf only in that city, and says it will not come along', async () => {
    // The nurse lives in Madrid.
    const { services } = await inFinance('nurse');
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Shop' }));
    expect(button(/Bernabéu season seat/)).toBeTruthy();
    for (const elsewhere of [/Arsenal season ticket/, /Knicks season seats/, /Jumeirah beach club/, /Paddock Club/, /Rajadamnern/]) expect(screen.queryByRole('button', { name: elsewhere })).toBeNull();
    // What is sold everywhere is still there.
    expect(button(/Soho House/)).toBeTruthy();

    await user.click(button(/Bernabéu season seat/));
    expect(within(screen.getByRole('dialog', { name: 'Bernabéu season seat' })).getByText('Only in Madrid. Move away and it is gone.')).toBeTruthy();
  });

  it('is named before a move that would end it, and only for the cities that would', async () => {
    const { services, session } = await inFinance('nurse');
    await session.playRound({ orders: [{ type: 'buyItem', itemId: 'member_season_seat' }] });
    await toFinance(session);
    expect((await stateOf(services)).player.life.items.map((owned) => owned.itemId)).toEqual(['member_season_seat']);
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Lifestyle' }));
    await user.click(button('Move to another city'));
    const sheet = screen.getByRole('dialog', { name: 'Move to another city' });
    // One warning for each of the five cities that are not Madrid.
    expect(within(sheet).getAllByText('Moving ends: Bernabéu season seat.')).toHaveLength(content.cities.length - 1);
  });
});

describe('a thing the player owns, in the shop', () => {
  it('shows what it cost beside the price to sell it at, and nothing of the kind for a thing not owned', async () => {
    const { services, session } = await inFinance('nurse');
    await session.playRound({ orders: [{ type: 'buyItem', itemId: 'watch_casio' }] });
    await toFinance(session);
    const [casio] = (await stateOf(services)).player.life.items;
    expect(casio.paid).toBe(content.items.find((item) => item.id === 'watch_casio')?.price);
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Shop' }));

    await user.click(button(/Casio F-91W/));
    const mine = screen.getByRole('dialog', { name: 'Casio F-91W' });
    expect(within(mine).getByRole('button', { name: `Sell for ${fmt.money(casio.value)}` })).toBeTruthy();
    expect(within(mine).getByText(`It cost you ${fmt.money(casio.paid)}`)).toBeTruthy();
    expect(within(mine).getByText(`Sell it today and you lose ${fmt.money(casio.paid - casio.value)}`)).toBeTruthy();
    await user.click(within(mine).getByRole('button', { name: 'Close' }));

    await user.click(button(/Soho House/));
    const notMine = screen.getByRole('dialog', { name: 'Soho House' });
    expect(within(notMine).queryByText(/It cost you/)).toBeNull();
    expect(within(notMine).queryByText(/Sell it today/)).toBeNull();
  });
});

describe('a property the player owns', () => {
  it('opens on a tap: what it is worth, what it would bring, what is owed and what a sale would leave', async () => {
    // The heir starts with a flat in Madrid, lived in and owned outright.
    const { services } = await inFinance('heir');
    const flat = (await stateOf(services)).player.properties[0];
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Property' }));
    const mine = screen.getByRole('region', { name: 'Your properties' });
    await user.click(within(mine).getByRole('button', { name: /^Flat/ }));

    const sheet = screen.getByRole('dialog', { name: 'Flat' });
    expect(within(sheet).getByText('You live here')).toBeTruthy();
    expect(within(sheet).getByText('Worth today')).toBeTruthy();
    expect(within(sheet).getAllByText(fmt.money(flat.value)).length).toBeGreaterThanOrEqual(2);
    expect(within(sheet).getByText('Let, it would bring a year')).toBeTruthy();
    expect(within(sheet).getByText('It is all yours: nothing is owed on it.')).toBeTruthy();
    expect(within(sheet).getByText('A sale would leave you')).toBeTruthy();

    // Looking changes nothing: no order was made.
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button('No orders')).toBeTruthy();
  });
});

describe("this round's orders", () => {
  it('list a move the player orders, which can be taken back', async () => {
    const { services } = await inFinance('heir');
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Lifestyle' }));
    await user.click(button('Move to another city'));
    const cities = screen.getByRole('dialog', { name: 'Move to another city' });
    await user.click(within(cities).getAllByRole('button', { name: 'Move here' })[0]);

    await user.click(button('1 order'));
    const orders = screen.getByRole('dialog', { name: "This round's orders" });
    expect(within(orders).getAllByRole('listitem')).toHaveLength(1);
    expect(within(orders).getByText(/^Move to /)).toBeTruthy();
    await user.click(within(orders).getByRole('button', { name: /^Remove: Move to / }));
    expect(within(orders).getByText(/^Nothing yet/)).toBeTruthy();
  });

  it('list a move a card already decided, at the top and with no way to take it back', async () => {
    const { services, session } = await inFinance('nurse');
    // The same life, having said yes on a card to a job in London.
    const moving = (): GameView => ({ ...session.view(), player: { ...session.view().player, life: { ...session.view().player.life, movingTo: 'london' } } });
    const leaving: GameSession = { gameId: session.gameId, lifeId: session.lifeId, view: moving, history: () => session.history(), bankruptcies: () => 0, story: () => [], badges: () => [], answerCard: (option) => session.answerCard(option), playRound: (choices) => session.playRound(choices) };
    services.sessions.resume = async () => ({ lost: null, session: leaving });
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await screen.findByRole('tab', { name: 'Lifestyle' });

    // The basket still counts only what the player ordered: the move is not theirs to remove.
    await user.click(button('No orders'));
    const orders = screen.getByRole('dialog', { name: "This round's orders" });
    const [move] = within(orders).getAllByRole('listitem');
    expect(within(move).getByText('Move to London')).toBeTruthy();
    expect(within(move).getByText('Already decided')).toBeTruthy();
    expect(within(move).queryByRole('button')).toBeNull();
    expect(within(orders).queryByText(/^Nothing yet/)).toBeNull();
  });
});

