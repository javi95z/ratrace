// @vitest-environment jsdom
import { content, lives, textFor } from '@ratrace/content';
import { createGame, previewRound, quoteItem, quoteLiving, quoteMargin, quoteMove, quoteOwnedProperty, quotePlans, quotePortfolio, quoteProperty, viewOf } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatFor } from '@/lib/format';
import type { GameSession, SavedGame } from '@/session/types';
import { memoryServices, renderGame, setWidth } from '@/testing/render';
import { HealthCoverNote } from './HealthCover';
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
const { names } = textFor('en');
const button = (name: string | RegExp) => screen.getByRole('button', { name });

/** A life taken to the finances of its current round, without the screen. */
async function inFinance(lifeId: string, { taught = false }: { taught?: boolean } = {}) {
  const services = memoryServices();
  // The heir is a life a player has to unlock before choosing it.
  await services.store.saveProfile({ ...(await services.store.loadProfile()), unlocked: { heir: { at: 1, gameId: 'earlier' }, crypto_kid: { at: 1, gameId: 'earlier' } } });
  const session = await services.sessions.start(lifeId);
  await toFinance(session);
  // Nothing on the market is open with no money sense: a life that is to invest first takes two rounds of a finance course.
  if (taught) {
    for (let round = 0; round < 2; round++) {
      await session.playRound({ orders: [{ type: 'focus', action: 'studyFinance' }] });
      await toFinance(session);
    }
  }
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
    expect(within(owned).getByText('Apartment in the Marina')).toBeTruthy();
    expect(within(owned).getByText(/You live here/)).toBeTruthy();

    await user.click(within(owned).getByRole('button', { name: /^Sell for/ }));
    expect(button('1 order')).toBeTruthy();
    expect(within(owned).getByText('Apartment in the Marina')).toBeTruthy();
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
    const homes = screen.getByRole('region', { name: 'Homes in Dubai' });
    const lets = screen.getByRole('region', { name: 'To let in Dubai' });
    // Each list in the order the game keeps them: the cheapest first. A home is drawn as Dubai builds it.
    expect(kinds(homes)).toEqual(content.propertyTypes.filter((type) => !type.rentalOnly).map((type) => `dubai.${type.id}`));
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
    expect(within(within(homes).getByRole('button', { name: /^Apartment in the Marina/ })).getByText('Status +14')).toBeTruthy();
  });

  it('does not ask what a parking space is for, and says why someone without the skill cannot buy one', async () => {
    const { services } = await inFinance('heir');
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Property' }));
    await user.click(screen.getByRole('button', { name: /^Parking space/ }));
    const sheet = screen.getByRole('dialog', { name: 'Buy to let: Parking space' });
    expect(within(sheet).queryByRole('radiogroup', { name: 'What for' })).toBeNull();
    expect(within(sheet).getByText('Renting out needs money sense 2')).toBeTruthy();
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
      const let_ = (id: string, typeId: string, mortgageId: string | null = null) => ({ id, cityId: view.player.cityId, typeId, value: 4_000_000, basis: 4_000_000, rented: true, mortgageId });
      // The let flat still has a mortgage on it.
      const mortgage = { id: 'debt-9', kind: 'mortgageFixed' as const, principal: 1_000_000, fixedRateBp: 300, roundsLeft: 8 };
      return { ...view, player: { ...view.player, debts: [...view.player.debts, mortgage], properties: [...view.player.properties, let_('property-8', 'parking'), let_('property-9', 'flat', 'debt-9')] } };
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

    // What is let says what a year of it brings, the engine's own figure; the home lived in says nothing of rent.
    const rents = ['property-8', 'property-9'].map((id) => quoteOwnedProperty(content, owning(), id)?.rentAnnual ?? 0);
    expect(rents.every((rent) => rent > 0)).toBe(true);
    expect(within(owned).getAllByText(/^Rent \+/).map((line) => line.textContent)).toEqual(rents.map((rent) => `Rent +${fmt.money(rent)}/yr`));

    // A mortgage is named for the home it is on.
    await user.click(screen.getByRole('tab', { name: 'Debt' }));
    expect(within(screen.getByRole('tabpanel', { name: 'Debt' })).getByText('Fixed mortgage · Apartment in the Marina, Dubai')).toBeTruthy();
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
    // Three ways to work, five to learn, four insurances.
    expect(switches).toHaveLength(3 + 5 + 4);
    for (const one of switches) expect(pictured(one), one.textContent ?? '').toBe(true);
  });
});

describe('the portfolio at a glance', () => {
  it('says what the player\'s wealth is held in, share by share, and what most of it hangs on', async () => {
    // The heir owns a flat and has cash; a round later, two funds as well.
    const { services, session } = await inFinance('heir', { taught: true });
    await session.playRound({ orders: [{ type: 'buy', assetId: 'sp500', amount: 1_000_000 }, { type: 'buy', assetId: 'msci_world', amount: 500_000 }] });
    await toFinance(session);
    const quote = quotePortfolio(content, viewOf(await stateOf(services)));
    renderGame(<Play />, services);
    const glance = await screen.findByRole('region', { name: 'At a glance' });
    expect(within(glance).getByText(fmt.money(quote.total))).toBeTruthy();
    // One line a kind, in the order and the shares the engine gives.
    const kinds: Record<string, string> = { cash: 'Cash', savings: 'Savings', pension: 'Pension', equity: 'Funds and stocks', bond: 'Bonds', crypto: 'Crypto', gold: 'Gold', property: 'Property', things: 'Things' };
    expect(within(glance).getAllByRole('listitem').map((li) => li.textContent)).toEqual(quote.slices.map((slice) => `${kinds[slice.kind]}${fmt.rate(slice.shareBp)}`));
    // The flat is most of what is put to work: said plainly, and no warning, for a home is how most lives hold their wealth.
    expect(quote).toMatchObject({ concentrated: true, largest: { kind: 'property' } });
    expect(within(glance).queryByRole('note')).toBeNull();
  });

  it('warns of too much in one thing only where one thing can fall alone: a single stock or a coin', async () => {
    // The crypto kid's coin is almost all there is, beside a little of a fund.
    const { services, session } = await inFinance('crypto_kid');
    await session.playRound({ orders: [{ type: 'buy', assetId: 'msci_world', amount: 50_000 }] });
    await toFinance(session);
    const quote = quotePortfolio(content, viewOf(await stateOf(services)));
    expect(quote).toMatchObject({ concentrated: true, largest: { kind: 'asset' } });
    renderGame(<Play />, services);
    const glance = await screen.findByRole('region', { name: 'At a glance' });
    expect(within(glance).getByRole('note').textContent).toMatch(/of what you have invested is in one thing: .*\. If it does badly, so do you\.$/);
  });

  it('warns nobody who is only beginning, and says nothing of being paid to someone nothing pays', async () => {
    const { services } = await inFinance('nurse');
    renderGame(<Play />, services);
    const glance = await screen.findByRole('region', { name: 'At a glance' });
    expect(within(glance).queryByRole('note')).toBeNull();
    // All she has is cash, and the one line says so.
    expect(within(glance).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Cash100.0%']);
    expect(screen.queryByRole('region', { name: 'What you are paid' })).toBeNull();
  });
});

describe('what the investments pay', () => {
  it('is shown on each holding and in all, and can be put back into them with one switch', async () => {
    const { services, session } = await inFinance('heir', { taught: true });
    await session.playRound({ orders: [{ type: 'buy', assetId: 'sp500', amount: 1_000_000 }, { type: 'buy', assetId: 'msci_world', amount: 500_000 }] });
    await toFinance(session);
    const state = await stateOf(services);
    const quote = quotePortfolio(content, viewOf(state));
    expect(quote.dividends).toHaveLength(2);
    const user = userEvent.setup();
    renderGame(<Play />, services);
    const pays = await screen.findByRole('region', { name: 'What you are paid' });
    expect(within(pays).getByText(fmt.signed(quote.dividendsTotal))).toBeTruthy();
    for (const paid of quote.dividends) expect(screen.getByText(`Pays ${fmt.money(paid.amount)} this round`)).toBeTruthy();

    const toggle = within(pays).getByRole('switch', { name: /^Reinvest the dividends/ });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    await user.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(toggle.textContent).toContain('Each asset buys more of itself with what it pays.');
    await user.click(button('1 order'));
    expect(within(screen.getByRole('dialog', { name: "This round's orders" })).getByRole('button', { name: 'Remove: Reinvest the dividends' })).toBeTruthy();
    await user.click(within(screen.getByRole('dialog', { name: "This round's orders" })).getByRole('button', { name: 'Close' }));

    await user.click(button('Play the round'));
    await screen.findByRole('heading', { name: 'Two years later' });
    const after = await stateOf(services);
    expect(after.player.reinvest).toBe(true);
    // Each holding cost what it cost, and what it paid on top.
    for (const paid of quote.dividends) expect(after.player.positions[paid.assetId].basis).toBe(state.player.positions[paid.assetId].basis + paid.amount);
    expect(screen.getByText('Dividends reinvested')).toBeTruthy();
  });
});

describe('buying with borrowed money', () => {
  /** The same life with the skill for it, as years of investing would leave it. */
  const seasoned = async (lifeId: string, change: (view: GameView) => GameView = (view) => view) => {
    const { services, session } = await inFinance(lifeId);
    const skilled = (): GameView => change({ ...session.view(), player: { ...session.view().player, life: { ...session.view().player.life, financeSkill: 3 } } });
    const investor: GameSession = { gameId: session.gameId, lifeId: session.lifeId, view: skilled, history: () => session.history(), bankruptcies: () => 0, story: () => [], badges: () => [], answerCard: (option) => session.answerCard(option), playRound: (choices) => session.playRound(choices) };
    services.sessions.resume = async () => ({ lost: null, session: investor });
    return { services, view: skilled() };
  };

  it('is not shown to someone without the skill: the sheet only buys', async () => {
    const { services, session } = await inFinance('civil_servant', { taught: true });
    expect(quoteMargin(content, session.view(), 'sp500').lock).toBe('needs-finance-skill');
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Market' }));
    await user.click(button(/S&P 500/));
    const sheet = screen.getByRole('dialog', { name: 'Buy S&P 500' });
    expect(within(sheet).queryByRole('region', { name: 'Buying on margin' })).toBeNull();
    expect(within(sheet).queryByRole('switch')).toBeNull();
    expect(within(sheet).queryByText(/margin|broker/i)).toBeNull();
    // What is bought there is bought with their own money alone.
    fireEvent.change(within(sheet).getByRole('slider', { name: 'Amount' }), { target: { value: '100000' } });
    await user.click(within(sheet).getByRole('button', { name: 'Confirm $1,000' }));
    await user.click(button('1 order'));
    expect(within(screen.getByRole('dialog', { name: "This round's orders" })).getByRole('button', { name: 'Remove: Buy S&P 500 · $1,000' })).toBeTruthy();
  });

  it('stays in sight, closed, for someone who has the skill and no credit after a bankruptcy', async () => {
    const { services, view } = await seasoned('civil_servant', (view) => ({ ...view, player: { ...view.player, bankruptUntilRound: view.round + 2 } }));
    expect(quoteMargin(content, view, 'sp500').lock).toBe('no-credit');
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Market' }));
    await user.click(button(/S&P 500/));
    const section = within(screen.getByRole('dialog', { name: 'Buy S&P 500' })).getByRole('region', { name: 'Buying on margin' });
    expect((within(section).getByRole('switch') as HTMLButtonElement).disabled).toBe(true);
    expect(within(section).getByText('No bank will lend to you yet after your bankruptcy.')).toBeTruthy();
  });

  it('buys twice what is put in for someone who has it, says what it risks, and names the order for what it is', async () => {
    const { services, view } = await seasoned('civil_servant');
    const quote = quoteMargin(content, view, 'sp500');
    expect(quote).toMatchObject({ lock: null, canDouble: true });
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Market' }));
    await user.click(button(/S&P 500/));
    const sheet = screen.getByRole('dialog', { name: 'Buy S&P 500' });
    const section = within(sheet).getByRole('region', { name: 'Buying on margin' });
    expect(within(section).getByText(`You buy twice as much. The loan costs ${fmt.rate(quote.rateBp)} a year.`)).toBeTruthy();
    expect(within(section).getByText('You gain and lose twice as much. If the loan passes 75% of what it is worth, the broker sells it all: a fall of 33% is enough.')).toBeTruthy();
    await user.click(within(section).getByRole('switch'));
    fireEvent.change(within(sheet).getByRole('slider', { name: 'Amount' }), { target: { value: '100000' } });
    await user.click(within(sheet).getByRole('button', { name: 'Confirm $1,000' }));

    await user.click(button('1 order'));
    expect(within(screen.getByRole('dialog', { name: "This round's orders" })).getByRole('button', { name: 'Remove: Buy $2,000 of S&P 500 on margin (you put in $1,000)' })).toBeTruthy();
    await user.click(within(screen.getByRole('dialog', { name: "This round's orders" })).getByRole('button', { name: 'Close' }));

    // The holding is twice what was put in, and says what is owed on it and how far it may fall.
    await user.click(screen.getByRole('tab', { name: 'Portfolio' }));
    const holdings = screen.getByRole('region', { name: 'Your investments' });
    expect(within(holdings).getByText('$2,000')).toBeTruthy();
    expect(within(holdings).getByText('You owe the broker $1,000 · sold if it falls 33.3%')).toBeTruthy();
    // And it is a debt among the debts, named for what it bought.
    await user.click(screen.getByRole('tab', { name: 'Debt' }));
    expect(within(screen.getByRole('tabpanel', { name: 'Debt' })).getByText('Margin loan · S&P 500')).toBeTruthy();
  });

  it('lends no more on a holding that already owes more than half of itself', async () => {
    const { services } = await seasoned('civil_servant', (view) => ({
      ...view,
      player: { ...view.player, positions: { sp500: { value: 1_000_000, basis: 1_500_000 } }, debts: [...view.player.debts, { id: 'debt-m', kind: 'margin', principal: 600_000, fixedRateBp: 0, roundsLeft: 0, forAsset: 'sp500' }] },
    }));
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Market' }));
    await user.click(button(/S&P 500/));
    const section = within(screen.getByRole('dialog', { name: 'Buy S&P 500' })).getByRole('region', { name: 'Buying on margin' });
    expect((within(section).getByRole('switch') as HTMLButtonElement).disabled).toBe(true);
    expect(within(section).getByText('You already owe more than 50% of what you hold of this: no more is lent on it.')).toBeTruthy();
  });
});

describe('investing every round', () => {
  const plansPanel = () => screen.getByRole('region', { name: 'Regular investing' });
  const setAmount = async (sheet: HTMLElement, cents: number) => {
    fireEvent.change(within(sheet).getByRole('slider', { name: 'Amount' }), { target: { value: String(cents) } });
  };

  it('is set from the market in the sheet that buys, and from then on buys by itself', async () => {
    const { services } = await inFinance('civil_servant', { taught: true });
    const user = userEvent.setup();
    renderGame(<Play />, services);
    // Nothing yet, and the panel says how to begin.
    await screen.findByRole('region', { name: 'Regular investing' });
    expect(within(plansPanel()).getByText(/^Nothing yet\. In the Market/)).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'Market' }));
    await user.click(button(/S&P 500/));
    let sheet = screen.getByRole('dialog', { name: 'Buy S&P 500' });
    await user.click(within(sheet).getByRole('radio', { name: /^Every round/ }));
    sheet = screen.getByRole('dialog', { name: 'Invest in S&P 500 every round' });
    expect(within(sheet).getByText(/it never borrows for you\.$/)).toBeTruthy();
    await setAmount(sheet, 100_000);
    await user.click(within(sheet).getByRole('button', { name: 'Confirm $1,000' }));

    // It is an order of this round, and already counted: the plan is listed and what it buys is held.
    await user.click(screen.getByRole('tab', { name: 'Portfolio' }));
    const row = within(plansPanel()).getByRole('button', { name: /S&P 500/ });
    expect(row.textContent).toContain('$1,000');
    expect(row.textContent).toContain('New plan');
    expect(within(plansPanel()).getByText('Each round you invest $1,000 without lifting a finger.')).toBeTruthy();
    await user.click(button('1 order'));
    expect(within(screen.getByRole('dialog', { name: "This round's orders" })).getByRole('button', { name: 'Remove: Invest $1,000 every round in S&P 500' })).toBeTruthy();
    await user.click(within(screen.getByRole('dialog', { name: "This round's orders" })).getByRole('button', { name: 'Close' }));

    await user.click(button('Play the round'));
    await screen.findByRole('heading', { name: 'Two years later' });
    const state = await stateOf(services);
    expect(state.player.plans).toEqual([{ assetId: 'sp500', amount: 100_000, invested: 100_000, rounds: 1 }]);
    expect(state.player.positions.sp500.basis).toBe(100_000);
  });

  it('shows what a plan has built, warns when a round cannot pay for it, and is changed or ended on a tap', async () => {
    const { services, session } = await inFinance('civil_servant', { taught: true });
    await session.playRound({ orders: [{ type: 'setPlan', assetId: 'sp500', amount: 100_000 }] });
    await toFinance(session);
    await session.playRound({ orders: [] });
    await toFinance(session);
    const state = await stateOf(services);
    const [plan] = quotePlans(viewOf(state));
    expect(plan).toMatchObject({ invested: 200_000, rounds: 2 });
    const preview = previewRound(content, viewOf(state), { orders: [] });
    const user = userEvent.setup();
    renderGame(<Play />, services);
    const panel = await screen.findByRole('region', { name: 'Regular investing' });
    const row = within(panel).getByRole('button', { name: /S&P 500/ });

    // The row counts this round's purchase too, as every figure of the finances does.
    const buys = preview.plans[0].reason === null;
    expect(row.textContent).toContain(buys ? 'Put in $3,000 over 3 rounds' : 'Put in $2,000 over 2 rounds');
    expect(row.textContent?.includes('No cash for it this round')).toBe(!buys);
    // How today's price stands to the average paid, the engine's own figure.
    const [shown] = quotePlans({ ...viewOf(state), player: preview.player });
    if (shown.priceVsAverageBp !== null && shown.priceVsAverageBp !== 0) {
      expect(row.textContent).toContain(`Worth ${fmt.rate(Math.abs(shown.priceVsAverageBp))} ${shown.priceVsAverageBp > 0 ? 'more' : 'less'} today than your average price`);
    }

    // Changed: the sheet opens on what the plan is, and a new amount is an order.
    await user.click(row);
    let sheet = screen.getByRole('dialog', { name: 'Invest in S&P 500 every round' });
    expect(within(sheet).getByRole('status').textContent).toBe('$1,000');
    await setAmount(sheet, 50_000);
    await user.click(within(sheet).getByRole('button', { name: 'Confirm $500' }));
    expect(within(panel).getByRole('button', { name: /S&P 500/ }).textContent).toContain('$500');

    // Ended: the plan is gone from the list, and what it bought stays in the holdings.
    await user.click(within(panel).getByRole('button', { name: /S&P 500/ }));
    sheet = screen.getByRole('dialog', { name: 'Invest in S&P 500 every round' });
    await user.click(within(sheet).getByRole('button', { name: 'Stop investing' }));
    expect(screen.queryByRole('dialog', { name: 'Invest in S&P 500 every round' })).toBeNull();
    expect(within(panel).queryByRole('button', { name: /S&P 500/ })).toBeNull();
    await user.click(button('1 order'));
    expect(within(screen.getByRole('dialog', { name: "This round's orders" })).getByRole('button', { name: 'Remove: Stop investing in S&P 500' })).toBeTruthy();
  });
});

describe('moving to another city', () => {
  it('sets the year there beside the year here, city by city, in the engine\'s own figures', async () => {
    const { services } = await inFinance('nurse');
    const view = viewOf(await stateOf(services));
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Lifestyle' }));
    await user.click(button('Move to another city'));
    const sheet = screen.getByRole('dialog', { name: 'Move to another city' });

    // Where she lives: her year as it is, with nothing to compare it to and nowhere to move.
    const madrid = within(sheet).getByRole('region', { name: 'Madrid' });
    const here = quoteMove(content, view, 'london').here;
    expect(within(madrid).getByText('You live here')).toBeTruthy();
    expect(within(madrid).getByText(fmt.money(here.payAnnual))).toBeTruthy();
    expect(within(madrid).getByText(fmt.money(here.leftAnnual))).toBeTruthy();
    expect(within(madrid).queryByRole('button')).toBeNull();
    // Madrid pays her trade above the usual, and says so.
    expect(within(madrid).getByText('Healthcare +10%')).toBeTruthy();

    for (const city of content.cities.filter((x) => x.id !== 'madrid')) {
      const quote = quoteMove(content, view, city.id);
      const card = within(sheet).getByRole('region', { name: names.cities[city.id] });
      const line = (label: string) => (within(card).getByText(label).parentElement?.textContent ?? '').replace(label, '');
      expect(line('Your pay'), city.id).toBe(`${fmt.compact(quote.here.payAnnual)}→${fmt.compact(quote.there.payAnnual)}`);
      expect(line('Income tax'), city.id).toBe(`${fmt.compact(quote.here.taxAnnual)}→${fmt.compact(quote.there.taxAnnual)}`);
      expect(line('Left over a year'), city.id).toBe(`${fmt.compact(quote.here.leftAnnual)}→${fmt.compact(quote.there.leftAnnual)}`);
      expect(within(card).getByText(`Status +${city.prestige}`)).toBeTruthy();
      expect(within(card).getByText(`Moving costs ${fmt.money(quote.cost)} and 1 focus`)).toBeTruthy();
      // A nurse on the first rung, alone: nothing more to lose by going.
      expect(within(card).queryByText(/^You arrive as/)).toBeNull();
      expect(within(card).queryByText(/^Your partner will go/)).toBeNull();
    }
  });

  it('says what going of one\'s own accord would cost someone with a rung to lose', async () => {
    // The comeback starts two rungs up a career.
    const services = memoryServices();
    await services.store.saveProfile({ ...(await services.store.loadProfile()), unlocked: { comeback: { at: 1, gameId: 'earlier' } } });
    const session = await services.sessions.start('comeback');
    await toFinance(session);
    const view = viewOf(await stateOf(services));
    const job = view.player.life.career;
    if (!job || job.level < 1) throw new Error('the comeback starts above the first rung');
    const elsewhere = content.cities.find((city) => city.id !== view.player.cityId);
    if (!elsewhere) throw new Error('there is another city');
    const quote = quoteMove(content, view, elsewhere.id);
    expect(quote.rungsLost).toBe(1);

    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Lifestyle' }));
    await user.click(button('Move to another city'));
    const card = within(screen.getByRole('dialog', { name: 'Move to another city' })).getByRole('region', { name: names.cities[elsewhere.id] });
    const { text } = textFor('en');
    expect(within(card).getByText(`You arrive as ${text.careers[job.id].levels[job.level - 1]}: a rung down, until your next promotion.`)).toBeTruthy();
    // The pay shown there is the pay of the rung below, in that city.
    expect((within(card).getByText('Your pay').parentElement?.textContent ?? '').endsWith(`→${fmt.compact(quote.there.payAnnual)}`)).toBe(true);
    expect(quote.there.level).toBe(job.level - 1);
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

describe('what a thing is good for', () => {
  it('is said on its sheet in the shop, and nothing is said of a thing that is status and nothing else', async () => {
    const { services } = await inFinance('nurse');
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Shop' }));

    const uses = async (name: RegExp, title: string) => {
      await user.click(button(name));
      const sheet = screen.getByRole('dialog', { name: title });
      const region = within(sheet).queryByRole('region', { name: 'Good for' });
      const lines = region ? within(region).getAllByRole('listitem').map((li) => li.textContent) : null;
      await user.click(within(sheet).getByRole('button', { name: 'Close' }));
      return lines;
    };
    expect(await uses(/SEAT Ibiza/, 'SEAT Ibiza')).toEqual(['Moving city costs 30% less']);
    expect(await uses(/Rolex Submariner/, 'Rolex Submariner')).toEqual(['+6 points of chance on a job hunt']);
    expect(await uses(/MacBook|Laptop/i, names.items.tech_laptop)).toEqual(['+1 career skill when you study']);
    expect(await uses(/Soho House/, 'Soho House')).toEqual(['+6 points of chance on a job hunt']);
    expect(await uses(new RegExp(names.items.travel_safari), names.items.travel_safari)).toEqual(['+1 focus in the round after']);
    expect(await uses(new RegExp(names.items.travel_weekend), names.items.travel_weekend)).toBeNull();
    expect(await uses(new RegExp(names.items.art_photo), names.items.art_photo)).toBeNull();
  });

  it('shows in the focus of the round: a laptop owned makes study worth more', async () => {
    const { services, session } = await inFinance('nurse');
    await session.playRound({ orders: [{ type: 'buyItem', itemId: 'tech_laptop' }] });
    await toFinance(session);
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Lifestyle' }));
    expect(screen.getByRole('switch', { name: /^Study/ }).textContent).toContain(`+${content.life.studySkill + 1} career skill`);
  });
});

describe('buying on instalments', () => {
  it('offers a thing that lasts for a share down and a loan, says what the loan costs, and buys it that way', async () => {
    // The civil servant starts with the fifth of a small car in hand, and pay enough for the loan.
    const { services } = await inFinance('civil_servant');
    const before = await stateOf(services);
    const plan = quoteItem(content, viewOf(before), 'car_seat_ibiza').finance;
    if (plan === null || plan.lock !== null) throw new Error('a civil servant can buy a small car on instalments');
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Shop' }));

    await user.click(button(/SEAT Ibiza/));
    const sheet = screen.getByRole('dialog', { name: 'SEAT Ibiza' });
    const years = plan.termRounds * content.yearsPerRound;
    expect(within(sheet).getByText(new RegExp(`The rest, \\${fmt.money(plan.loan)}, is a loan at ${fmt.rate(plan.rateBp)} over ${years} years: about \\${fmt.money(plan.annual)} a year at first\\. Sell it and the debt stays with you\\.`))).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: `On instalments · ${fmt.money(plan.down)} down` }));

    // It waits in the basket under its own name, and the round then takes the down payment and opens the loan.
    await user.click(button('1 order'));
    const basket = screen.getByRole('dialog', { name: "This round's orders" });
    expect(within(basket).getByRole('button', { name: 'Remove: Buy SEAT Ibiza on instalments' })).toBeTruthy();
    await user.click(within(basket).getByRole('button', { name: 'Close' }));
    await user.click(button('Play the round'));
    await screen.findByRole('heading', { name: 'Two years later' });
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
    const user = userEvent.setup();
    renderGame(<Play />, services);

    await user.click(await screen.findByRole('tab', { name: 'Debt' }));
    expect(within(screen.getByRole('tabpanel', { name: 'Debt' })).getByText('Personal loan · SEAT Ibiza')).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'Shop' }));
    await user.click(button(/SEAT Ibiza/));
    const note = within(screen.getByRole('dialog', { name: 'SEAT Ibiza' })).getByRole('note');
    expect(within(note).getByText('Still owed on the loan')).toBeTruthy();
    expect(within(note).getByText(fmt.money(quote.owed))).toBeTruthy();
    // A car loses value faster than the loan is paid: the sale is said to fall short, and by how much.
    const short = quote.owed - quote.resale;
    expect(within(note).getByText(short > 0 ? `You bought it on instalments. Selling it today would not clear the debt: you would be ${fmt.money(short)} short.` : 'You bought it on instalments. Sell it and the debt stays with you.')).toBeTruthy();
    cleanup();

    // Sold: the thing is gone from the life, and the debt is still on its sheet in the shop.
    await session.playRound({ orders: [{ type: 'sellItem', itemId: 'car_seat_ibiza' }] });
    await toFinance(session);
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Shop' }));
    await user.click(button(/SEAT Ibiza/));
    const gone = within(screen.getByRole('dialog', { name: 'SEAT Ibiza' })).getByRole('note');
    expect(within(gone).getByText('You bought it on instalments and no longer have it. The debt stays.')).toBeTruthy();
  });

  it('is not offered for what is used up or costs little, and says why when the bank will not lend', async () => {
    // A nurse's pay does not stretch to the loan a sports car needs.
    const { services } = await inFinance('nurse');
    const view = viewOf(await stateOf(services));
    const porsche = quoteItem(content, view, 'car_porsche_911').finance;
    if (porsche === null || porsche.lock === null) throw new Error('a nurse cannot have a Porsche on instalments');
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Shop' }));

    await user.click(button(/Casio F-91W/));
    const casio = screen.getByRole('dialog', { name: 'Casio F-91W' });
    expect(within(casio).queryByRole('button', { name: /^On instalments/ })).toBeNull();
    await user.click(within(casio).getByRole('button', { name: 'Close' }));

    await user.click(button(/Porsche 911/));
    const sheet = screen.getByRole('dialog', { name: 'Porsche 911' });
    expect((within(sheet).getByRole('button', { name: /^On instalments/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(sheet).getByText(textFor('en').text.reasons[porsche.lock])).toBeTruthy();
  });
});

describe('how the player lives, in the lifestyle tab', () => {
  it('says what each way of living does to status, the frugal one taking it away', async () => {
    const { services } = await inFinance('nurse');
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Lifestyle' }));
    expect(screen.getByText('Status: Frugal −2 · Normal 0 · Comfortable +3 · Lavish +8 · From 26, living frugally costs 4 status.')).toBeTruthy();
  });

  it('says that cover renews by itself, that health cover costs more taken out later, and the age a cover held was priced at', async () => {
    const { services } = await inFinance('nurse');
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Lifestyle' }));
    expect(screen.getByText('Every cover renews by itself each round until you end it.')).toBeTruthy();
    expect(screen.getByText('Health cover taken out from 32 costs more.')).toBeTruthy();
    await user.click(screen.getByRole('switch', { name: /^Health insurance/ }));
    // Ordered this round, it is priced at the age of this round.
    expect(screen.getByText('Health cover priced at the age you took it out: 22.')).toBeTruthy();
  });
});

describe('the note under health cover', () => {
  const living = (health: { since: number | null; dearerFrom: { fromRound: number; pct: number } | null; refused: boolean }) =>
    ({ ...quoteLiving(content, viewOf(createGame({ content, start: lives[0].start }, 'note'))), health });

  it('says no insurer will take on someone who has been seriously ill, before anything else', async () => {
    renderGame(<HealthCoverNote living={living({ since: null, dearerFrom: { fromRound: 5, pct: 130 }, refused: true })} />, memoryServices());
    expect(await screen.findByText('No insurer will cover your health: you have already had a serious illness.')).toBeTruthy();
    expect(screen.queryByText(/costs more/)).toBeNull();
  });

  it('says nothing of a dearer age once no dearer step is left', async () => {
    renderGame(<HealthCoverNote living={living({ since: null, dearerFrom: null, refused: false })} />, memoryServices());
    expect(await screen.findByText('Every cover renews by itself each round until you end it.')).toBeTruthy();
    expect(screen.queryByText(/costs more|priced at/)).toBeNull();
  });
});

describe('a property the player owns', () => {
  it('opens on a tap: what it is worth, what it would bring, what is owed and what a sale would leave', async () => {
    // The heir starts with a flat in Dubai, lived in and owned outright.
    const { services } = await inFinance('heir');
    const flat = (await stateOf(services)).player.properties[0];
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Property' }));
    const mine = screen.getByRole('region', { name: 'Your properties' });
    await user.click(within(mine).getByRole('button', { name: /^Apartment in the Marina/ }));

    const sheet = screen.getByRole('dialog', { name: 'Apartment in the Marina' });
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


describe('focus from the work panel', () => {
  it('is spent from the sheet of focus as from the Lifestyle tab, while the finances are open', async () => {
    setWidth('desk');
    const { services } = await inFinance('nurse');
    const user = userEvent.setup();
    renderGame(<Play />, services);
    const work = await screen.findByRole('region', { name: 'Work' });
    await user.click(within(work).getByText('Focus this round'));
    const sheet = screen.getByRole('dialog', { name: 'Focus' });
    expect(within(sheet).getByText('Tap to choose. It takes effect when the round is played.')).toBeTruthy();
    // Three ways to work and five to learn.
    expect(within(sheet).getAllByRole('switch')).toHaveLength(8);
    await user.click(within(sheet).getByRole('switch', { name: /^Exercise/ }));
    expect(within(sheet).getByRole('switch', { name: /^Exercise/ }).getAttribute('aria-checked')).toBe('true');
    expect(within(sheet).getByText('2/3')).toBeTruthy();
  });
});

describe('a plan in the market', () => {
  it('is shown on the asset it buys, beside what the asset pays', async () => {
    const { services, session } = await inFinance('heir', { taught: true });
    await session.playRound({ orders: [{ type: 'setPlan', assetId: 'msci_world', amount: 50_000 }] });
    await toFinance(session);
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Market' }));
    const row = screen.getByRole('button', { name: /MSCI World/ });
    expect(within(row).getByText(/Plan: \$500 a round/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /S&P 500/ }).textContent).not.toMatch(/Plan:/);
  });
});

describe('the second-hand shop', () => {
  it('offers a car second hand beside the new one, with its age, its status and its repairs, and buys it for cash', async () => {
    // The heir has the cash for a used car. On a wide screen the round's orders are listed beside the shop.
    setWidth('desk');
    const { services } = await inFinance('heir');
    const quote = quoteItem(content, viewOf(await stateOf(services)), 'car_seat_ibiza');
    const used = quote.used;
    if (!used) throw new Error('a car is sold second hand');
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Shop' }));
    // The shelf says what it costs used, beside the price new.
    expect(within(button(/SEAT Ibiza/)).getByText(`Used: ${fmt.compact(used.price)}`)).toBeTruthy();

    await user.click(button(/SEAT Ibiza/));
    const sheet = screen.getByRole('dialog', { name: 'SEAT Ibiza' });
    const second = within(sheet).getByRole('region', { name: 'Second hand' });
    expect(within(second).getByText(`Status +${used.status}`)).toBeTruthy();
    expect(used.status).toBeLessThan(quote.statusNew);
    expect(within(second).getByText(`${used.ageRounds * content.yearsPerRound} years old`)).toBeTruthy();
    expect(within(second).getByText(`Each round, a ${used.repairChancePct}% chance of a repair of about ${fmt.money(used.repairCost)}. The warranty covers the first round.`)).toBeTruthy();
    expect(within(second).getByText(`Would resell for about ${fmt.money(used.resale)} tomorrow`)).toBeTruthy();
    await user.click(within(second).getByRole('button', { name: `Buy used for ${fmt.money(used.price)}` }));
    // The order is given, the sheet is put away, and the round's list says what was ordered.
    expect(screen.queryByRole('dialog', { name: 'SEAT Ibiza' })).toBeNull();
    expect(screen.getByText('Buy SEAT Ibiza second hand')).toBeTruthy();
  });

  it('says why a used one cannot be had, and offers none of what is only sold new', async () => {
    // The nurse has three thousand dollars: not enough for a used car.
    const { services } = await inFinance('nurse');
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Shop' }));
    await user.click(button(/SEAT Ibiza/));
    const second = within(screen.getByRole('dialog', { name: 'SEAT Ibiza' })).getByRole('region', { name: 'Second hand' });
    expect((within(second).getByRole('button', { name: /^Buy used for/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(second).getByText('You do not have enough cash.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    // A phone is only sold new.
    expect(within(button(/iPhone/)).queryByText(/^Used:/)).toBeNull();
    await user.click(button(/iPhone/));
    expect(within(screen.getByRole('dialog', { name: 'iPhone' })).queryByRole('region', { name: 'Second hand' })).toBeNull();
  });

  it('marks what was bought second hand, on the shelf and among what the player owns', async () => {
    setWidth('desk');
    const { services, session } = await inFinance('heir');
    await session.playRound({ orders: [{ type: 'buyItem', itemId: 'watch_omega', used: true }] });
    await toFinance(session);
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Shop' }));
    const shelf = screen.getByRole('tabpanel', { name: 'Shop' });
    expect(within(within(shelf).getByRole('button', { name: /Omega Speedmaster/ })).getByText('Yours · used')).toBeTruthy();
    // Among what the player owns, beside the game: the thing is named by its name alone.
    await user.click(screen.getByRole('button', { name: 'Omega Speedmaster' }));
    const sheet = screen.getByRole('dialog', { name: 'Omega Speedmaster' });
    expect(within(sheet).getByText('Second hand')).toBeTruthy();
    expect(within(sheet).getByText(`You bought it used: each round, a ${content.life.used.watch?.repairChancePct}% chance of a repair.`)).toBeTruthy();
  });
});

describe('what is not declared', () => {
  const openTaxes = async (lifeId: string) => {
    setWidth('desk');
    const { services, session } = await inFinance(lifeId);
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Taxes' }));
    return { services, session, user, panel: screen.getByRole('region', { name: 'What you do not declare' }) };
  };

  it('takes pay under the table by order: the income tax falls by what is saved, and suspicion rises with it', async () => {
    const { services, user, panel } = await openTaxes('nurse');
    const state = await stateOf(services);
    const honest = previewRound(content, state, { orders: [] });
    const black = previewRound(content, state, { orders: [{ type: 'setEvasion', blackPct: 25 }] });
    expect(within(panel).getByText(/^Chance of an inspection when the round is played: 0%/)).toBeTruthy();
    await user.click(within(panel).getByRole('radio', { name: /^25%/ }));
    expect(within(panel).getByText(`This round you save ${fmt.money(black.evaded.black)}.`)).toBeTruthy();
    expect(screen.getByText(fmt.signed(-black.tax.income))).toBeTruthy();
    expect(black.tax.income).toBeLessThan(honest.tax.income);
    // A quarter of the pay is a few points of suspicion a round, and that is the chance of an inspection.
    const points = Math.floor((25 * content.evasion.blackSuspicionPer100) / 100);
    expect(within(panel).getByText(`Chance of an inspection when the round is played: ${points}%`)).toBeTruthy();
    expect(screen.getByText('Pay under the table: 25%')).toBeTruthy();
    // Choosing nothing again takes the order back.
    await user.click(within(panel).getByRole('radio', { name: /^None/ }));
    expect(screen.queryByText('Pay under the table: 25%')).toBeNull();
  });

  it('opens an offshore company only to someone who knows money well, and says why not', async () => {
    const { panel } = await openTaxes('nurse');
    const shell = within(panel).getByRole('switch', { name: /^Offshore company/ });
    expect((shell as HTMLButtonElement).disabled).toBe(true);
    expect(shell.textContent).toContain('You need more money sense for that.');
  });

  it('hides crypto gains by order, and says nothing is saved in a round with nothing sold', async () => {
    const { user, panel } = await openTaxes('crypto_kid');
    await user.click(within(panel).getByRole('switch', { name: /^Hide crypto gains/ }));
    expect(within(panel).getByRole('switch', { name: /^Hide crypto gains/ }).textContent).toContain('This round you save nothing.');
    // Once on the switch, once among the round's orders.
    expect(screen.getAllByText('Hide crypto gains')).toHaveLength(2);
  });

  it('sells a watch without an invoice, and marks it so among what the player owns', async () => {
    setWidth('desk');
    const { services } = await inFinance('heir');
    const quote = quoteItem(content, viewOf(await stateOf(services)), 'watch_omega');
    const offer = quote.noInvoice;
    if (!offer) throw new Error('a watch is sold without an invoice');
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('tab', { name: 'Shop' }));
    await user.click(within(screen.getByRole('tabpanel', { name: 'Shop' })).getByRole('button', { name: /Omega Speedmaster/ }));
    const part = within(screen.getByRole('dialog', { name: 'Omega Speedmaster' })).getByRole('region', { name: 'Without an invoice' });
    expect(within(part).getByText(new RegExp(`^${offer.discountPct}% cheaper, in cash\\.`))).toBeTruthy();
    await user.click(within(part).getByRole('button', { name: `Buy without an invoice for ${fmt.money(offer.price)}` }));
    expect(screen.getByText('Buy Omega Speedmaster without an invoice')).toBeTruthy();
    // A car is not sold so.
    await user.click(within(screen.getByRole('tabpanel', { name: 'Shop' })).getByRole('button', { name: /SEAT Ibiza/ }));
    expect(within(screen.getByRole('dialog', { name: 'SEAT Ibiza' })).queryByRole('region', { name: 'Without an invoice' })).toBeNull();
  });
});
