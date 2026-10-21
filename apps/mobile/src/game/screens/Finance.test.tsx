// @vitest-environment jsdom
import { content, homeName, propertyArt, textFor } from '@ratrace/content';
import { messagesFor } from '@ratrace/i18n';
import type { RoundActions, RoundState } from '@ratrace/core/game/store';
import { formatFor } from '@ratrace/core/lib/format';
import type { GameSession, SavedGame } from '@ratrace/core/session/types';
import { mortgageSwitch, previewRound, quoteMargin, quoteOwnedProperty, quotePlans, quotePortfolio, quoteProperty, viewOf } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame, spriteRenders } from '../../testing/render';
import { settled } from '../../testing/renders';
import { COLORS } from '../../ui/theme';
import { useGame, useWords } from '../context';
import { FinanceOpened } from './Finance';
import { Play } from './Play';

// The slider's gesture is the phone's (its native side cannot be loaded here, and the kit's own test drives it): a stand-in that keeps what the sheet
// hands it, for a test to move as a finger would, and draws the adjustable a screen reader finds.
type SliderProps = { value: number; min: number; max: number; step: number; onChange(value: number): void; label: string; valueText?: string };
const sliders = vi.hoisted(() => [] as SliderProps[]);
vi.mock('../../ui/Slider', () => ({
  Slider: (props: SliderProps) => {
    sliders.push(props);
    return createElement('div', { role: 'slider', 'aria-label': props.label, 'aria-valuenow': props.value, 'aria-valuetext': props.valueText });
  },
}));

// The engine's quote of everything owned, counted as it is asked: the screen asks it once for each round as it stands.
const quoted = vi.hoisted(() => ({ count: 0 }));
vi.mock('@ratrace/engine', async (original) => {
  const engine = (await original()) as typeof import('@ratrace/engine');
  return {
    ...engine,
    quotePortfolio: (...args: Parameters<typeof engine.quotePortfolio>) => {
      quoted.count += 1;
      return engine.quotePortfolio(...args);
    },
  };
});

beforeEach(() => {
  sliders.length = 0;
});
afterEach(cleanup);

const fmt = formatFor('en');
const en = messagesFor('en');
const ru = messagesFor('ru');
const { text } = textFor('en');
const button = (name: string | RegExp) => screen.getByRole('button', { name });
/** A sheet by its title: the window that holds it. */
const sheetTitled = (title: string) => screen.getByRole('heading', { name: title }).closest('[aria-modal="true"]') as HTMLElement;
/** A panel by the name it is given (its title): the web's `section`, named. */
const panel = (name: string) => screen.getByLabelText(name);
/** The slider of the sheet open, moved as a finger would move it. */
const slide = (value: number) => act(() => sliders[sliders.length - 1].onChange(value));

/** A life taken to the finances of its current round, without the screen. */
async function inFinance(lifeId: string, { taught = false }: { taught?: boolean } = {}) {
  const services = memoryServices();
  // The heir, the crypto kid and the rider are lives a player has to unlock before choosing them.
  await services.store.saveProfile({ ...(await services.store.loadProfile()), unlocked: { heir: { at: 1, gameId: 'earlier' }, crypto_kid: { at: 1, gameId: 'earlier' }, rider: { at: 1, gameId: 'earlier' } } });
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

/** A life whose view is changed as the test needs it (a skill, a debt, a home), played on as the real one is. */
function changed(services: ReturnType<typeof memoryServices>, session: GameSession, change: (view: GameView) => GameView): () => GameView {
  const view = (): GameView => change(session.view());
  const life: GameSession = { gameId: session.gameId, lifeId: session.lifeId, view, history: () => session.history(), bankruptcies: () => 0, story: () => [], badges: () => [], answerCard: (option) => session.answerCard(option), playRound: (choices) => session.playRound(choices) };
  services.sessions.resume = async () => ({ lost: null, session: life });
  return view;
}

/** The same life with the skill for buying with borrowed money, as years of investing would leave it. */
async function seasoned(lifeId: string, change: (view: GameView) => GameView = (view) => view) {
  const { services, session } = await inFinance(lifeId);
  const skilled = changed(services, session, (view) => change({ ...view, player: { ...view.player, life: { ...view.player.life, financeSkill: 3 } } }));
  return { services, view: skilled() };
}

/** The heir a round after buying a studio in Dubai on a fixed mortgage: two homes, and a mortgage to switch. */
async function mortgaged() {
  const { services, session } = await inFinance('heir');
  const quote = quoteProperty(content, session.view(), 'studio');
  const bought = await session.playRound({ orders: [{ type: 'buyProperty', typeId: 'studio', downPayment: quote.minDown, mortgage: 'fixed', rented: false }] });
  expect(bought.events.filter((e) => e.kind === 'orderRejected')).toEqual([]);
  await toFinance(session);
  return { services, session };
}

/** The round store as it stands, and its actions: an order given as a sheet gives it, where a test needs one without the sheet. */
const probe: { state: (RoundState & RoundActions) | null } = { state: null };
function Probe() {
  probe.state = useGame((s) => s);
  return null;
}
/** Play, with the probe beside it. */
function played(services: ReturnType<typeof memoryServices>, ui: ReactNode = <Play />) {
  return renderGame(
    <>
      {ui}
      <Probe />
    </>,
    services,
  );
}

describe('selling what is held', () => {
  it('sells all of it, when a plan buys more of the same later in the round', async () => {
    const { services, session } = await inFinance('heir', { taught: true });
    // Held, and on a plan: the plan's purchase of this round comes after every order.
    await session.playRound({ orders: [{ type: 'buy', assetId: 'sp500', amount: 1_000_000 }, { type: 'setPlan', assetId: 'sp500', amount: 200_000 }] });
    await toFinance(session);
    const held = (await stateOf(services)).player.positions.sp500.value;
    renderGame(<Play />, services);
    const holdings = await screen.findByLabelText('Your investments');
    fireEvent.click(within(holdings).getByRole('button', { name: 'Sell' }));
    const sheet = sheetTitled('Sell S&P 500');
    // The most is what is held now, not what will be held once the plan has bought.
    expect(within(sheet).getByText(`Up to ${fmt.money(held)}`)).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: '100%' }));
    fireEvent.click(within(sheet).getByRole('button', { name: /^Confirm/ }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(button('1 order')).toBeTruthy();
  });
});

describe('the pension', () => {
  it('offers exactly what the round still allows, and the whole of that is accepted', async () => {
    // The heir has more cash than a round's pension cap, so the room is the cap and not the cash.
    const { services } = await inFinance('heir');
    const room = previewRound(content, viewOf(await stateOf(services)), { orders: [] }).pensionRoom;
    expect(room).toBeGreaterThan(0);
    expect(room).toBeLessThan((await stateOf(services)).player.cash);
    renderGame(<Play />, services);

    fireEvent.click(await screen.findByRole('button', { name: /^Pension plan/ }));
    const sheet = sheetTitled('Pension plan');
    // It says what it is, in full, and nothing is cut short on a phone.
    const about = within(sheet).getByText(/^Money set aside for retirement/);
    expect(about.className).not.toMatch(/r-textOverflow-|r-WebkitLineClamp/);
    expect(within(sheet).getByText(`Up to ${fmt.money(room)}`)).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: '100%' }));
    fireEvent.click(within(sheet).getByRole('button', { name: /^Confirm/ }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Pension plan' })).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(button('1 order')).toBeTruthy();
    // The room is used up: the sheet opens on what can still be done, taking money out, rather than on amounts it would refuse.
    fireEvent.click(screen.getByRole('button', { name: /^Pension plan/ }));
    expect(within(sheetTitled('Pension plan')).getByRole('radio', { name: 'Withdraw' }).getAttribute('aria-checked')).toBe('true');
  });

  it('takes money out before its time, with the penalty and the tax told before it is confirmed', async () => {
    const { services, session } = await inFinance('heir');
    const room = previewRound(content, viewOf(await stateOf(services)), { orders: [] }).pensionRoom;
    await session.playRound({ orders: [{ type: 'pensionIn', amount: room }] });
    await toFinance(session);
    const pension = (await stateOf(services)).player.pension;
    expect(pension).toBeGreaterThan(0);
    renderGame(<Play />, services);

    fireEvent.click(await screen.findByRole('button', { name: /^Pension plan/ }));
    fireEvent.click(within(sheetTitled('Pension plan')).getByRole('radio', { name: 'Withdraw' }));
    const sheet = sheetTitled('Pension plan');
    expect(within(sheet).getByText('Before 62 you lose 20%, and what you receive is taxed as income this round.')).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: '100%' }));
    expect(within(sheet).getByText(`You receive ${fmt.money(pension - pension / 5)} before tax`)).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: /^Confirm/ }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(button('1 order')).toBeTruthy();
  });

  it('offers nothing to someone who owes more than they own, instead of a sheet that refuses every amount', async () => {
    // The engineer starts with a student loan larger than their cash.
    const { services } = await inFinance('engineer');
    expect(previewRound(content, viewOf(await stateOf(services)), { orders: [] }).pensionRoom).toBe(0);
    renderGame(<Play />, services);
    fireEvent.click(await screen.findByRole('button', { name: /^Pension plan/ }));
    const sheet = sheetTitled('Pension plan');
    expect(within(sheet).getByText('There is nothing to move.')).toBeTruthy();
    expect(within(sheet).queryByRole('button', { name: /^Confirm/ })).toBeNull();
  });

  it('is open from the start where a scene says so (the phone\'s initial state, as the Hud\'s `open`): its own sheet, not a tap', async () => {
    const { services } = await inFinance('heir');
    renderGame(
      <FinanceOpened value={{ sheet: 'pension' }}>
        <Play />
      </FinanceOpened>,
      services,
    );
    expect(await screen.findByRole('heading', { name: 'Pension plan' })).toBeTruthy();
    expect(within(sheetTitled('Pension plan')).getByText(/^Money set aside for retirement/)).toBeTruthy();
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
    const glance = await screen.findByLabelText('At a glance');
    expect(within(glance).getByText(fmt.money(quote.total))).toBeTruthy();
    // One line a kind, in the order and the shares the engine gives.
    const kinds: Record<string, string> = { cash: 'Cash', savings: 'Savings', pension: 'Pension', equity: 'Funds and stocks', bond: 'Bonds', crypto: 'Crypto', gold: 'Gold', property: 'Property', things: 'Things' };
    expect(within(glance).getAllByRole('listitem').map((li) => li.textContent)).toEqual(quote.slices.map((slice) => `${kinds[slice.kind]}${fmt.rate(slice.shareBp)}`));
    // The bar is a picture of the list, a slice a kind as wide as its share, in the colour of its swatch; hidden from a screen reader, which hears the list.
    const bar = glance.querySelector('[data-glance-bar]') as HTMLElement;
    expect(bar.getAttribute('aria-hidden')).toBe('true');
    const slices = Array.from(bar.querySelectorAll('[data-slice]')) as HTMLElement[];
    expect(slices.map((slice) => [slice.getAttribute('data-slice'), slice.style.width])).toEqual(quote.slices.map((slice) => [slice.kind, `${slice.shareBp / 100}%`]));
    // The flat is most of what is put to work: said plainly, and no warning, for a home is how most lives hold their wealth.
    expect(quote).toMatchObject({ concentrated: true, largest: { kind: 'property' } });
    expect(within(glance).queryByRole('note')).toBeNull();
    expect(within(glance).getByText(/^The heaviest of what is invested: /)).toBeTruthy();
  });

  it('warns of too much in one thing only where one thing can fall alone: a single stock or a coin', async () => {
    // The crypto kid's coin is almost all there is, beside a little of a fund.
    const { services, session } = await inFinance('crypto_kid');
    await session.playRound({ orders: [{ type: 'buy', assetId: 'msci_world', amount: 50_000 }] });
    await toFinance(session);
    const quote = quotePortfolio(content, viewOf(await stateOf(services)));
    expect(quote).toMatchObject({ concentrated: true, largest: { kind: 'asset' } });
    renderGame(<Play />, services);
    const glance = await screen.findByLabelText('At a glance');
    const note = within(glance).getByRole('note');
    expect(note.textContent).toMatch(/of what you have invested is in one thing: .*\. If it does badly, so do you\.$/);
    // A wine rule down its left, 4 wide, the words 8 in from it.
    expect(note.style.borderLeftWidth).toBe('4px');
    expect(note.style.borderLeftColor).toBe(rgb(COLORS['wine-300']));
    expect(note.style.paddingLeft).toBe('8px');
  });

  it('warns nobody who is only beginning, and says nothing of being paid to someone nothing pays', async () => {
    const { services } = await inFinance('nurse');
    renderGame(<Play />, services);
    const glance = await screen.findByLabelText('At a glance');
    expect(within(glance).queryByRole('note')).toBeNull();
    // All she has is cash, and the one line says so.
    expect(within(glance).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Cash100.0%']);
    expect(screen.queryByLabelText('What you are paid')).toBeNull();
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
    renderGame(<Play />, services);
    const pays = await screen.findByLabelText('What you are paid');
    expect(within(pays).getByText(fmt.signed(quote.dividendsTotal))).toBeTruthy();
    for (const paid of quote.dividends) expect(screen.getByText(`Pays ${fmt.money(paid.amount)}/round`)).toBeTruthy();

    const toggle = within(pays).getByRole('switch', { name: /^Reinvest the dividends/ });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    await waitFor(() => expect(within(screen.getByLabelText('What you are paid')).getByRole('switch', { name: /^Reinvest the dividends/ }).getAttribute('aria-checked')).toBe('true'));
    expect(within(screen.getByLabelText('What you are paid')).getByRole('switch').textContent).toContain('Each asset buys more of itself with what it pays.');
    fireEvent.click(button('1 order'));
    const orders = sheetTitled("This round's orders");
    expect(within(orders).getByRole('button', { name: 'Remove: Reinvest the dividends' })).toBeTruthy();
    fireEvent.click(within(orders).getByRole('button', { name: 'Close' }));

    fireEvent.click(button('Play the round'));
    await screen.findByRole('heading', { name: 'Two years later' });
    await waitFor(async () => expect((await stateOf(services)).round).toBe(state.round + 1));
    const after = await stateOf(services);
    expect(after.player.reinvest).toBe(true);
    // Each holding cost what it cost, and what it paid on top.
    for (const paid of quote.dividends) expect(after.player.positions[paid.assetId].basis).toBe(state.player.positions[paid.assetId].basis + paid.amount);
    expect(screen.getByText('Dividends reinvested')).toBeTruthy();
  });

  it('says so when the round leaves no cash to put back', async () => {
    const { services, session } = await inFinance('heir', { taught: true });
    await session.playRound({ orders: [{ type: 'buy', assetId: 'sp500', amount: 1_000_000 }, { type: 'setReinvest', on: true }] });
    await toFinance(session);
    played(services);
    const pays = await screen.findByLabelText('What you are paid');
    expect(within(pays).queryByText(en.finance.glance.reinvestShort)).toBeNull();
    // Everything spent: nothing is left after the bills for what is paid to buy more of itself.
    const cash = probe.state!.preview!.player.cash;
    await settled(() => void probe.state!.addOrder({ type: 'depositIn', amount: cash }));
    expect(probe.state!.preview!.reinvested).toBe(0);
    expect(within(screen.getByLabelText('What you are paid')).getByText(en.finance.glance.reinvestShort)).toBeTruthy();
  });
});

describe('buying with borrowed money', () => {
  /** The market's sheet that buys the S&P 500, opened from its row. */
  const openSp500 = async () => {
    fireEvent.click(await screen.findByRole('tab', { name: 'Market' }));
    fireEvent.click(button(/S&P 500/));
    return () => sheetTitled('Buy S&P 500');
  };
  const brokerLoan = (sheet: HTMLElement) => within(sheet).getByRole('region', { name: 'Broker loan' });

  it('is not shown to someone without the skill: the sheet only buys', async () => {
    const { services, session } = await inFinance('civil_servant', { taught: true });
    expect(quoteMargin(content, session.view(), 'sp500').lock).toBe('needs-finance-skill');
    renderGame(<Play />, services);
    const sheet = await openSp500();
    expect(within(sheet()).queryByRole('region', { name: 'Broker loan' })).toBeNull();
    expect(within(sheet()).queryByRole('radio', { name: /×/ })).toBeNull();
    expect(within(sheet()).queryByText(/margin|broker/i)).toBeNull();
    // What is bought there is bought with their own money alone.
    slide(100_000);
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Confirm $1,000' }));
    fireEvent.click(button('1 order'));
    expect(within(sheetTitled("This round's orders")).getByRole('button', { name: 'Remove: Buy S&P 500 · $1,000' })).toBeTruthy();
  });

  it('stays in sight, closed, for someone who has the skill and no credit after a bankruptcy', async () => {
    const { services, view } = await seasoned('civil_servant', (view) => ({ ...view, player: { ...view.player, bankruptUntilRound: view.round + 2 } }));
    expect(quoteMargin(content, view, 'sp500').lock).toBe('no-credit');
    renderGame(<Play />, services);
    const section = brokerLoan((await openSp500())());
    expect(within(section).queryByRole('radio')).toBeNull();
    expect(within(section).getByText('No bank will lend to you yet after your bankruptcy.')).toBeTruthy();
  });

  it('buys up to twice what is put in for someone who has it, says what it costs and risks, and names the order for what it is', async () => {
    const { services, view } = await seasoned('civil_servant');
    const quote = quoteMargin(content, view, 'sp500');
    expect(quote).toMatchObject({ lock: null, canDouble: true });
    renderGame(<Play />, services);
    const sheet = await openSp500();
    expect(within(brokerLoan(sheet())).getAllByRole('radio').map((radio) => radio.textContent)).toEqual(['No loan', '×1.25', '×1.5', '×2']);
    expect(within(brokerLoan(sheet())).getByText(`The broker lends you part of it to buy more. It costs ${fmt.rate(quote.rateBp)} a year.`)).toBeTruthy();
    fireEvent.click(within(brokerLoan(sheet())).getByRole('radio', { name: '×2' }));
    expect(within(brokerLoan(sheet())).getByText('You buy ×2: you win and lose that much more. If the loan goes past 75% of what it is worth, the broker sells it all.')).toBeTruthy();
    slide(100_000);
    // What it comes to, as the amount moves: the holding, the loan, what it costs a round, and the fall that sells it.
    expect(within(sheet()).getByText(/^You buy \$2,000 in all: the broker puts in \$1,000\./)).toBeTruthy();
    expect(within(sheet()).getByText(/It costs you about \$\d+ a round · sold if it falls 33\.3%/)).toBeTruthy();
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Confirm $1,000' }));

    fireEvent.click(button('1 order'));
    expect(within(sheetTitled("This round's orders")).getByRole('button', { name: 'Remove: Buy $2,000 of S&P 500 on margin (you put in $1,000)' })).toBeTruthy();
    fireEvent.click(within(sheetTitled("This round's orders")).getByRole('button', { name: 'Close' }));

    // The holding is twice what was put in, and says what is owed on it and how far it may fall, in wine.
    fireEvent.click(screen.getByRole('tab', { name: 'Portfolio' }));
    const holdings = screen.getByLabelText('Your investments');
    expect(within(holdings).getByText('$2,000')).toBeTruthy();
    const owed = within(holdings).getByText('You owe the broker $1,000 · sold if it falls 33.3%');
    expect((owed.parentElement as HTMLElement).style.color).toBe(rgb(COLORS['wine-300']));
    // And it is a debt among the debts, named for what it bought.
    fireEvent.click(screen.getByRole('tab', { name: 'Debt' }));
    const debt = screen.getByRole('tabpanel', { name: 'Debt' });
    expect(within(debt).getByText('Margin loan · S&P 500')).toBeTruthy();
    // With how near it is to the forced sale.
    expect(within(debt).getByText('On S&P 500, worth $2,000')).toBeTruthy();
    expect(within(debt).getByRole('meter', { name: 'How near the forced sale' }).getAttribute('aria-valuenow')).toBe('67');
    expect(within(debt).getByText('sold if it falls 33.3%')).toBeTruthy();
  });

  it('borrows only the share chosen: half as much again at ×1.5', async () => {
    const { services } = await seasoned('civil_servant');
    renderGame(<Play />, services);
    const sheet = await openSp500();
    fireEvent.click(within(brokerLoan(sheet())).getByRole('radio', { name: '×1.5' }));
    slide(100_000);
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Confirm $1,000' }));
    fireEvent.click(button('1 order'));
    expect(within(sheetTitled("This round's orders")).getByRole('button', { name: 'Remove: Buy $1,500 of S&P 500 on margin (you put in $1,000)' })).toBeTruthy();
  });

  it('lends no more on a holding that already owes more than half of itself', async () => {
    const { services } = await seasoned('civil_servant', (view) => ({
      ...view,
      player: { ...view.player, positions: { sp500: { value: 1_000_000, basis: 1_500_000 } }, debts: [...view.player.debts, { id: 'debt-m', kind: 'margin', principal: 600_000, fixedRateBp: 0, roundsLeft: 0, forAsset: 'sp500' }] },
    }));
    renderGame(<Play />, services);
    const section = brokerLoan((await openSp500())());
    expect(within(section).queryByRole('radio')).toBeNull();
    expect(within(section).getByText('You already owe more than 50% of what you hold of this: no more is lent on it.')).toBeTruthy();
  });

  it('shows, in the debt tab, how near a broker\'s loan is to the forced sale: a meter of the loan against the holding, gold until it nears', async () => {
    const { services } = await seasoned('civil_servant', (view) => ({
      ...view,
      player: { ...view.player, positions: { sp500: { value: 200_000, basis: 200_000 } }, debts: [...view.player.debts, { id: 'debt-m', kind: 'margin', principal: 100_000, fixedRateBp: 0, roundsLeft: 0, forAsset: 'sp500' }] },
    }));
    renderGame(<Play />, services);
    fireEvent.click(await screen.findByRole('tab', { name: 'Debt' }));
    const debt = screen.getByRole('tabpanel', { name: 'Debt' });
    expect(within(debt).getByText('On S&P 500, worth $2,000')).toBeTruthy();
    const meter = within(debt).getByRole('meter', { name: 'How near the forced sale' });
    expect(meter.getAttribute('aria-valuenow')).toBe('67');
    expect(within(debt).getByText('sold if it falls 33.3%')).toBeTruthy();
    // Two thirds of the way: gold, not yet wine.
    const fill = meter.firstElementChild as HTMLElement;
    expect(fill.style.width).toMatch(/^66\.6+7?%$/);
    expect(fill.style.backgroundColor).toBe(rgb(COLORS['gold-500']));
    // A broker's loan has no term: it is paid back when the holding is sold.
    expect(within(debt).queryByText(/No fixed term/)).toBeNull();
  });

  it('draws no meter beside a debt that is not a broker\'s', async () => {
    // The engineer begins with a student loan.
    const { services } = await inFinance('engineer');
    renderGame(<Play />, services);
    fireEvent.click(await screen.findByRole('tab', { name: 'Debt' }));
    const debt = screen.getByRole('tabpanel', { name: 'Debt' });
    expect(within(debt).getAllByRole('button', { name: 'Repay' })).toHaveLength(1);
    expect(within(debt).queryByRole('meter')).toBeNull();
  });
});

describe('investing every round', () => {
  const plansPanel = () => panel('Regular investing');

  it('is set from the market in the sheet that buys, and from then on buys by itself', async () => {
    const { services } = await inFinance('civil_servant', { taught: true });
    renderGame(<Play />, services);
    // Nothing yet, and the panel says how to begin.
    await screen.findByLabelText('Regular investing');
    expect(within(plansPanel()).getByText(/^Nothing yet\. In the Market/)).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Market' }));
    fireEvent.click(button(/S&P 500/));
    fireEvent.click(within(sheetTitled('Buy S&P 500')).getByRole('radio', { name: /^Every round/ }));
    const sheet = sheetTitled('Invest in S&P 500 every round');
    expect(within(sheet).getByText(/it never borrows for you\.$/)).toBeTruthy();
    slide(100_000);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Confirm $1,000' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Invest in S&P 500 every round' })).toBeNull());

    // It is an order of this round, and already counted: the plan is listed and what it buys is held.
    fireEvent.click(screen.getByRole('tab', { name: 'Portfolio' }));
    const row = within(plansPanel()).getByRole('button', { name: /S&P 500/ });
    expect(row.textContent).toContain('$1,000');
    expect(row.textContent).toContain('New plan');
    expect(within(plansPanel()).getByText('Each round you invest $1,000 without lifting a finger.')).toBeTruthy();
    fireEvent.click(button('1 order'));
    expect(within(sheetTitled("This round's orders")).getByRole('button', { name: 'Remove: Invest $1,000 every round in S&P 500' })).toBeTruthy();
    fireEvent.click(within(sheetTitled("This round's orders")).getByRole('button', { name: 'Close' }));

    const before = await stateOf(services);
    fireEvent.click(button('Play the round'));
    await screen.findByRole('heading', { name: 'Two years later' });
    await waitFor(async () => expect((await stateOf(services)).round).toBe(before.round + 1));
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
    renderGame(<Play />, services);
    await screen.findByLabelText('Regular investing');
    const row = () => within(plansPanel()).getByRole('button', { name: /S&P 500/ });

    // The row counts this round's purchase too, as every figure of the finances does.
    const buys = preview.plans[0].reason === null;
    expect(row().textContent).toContain(buys ? '$3,000 over 3 rounds' : '$2,000 over 2 rounds');
    expect(row().textContent?.includes('No cash for it this round')).toBe(!buys);
    // How today's price stands to the average paid, the engine's own figure.
    const [shown] = quotePlans({ ...viewOf(state), player: preview.player });
    if (shown.priceVsAverageBp !== null && shown.priceVsAverageBp !== 0) {
      expect(row().textContent).toContain(`${shown.priceVsAverageBp > 0 ? '▲' : '▼'} ${fmt.rate(Math.abs(shown.priceVsAverageBp))} ${shown.priceVsAverageBp > 0 ? 'above' : 'below'} your average`);
    }

    // Changed: the sheet opens on what the plan is, and a new amount is an order.
    fireEvent.click(row());
    let sheet = sheetTitled('Invest in S&P 500 every round');
    expect(sliders[sliders.length - 1].value).toBe(100_000);
    expect(within(sheet).getAllByText('$1,000').length).toBeGreaterThan(0);
    // What it has built so far, under what it is for.
    expect(within(sheet).getByText('What you hold today')).toBeTruthy();
    expect(within(sheet).getByText('What it cost you')).toBeTruthy();
    slide(50_000);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Confirm $500' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Invest in S&P 500 every round' })).toBeNull());
    expect(row().textContent).toContain('$500');

    // Ended: the plan is gone from the list, and what it bought stays in the holdings.
    fireEvent.click(row());
    sheet = sheetTitled('Invest in S&P 500 every round');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Stop investing' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Invest in S&P 500 every round' })).toBeNull());
    expect(within(plansPanel()).queryByRole('button', { name: /S&P 500/ })).toBeNull();
    expect(within(panel('Your investments')).getByText('S&P 500')).toBeTruthy();
    fireEvent.click(button('1 order'));
    expect(within(sheetTitled("This round's orders")).getByRole('button', { name: 'Remove: Stop investing in S&P 500' })).toBeTruthy();
  });
});

describe('a sheet of an amount', () => {
  it('gives its amount once for a double tap on its button, and once again when it is opened again', async () => {
    const { services } = await inFinance('heir');
    played(services);
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    slide(100_000);
    const confirm = within(sheetTitled('Move cash to savings')).getByRole('button', { name: 'Confirm $1,000' });
    // Both presses before the screen is drawn again: $1,000 saved, not $2,000 (two savings would be one order of the sum).
    act(() => {
      fireEvent.click(confirm);
      fireEvent.click(confirm);
    });
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Move cash to savings' })).toBeNull());
    expect(probe.state!.orders).toEqual([{ type: 'depositIn', amount: 100_000 }]);
    // Opened again, it gives its amount again: one more $1,000, added to the order.
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    slide(100_000);
    fireEvent.click(within(sheetTitled('Move cash to savings')).getByRole('button', { name: 'Confirm $1,000' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Move cash to savings' })).toBeNull());
    expect(probe.state!.orders).toEqual([{ type: 'depositIn', amount: 200_000 }]);
  });
});

describe("this round's orders", () => {
  it('list an order the player gives, which can be taken back, and put back again', async () => {
    const { services } = await inFinance('heir');
    renderGame(<Play />, services);
    // Cash moved to savings, from the portfolio (the city move of the web's test is the Lifestyle tab's, Task 14).
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    const save = sheetTitled('Move cash to savings');
    slide(100_000);
    fireEvent.click(within(save).getByRole('button', { name: 'Confirm $1,000' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Move cash to savings' })).toBeNull());

    fireEvent.click(button('1 order'));
    const orders = sheetTitled("This round's orders");
    expect(within(orders).getAllByRole('listitem')).toHaveLength(1);
    expect(within(orders).getByText('Save $1,000')).toBeTruthy();
    // The count and the cash it leaves, before the round is played.
    const cash = (await stateOf(services)).player.cash;
    // (Set in runs by font, the arrow in one of its own: read as the words it makes.)
    expect(orders.textContent).toContain(`1 order · cash ${fmt.money(cash)} → ${fmt.money(cash - 100_000)}`);
    fireEvent.click(within(orders).getByRole('button', { name: 'Remove: Save $1,000' }));
    expect(within(sheetTitled("This round's orders")).getByText(/^Nothing yet/)).toBeTruthy();
    // What was just taken out can be put back, until the basket changes again.
    const removed = within(sheetTitled("This round's orders")).getByRole('status');
    expect(removed.textContent).toContain('Order removed.');
    fireEvent.click(within(removed).getByRole('button', { name: 'Undo' }));
    expect(within(sheetTitled("This round's orders")).getByText('Save $1,000')).toBeTruthy();
    expect(within(sheetTitled("This round's orders")).queryByRole('status')).toBeNull();
  });

  it('list a move a card already decided, at the top and with no way to take it back', async () => {
    const { services, session } = await inFinance('nurse');
    // The same life, having said yes on a card to a job in London.
    const moving = (): GameView => ({ ...session.view(), player: { ...session.view().player, life: { ...session.view().player.life, movingTo: 'london' } } });
    const leaving: GameSession = { gameId: session.gameId, lifeId: session.lifeId, view: moving, history: () => session.history(), bankruptcies: () => 0, story: () => [], badges: () => [], answerCard: (option) => session.answerCard(option), playRound: (choices) => session.playRound(choices) };
    services.sessions.resume = async () => ({ lost: null, session: leaving });
    renderGame(<Play />, services);
    await screen.findByRole('tab', { name: 'Portfolio' });

    // The basket still counts only what the player ordered: the move is not theirs to remove.
    fireEvent.click(button('No orders'));
    const orders = sheetTitled("This round's orders");
    const [move] = within(orders).getAllByRole('listitem');
    expect(within(move).getByText('Move to London')).toBeTruthy();
    expect(within(move).getByText('Already decided')).toBeTruthy();
    expect(within(move).queryByRole('button')).toBeNull();
    expect(move.querySelector('[data-sprite="icon.city_london"]')).not.toBeNull();
    expect(within(orders).queryByText(/^Nothing yet/)).toBeNull();
  });

  it('tells why an order was refused, and that taking one out took others with it', async () => {
    const { services } = await inFinance('heir', { taught: true });
    played(services);
    await screen.findByLabelText('Your investments');
    // More than there is to sell: the round refuses it, and the screen says so.
    await settled(() => void probe.state!.addOrder({ type: 'sell', assetId: 'sp500', amount: 100_000 }));
    expect(screen.getByRole('alert').textContent).toMatch(/^Not possible: /);
    await settled(() => probe.state!.clearRefusal());
    expect(screen.queryByRole('alert')).toBeNull();
    // A purchase and the sale of it: taking out the purchase takes the sale with it.
    await settled(() => void probe.state!.addOrder({ type: 'buy', assetId: 'sp500', amount: 100_000 }));
    await settled(() => void probe.state!.addOrder({ type: 'sell', assetId: 'sp500', amount: 50_000 }));
    expect(probe.state!.orders).toHaveLength(2);
    await settled(() => probe.state!.removeOrder(0));
    expect(probe.state!.alsoRemoved).toBe(1);
    expect(screen.getByRole('alert').textContent).toBe('1 order that depended on it went with it.');
  });
});

describe('the finances, laid out', () => {
  it('stand on one panel a tab: all eight of the web\'s, in its order, the portfolio the first and the one open', async () => {
    const { services } = await inFinance('heir');
    renderGame(<Play />, services);
    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Portfolio', 'Market', 'Property', 'Business', 'Debt', 'Lifestyle', 'Shop', 'Taxes']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tablist', { name: 'Your finances' })).toBeTruthy();
    expect(screen.getByRole('tabpanel', { name: 'Portfolio' })).toBeTruthy();
    // Its panels, top to bottom, as the web lays them: at a glance; cash, savings and the pension; the investments; what they pay (none yet); the plans.
    const order = ['At a glance', 'Cash', 'Your investments', 'Regular investing'].map((name) => (name === 'Cash' ? screen.getByText('Earns nothing') : panel(name)));
    for (let i = 1; i < order.length; i++) expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('offers savings only what there is to move: no withdrawing with nothing saved', async () => {
    const { services } = await inFinance('heir');
    renderGame(<Play />, services);
    await screen.findByLabelText('Your investments');
    expect(button('Save')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Withdraw' })).toBeNull();
  });

  it('answers each order of a holding\'s: bought, its mark jumps and throws gold sparks; what was ordered before it was drawn plays nothing', async () => {
    const { services, session } = await inFinance('heir', { taught: true });
    await session.playRound({ orders: [{ type: 'buy', assetId: 'sp500', amount: 1_000_000 }] });
    await toFinance(session);
    played(services);
    const holdings = await screen.findByLabelText('Your investments');
    expect(holdings.querySelector('[data-mark="buy"], [data-mark="sell"]')).toBeNull();
    await settled(() => void probe.state!.addOrder({ type: 'buy', assetId: 'sp500', amount: 100_000 }));
    const mark = screen.getByLabelText('Your investments').querySelector('[data-mark]') as HTMLElement;
    expect(mark.getAttribute('data-mark')).toBe('buy');
    // Eight gold, light gold and cream squares, 26 out.
    expect(mark.querySelectorAll('[aria-hidden="true"] > div').length).toBe(8);
  });
});

describe('a holding\'s mark, answering an order', () => {
  it('keeps its picture where it is (its canvas is not made again): the box round it plays the jump, each order anew', async () => {
    const { services, session } = await inFinance('crypto_kid');
    await session.playRound({ orders: [{ type: 'buy', assetId: 'apple', amount: 50_000 }] });
    await toFinance(session);
    played(services);
    const holdings = await screen.findByLabelText('Your investments');
    const logo = holdings.querySelector('[data-sprite="logo.apple"]');
    expect(logo).not.toBeNull();
    await settled(() => void probe.state!.addOrder({ type: 'buy', assetId: 'apple', amount: 10_000 }));
    const after = screen.getByLabelText('Your investments').querySelector('[data-sprite="logo.apple"]');
    expect(after).toBe(logo);
    expect(after!.closest('[data-mark]')?.getAttribute('data-mark')).toBe('buy');
  });
});

describe('the homes a player owns', () => {
  it('keeps a home that was just put up for sale in its place, so a second tap cannot sell the next one', async () => {
    const { services } = await inFinance('heir');
    renderGame(<Play />, services);
    fireEvent.click(await screen.findByRole('tab', { name: 'Property' }));
    const owned = () => panel('Your properties');
    expect(within(owned()).getByText('Apartment in the Marina')).toBeTruthy();
    expect(within(owned()).getByText(/You live here/)).toBeTruthy();

    fireEvent.click(within(owned()).getByRole('button', { name: /^Sell for/ }));
    // The sale is told in full before it is ordered: nothing is ordered yet.
    const sheet = sheetTitled('Sell Apartment in the Marina');
    expect(within(sheet).getByText('Sale price')).toBeTruthy();
    expect(within(sheet).getByText('You keep')).toBeTruthy();
    expect(within(sheet).getByText(/It is your home: you move out/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '1 order' })).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: /^Sell and keep/ }));
    expect(button('1 order')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Sell Apartment in the Marina' })).toBeNull());
    expect(within(owned()).getByText('Apartment in the Marina')).toBeTruthy();
    const selling = within(owned()).getByRole('button', { name: 'Sold when the round is played' });
    expect(selling.getAttribute('aria-disabled')).toBe('true');
    expect(within(owned()).queryByRole('button', { name: /^Sell for/ })).toBeNull();
    fireEvent.click(selling);
    expect(button('1 order')).toBeTruthy();
  });

  it('says "You live here" of the one home the engine says the player lives in, not of every home in town', async () => {
    const { services, session } = await mortgaged();
    expect(session.view().player.properties).toHaveLength(2);
    renderGame(<Play />, services);
    fireEvent.click(await screen.findByRole('tab', { name: 'Property' }));
    const owned = panel('Your properties');
    expect(within(owned).getAllByText(/You live here/)).toHaveLength(1);
    expect(within(owned).getAllByText(/Standing empty/)).toHaveLength(1);
  });
});

describe('property that is only for letting', () => {
  it('shows homes and what is only for letting apart, every one on the same dark tile, and says of a parking space what it lets for', async () => {
    // Three finance courses: Finance 2, which letting takes.
    const { services, session } = await inFinance('heir', { taught: true });
    await session.playRound({ orders: [{ type: 'focus', action: 'studyFinance' }] });
    await toFinance(session);
    renderGame(<Play />, services);
    fireEvent.click(await screen.findByRole('tab', { name: 'Property' }));
    const kinds = (region: HTMLElement) => within(region).getAllByRole('button').map((tile) => tile.querySelector('[data-sprite]')?.getAttribute('data-sprite')?.replace(/^home\./, ''));
    const homes = panel('Homes in Dubai');
    const lets = panel('To let in Dubai');
    // Each list in the order the game keeps them: the cheapest first. A home is drawn as Dubai builds it.
    expect(kinds(homes)).toEqual(content.propertyTypes.filter((type) => !type.rentalOnly).map((type) => `dubai.${type.id}`));
    // What Dubai sells to let: the five every city sells, and its berths in the Marina.
    const letHere = content.propertyTypes.filter((type) => type.rentalOnly && (type.cities ?? ['dubai']).includes('dubai'));
    expect(kinds(lets)).toEqual(letHere.map((type) => propertyArt(type.id, 'dubai').replace(/^home\./, '')));
    expect(letHere.map((type) => type.id)).toEqual(['parking', 'yacht_berth', 'shop', 'office', 'warehouse', 'block']);
    expect(kinds(homes)).toHaveLength(11);
    // No tile is a cream card: property sits on the same navy as everything else that can be bought.
    for (const tile of [...within(homes).getAllByRole('button'), ...within(lets).getAllByRole('button')]) expect((tile.firstElementChild as HTMLElement).style.backgroundColor).toBe(rgb(COLORS['night-600']));

    const parking = quoteProperty(content, session.view(), 'parking');
    const tile = within(lets).getByRole('button', { name: /^Parking bay in Downtown/ });
    expect(within(tile).getByText(`Lets for ${fmt.compact(parking.rentAnnual)} a year`)).toBeTruthy();
    expect(within(tile).queryByText(/^Status/)).toBeNull();
    // A home says what living in it is worth.
    expect(within(within(homes).getByRole('button', { name: /^Apartment in the Marina/ })).getByText('Status +14')).toBeTruthy();
  });

  it('does not offer what can only be let to someone without the Finance to let it', async () => {
    const { services } = await inFinance('nurse');
    renderGame(<Play />, services);
    fireEvent.click(await screen.findByRole('tab', { name: 'Property' }));
    expect(screen.queryByRole('button', { name: /^Parking space/ })).toBeNull();
    expect(screen.queryByLabelText('To let in Madrid')).toBeNull();
    expect(panel('Homes in Madrid')).toBeTruthy();
  });

  it('buys a parking space to let, for someone who has the skill', async () => {
    const { services, session } = await inFinance('heir');
    // The same life, having learnt what a landlord must know.
    changed(services, session, (view) => ({ ...view, player: { ...view.player, life: { ...view.player.life, financeSkill: 2 } } }));
    renderGame(<Play />, services);
    fireEvent.click(await screen.findByRole('tab', { name: 'Property' }));
    fireEvent.click(screen.getByRole('button', { name: /^Parking bay in Downtown/ }));
    const sheet = sheetTitled('Buy to let: Parking bay in Downtown');
    fireEvent.click(within(sheet).getByRole('radio', { name: /^Pay in full/ }));
    fireEvent.click(within(sheetTitled('Buy to let: Parking bay in Downtown')).getByRole('button', { name: 'Buy' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Buy to let: Parking bay in Downtown' })).toBeNull());
    // It is in the basket as a let, and in the list as rented out with nothing to switch off.
    const owned = panel('Your properties');
    expect(within(owned).getByText('Parking bay in Downtown')).toBeTruthy();
    expect(within(owned).getByText(/Rented out/)).toBeTruthy();
    expect(within(owned).queryByRole('button', { name: 'Stop renting it out' })).toBeNull();
    expect(button('1 order')).toBeTruthy();
  });
});

describe('a parking space already owned', () => {
  it('offers to sell it and nothing else: there is no renting to stop', async () => {
    const { services, session } = await inFinance('heir');
    // The same life, with a parking space bought in an earlier round, and beside it a flat that is let.
    const owning = changed(services, session, (view) => {
      const let_ = (id: string, typeId: string, mortgageId: string | null = null) => ({ id, cityId: view.player.cityId, typeId, value: 4_000_000, basis: 4_000_000, rented: true, mortgageId });
      // The let flat still has a mortgage on it.
      const mortgage = { id: 'debt-9', kind: 'mortgageFixed' as const, principal: 1_000_000, fixedRateBp: 300, roundsLeft: 8 };
      return { ...view, player: { ...view.player, debts: [...view.player.debts, mortgage], properties: [...view.player.properties, let_('property-8', 'parking'), let_('property-9', 'flat', 'debt-9')] } };
    });
    renderGame(<Play />, services);
    fireEvent.click(await screen.findByRole('tab', { name: 'Property' }));
    const owned = panel('Your properties');
    // The flat can be taken off the market; the parking space cannot.
    expect(within(owned).getAllByRole('button', { name: 'Stop renting it out' })).toHaveLength(1);
    expect(within(owned).getAllByRole('button', { name: /^Sell for/ }).length).toBeGreaterThanOrEqual(2);

    // What is let says what a year of it brings, the engine's own figure; the home lived in says nothing of rent.
    const rents = ['property-8', 'property-9'].map((id) => quoteOwnedProperty(content, owning(), id)?.rentAnnual ?? 0);
    expect(rents.every((rent) => rent > 0)).toBe(true);
    expect(within(owned).getAllByText(/^Rent \+/).map((line) => line.textContent)).toEqual(rents.map((rent) => `Rent +${fmt.money(rent)}/yr`));

    // A mortgage is named for the home it is on.
    fireEvent.click(screen.getByRole('tab', { name: 'Debt' }));
    expect(within(screen.getByRole('tabpanel', { name: 'Debt' })).getByText('Fixed mortgage · Apartment in the Marina, Dubai')).toBeTruthy();
  });
});

describe('a property the player owns', () => {
  it('opens on a tap: what it is worth, what it would bring, what is owed and what a sale would leave', async () => {
    // The heir starts with a flat in Dubai, lived in and owned outright.
    const { services } = await inFinance('heir');
    const flat = (await stateOf(services)).player.properties[0];
    renderGame(<Play />, services);
    fireEvent.click(await screen.findByRole('tab', { name: 'Property' }));
    fireEvent.click(within(panel('Your properties')).getByRole('button', { name: /^Apartment in the Marina/ }));

    const sheet = sheetTitled('Apartment in the Marina');
    expect(within(sheet).getByText('You live here')).toBeTruthy();
    expect(within(sheet).getByText('Worth today')).toBeTruthy();
    expect(within(sheet).getAllByText(fmt.money(flat.value)).length).toBeGreaterThanOrEqual(2);
    expect(within(sheet).getByText('Let, it would bring a year')).toBeTruthy();
    expect(within(sheet).getByText('It is all yours: nothing is owed on it.')).toBeTruthy();
    expect(within(sheet).getByText('A sale would leave you')).toBeTruthy();

    // Looking changes nothing: no order was made.
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Apartment in the Marina' })).toBeNull());
    expect(button('No orders')).toBeTruthy();
  });
});

describe('a holding in the portfolio', () => {
  it('opens the same sheet as the market, to buy more of it once or every round', async () => {
    const { services, session } = await inFinance('heir', { taught: true });
    await session.playRound({ orders: [{ type: 'buy', assetId: 'sp500', amount: 1_000_000 }] });
    await toFinance(session);
    renderGame(<Play />, services);
    const holdings = await screen.findByLabelText('Your investments');
    fireEvent.click(within(holdings).getByRole('button', { name: /S&P 500/ }));
    const sheet = sheetTitled('Buy S&P 500');
    expect(within(sheet).getByRole('radio', { name: /Every round/ })).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: '100%' }));
    fireEvent.click(within(sheet).getByRole('button', { name: /^Confirm/ }));
    expect(button('1 order')).toBeTruthy();
    // Bought, its mark jumps once; it did not before.
    const mark = within(screen.getByLabelText('Your investments')).getByRole('button', { name: /S&P 500/ }).querySelector('[data-mark="buy"]');
    expect(mark).not.toBeNull();
  });
});

describe('a plan in the market', () => {
  it('is shown on the asset it buys, beside what the asset pays', async () => {
    const { services, session } = await inFinance('heir', { taught: true });
    await session.playRound({ orders: [{ type: 'setPlan', assetId: 'msci_world', amount: 50_000 }] });
    await toFinance(session);
    renderGame(<Play />, services);
    fireEvent.click(await screen.findByRole('tab', { name: 'Market' }));
    const row = screen.getByRole('button', { name: /MSCI World/ });
    expect(within(row).getByText(/Plan: \$500 a round/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /S&P 500/ }).textContent).not.toMatch(/Plan:/);
  });
});

describe('the market without Finance', () => {
  it('offers funds, bonds and shares from the first day, and does not show what needs more', async () => {
    const { services } = await inFinance('nurse');
    renderGame(<Play />, services);
    fireEvent.click(await screen.findByRole('tab', { name: 'Market' }));
    const market = screen.getByRole('tabpanel', { name: 'Market' });
    for (const name of ['S&P 500', 'Apple', 'Bund']) expect(within(market).getByText(new RegExp(name)), name).toBeTruthy();
    for (const name of ['Bitcoin', 'Gold']) expect(within(market).queryByText(name), name).toBeNull();
    expect(within(market).queryByText(/^Finance \d/)).toBeNull();
  });
});

describe('switching a mortgage', () => {
  it('is offered under a mortgage, told in full in its own sheet, ordered for its fee, and can be left as it is', async () => {
    const { services, session } = await mortgaged();
    // With the cash for the fee: the studio's down payment took nearly all there was.
    const view = changed(services, session, (now) => ({ ...now, player: { ...now.player, cash: now.player.cash + 1_000_000 } }))();
    const mortgage = view.player.debts.find((debt) => debt.kind === 'mortgageFixed');
    expect(mortgage).toBeDefined();
    const offer = mortgageSwitch(view.player, mortgage!.id, content, view.timeline[view.round], view.round);
    expect(offer).toMatchObject({ to: 'variable', lock: null });
    renderGame(<Play />, services);
    fireEvent.click(await screen.findByRole('tab', { name: 'Debt' }));
    const debt = () => screen.getByRole('tabpanel', { name: 'Debt' });
    // Named for the home it is on.
    expect(within(debt()).getByText(`Fixed mortgage · ${homeName(text, 'studio', 'dubai')}, Dubai`)).toBeTruthy();

    // Said under it, opened in a sheet: what it means, the rate and a year's interest before and after, the fee, how long it then rests.
    fireEvent.click(within(debt()).getByRole('button', { name: 'Switch to variable' }));
    const sheet = sheetTitled('Switch to a variable rate');
    expect(within(sheet).getByText('Your rate follows the central bank: it falls when rates fall, and rises when they rise.')).toBeTruthy();
    const rows = sheet.textContent ?? '';
    expect(rows).toContain(`Rate${fmt.rate(offer!.rateNowBp)} → ${fmt.rate(offer!.rateAfterBp)}`);
    expect(rows).toContain(`Fee (${content.debt.switchFeePct.toVariable}% of what you owe)${fmt.money(offer!.fee)}`);
    expect(within(sheet).getByText(`It cannot be switched again for ${content.debt.switchRestRounds} rounds.`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '1 order' })).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: `Switch it for ${fmt.money(offer!.fee)}` }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Switch to a variable rate' })).toBeNull());
    expect(button('1 order')).toBeTruthy();

    // Ordered: the line under it says so, in teal, and opens the sheet again to leave it as it is.
    const ordered = within(debt()).getByRole('button', { name: /Going variable this round/ });
    expect(ordered.textContent).toBe('✓ Going variable this round');
    fireEvent.click(ordered);
    fireEvent.click(within(sheetTitled('Switch to a variable rate')).getByRole('button', { name: 'Leave it as it is' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Switch to a variable rate' })).toBeNull());
    expect(button('No orders')).toBeTruthy();
    expect(within(debt()).getByRole('button', { name: 'Switch to variable' })).toBeTruthy();
  });

  it('is not offered while the mortgage rests from its last switch, and says so in its sheet when there is not the cash for the fee', async () => {
    const { services, session } = await mortgaged();
    const at = session.view().round;
    const id = session.view().player.debts.find((debt) => debt.kind === 'mortgageFixed')!.id;
    // Switched this very round: it rests.
    changed(services, session, (view) => ({ ...view, player: { ...view.player, debts: view.player.debts.map((debt) => (debt.id === id ? { ...debt, switchedAt: at } : debt)) } }));
    renderGame(<Play />, services);
    fireEvent.click(await screen.findByRole('tab', { name: 'Debt' }));
    expect(within(screen.getByRole('tabpanel', { name: 'Debt' })).getByText(/^Fixed mortgage · /)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Switch to / })).toBeNull();
    cleanup();

    // No cash for the fee (the studio's down payment took nearly all there was): the sheet says why, and there is nothing to press.
    services.sessions.resume = async () => ({ lost: null, session });
    expect(mortgageSwitch(session.view().player, id, content, session.view().timeline[at], at)?.lock).toBe('not-enough-cash');
    renderGame(<Play />, services);
    fireEvent.click(await screen.findByRole('tab', { name: 'Debt' }));
    fireEvent.click(within(screen.getByRole('tabpanel', { name: 'Debt' })).getByRole('button', { name: 'Switch to variable' }));
    const sheet = sheetTitled('Switch to a variable rate');
    expect(within(sheet).getByText('You do not have enough cash.')).toBeTruthy();
    expect(within(sheet).queryByRole('button', { name: /^Switch it for/ })).toBeNull();
  });
});

/**
 * Of some elements, the one whose words are these. (A Russian line is set in runs by font, its spaces in one of their own: a screen reader on the phone
 * reads the line whole, but the name jsdom works out of it runs the words together, so a Russian button or heading is found by its words.)
 */
function worded(elements: HTMLElement[], words: string): HTMLElement {
  const found = elements.filter((element) => element.textContent === words);
  expect(found.map((element) => element.textContent)).toEqual([words]);
  return found[0];
}

/** The lines of text in `container` whose words match: each the whole text (a Russian one is set a word to a run), the element that is cut short if it is. */
const linesOf = (container: HTMLElement, words: RegExp): HTMLElement[] => [...container.querySelectorAll<HTMLElement>('[dir="auto"]')].filter((line) => words.test(line.textContent ?? ''));

/** Whether a text is cut to a line or a few with an ellipsis (`numberOfLines`), by the element that holds it or any up to `top`. */
function cutShort(text: HTMLElement, top: HTMLElement): boolean {
  for (let at: HTMLElement | null = text; at && at !== top.parentElement; at = at.parentElement) if (/r-textOverflow-|r-WebkitLineClamp/.test(at.className)) return true;
  return false;
}

describe('the market and the debts in Russian, their structure (what wraps and what is cut; widths are the batch pass\'s)', () => {
  it('wrap the long choices of the sheet that buys, each a share of its row and never cut short', async () => {
    const { services } = await seasoned('civil_servant');
    renderGame(<Play />, services, 'ru');
    fireEvent.click(await screen.findByRole('tab', { name: ru.finance.tabs.market }));
    fireEvent.click(screen.getByRole('button', { name: /S&P 500/ }));
    const sheet = worded(screen.getAllByRole('heading'), 'Купить: S&P 500').closest('[aria-modal="true"]') as HTMLElement;
    const radios = within(sheet).getAllByRole('radio');
    // How to buy, and the broker's loan: six choices, the longest of them «Каждый раунд», «Автоматически» and «Без займа».
    expect(radios.map((radio) => radio.textContent)).toEqual([
      `${ru.finance.plans.once}${ru.finance.plans.onceHint}`,
      `${ru.finance.plans.each}${ru.finance.plans.eachHint}`,
      ru.finance.plans.gearNone,
      '×1,25',
      '×1,5',
      '×2',
    ]);
    for (const radio of radios) {
      expect(radio.style.minWidth, radio.textContent ?? '').toBe('0px');
      for (const words of within(radio).getAllByText(/./)) expect(cutShort(words, radio), words.textContent ?? '').toBe(false);
    }
    // What the loan is, under them, wraps as well.
    const about = linesOf(within(sheet).getByRole('region', { name: ru.finance.plans.marginTitle }), /^Брокер одалживает/);
    expect(about).toHaveLength(1);
    expect(cutShort(about[0], sheet)).toBe(false);
  });

  it('wrap what a debt costs, its term and the way to switch it, under its name; the name is cut to its line, as the web cuts it', async () => {
    const { services } = await mortgaged();
    renderGame(<Play />, services, 'ru');
    fireEvent.click(await screen.findByRole('tab', { name: ru.finance.tabs.debt }));
    const debt = screen.getByRole('tabpanel', { name: ru.finance.tabs.debt });
    const link = worded(within(debt).getAllByRole('button'), ru.finance.debt.switchToVariable);
    const repay = within(debt).getAllByRole('button', { name: ru.finance.debt.repay });
    expect(repay.length).toBeGreaterThanOrEqual(1);
    for (const pressed of [link, ...repay]) for (const words of within(pressed).getAllByText(/./)) expect(cutShort(words, pressed), words.textContent ?? '').toBe(false);
    const terms = linesOf(debt, /в год · Ещё/);
    expect(terms).toHaveLength(1);
    for (const words of terms) expect(cutShort(words, debt), words.textContent ?? '').toBe(false);
    // The column under the name shrinks to what is left beside the button, so its words wrap there; and wrapped, every line of them is underlined
    // (the kit's LinkText, which draws a line under each line the phone lays out: until it has, one).
    expect((link.parentElement as HTMLElement).style.minWidth).toBe('0px');
    expect(link.querySelectorAll('[data-testid="underline"]')).toHaveLength(1);
    // The name is the web's `truncate`: one line, cut.
    const name = linesOf(debt, /^Фиксированная ипотека · /);
    expect(name).toHaveLength(1);
    expect(cutShort(name[0], debt)).toBe(true);
  });
});

/** A colour of the palette as the page writes it. */
function rgb(hex: string): string {
  return `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
}

describe('what is drawn again', () => {
  it('does not draw the Hud again for a change of tab, nor the portfolio for the basket\'s own goings-on: its sheet, an order refused, a note gone', async () => {
    // The crypto kid's coin is a holding drawn with its brand's mark: counted each time the portfolio's list is drawn.
    const { services } = await inFinance('crypto_kid');
    const logo = 'logo.bitcoin';
    played(
      services,
      // Opened on another tab (the debts, which draw no holding): pressing the portfolio's is a change of tab.
      <FinanceOpened value={{ tab: 'debt' }}>
        <Play />
      </FinanceOpened>,
    );
    await screen.findByRole('tab', { name: 'Portfolio' });
    await settled();
    const hud = () => spriteRenders.get('icon.cash');
    expect(hud()).toBeGreaterThan(0);
    const before = hud();
    expect(screen.queryByLabelText('Your investments')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Portfolio' }));
    await settled();
    expect(screen.getByLabelText('Your investments')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Portfolio' }).getAttribute('aria-selected')).toBe('true');
    expect(hud()).toBe(before);

    const drawn = spriteRenders.get(logo);
    expect(drawn).toBeGreaterThan(0);
    // The basket opened and closed.
    fireEvent.click(button('No orders'));
    await settled();
    fireEvent.click(within(sheetTitled("This round's orders")).getByRole('button', { name: 'Close' }));
    await settled();
    // An order the round refuses (more of the coin than is held): the basket is as it was, and the screen says why.
    await settled(() => void probe.state!.addOrder({ type: 'sell', assetId: 'bitcoin', amount: 999_999_999_999 }));
    expect(screen.getByRole('alert')).toBeTruthy();
    await settled(() => probe.state!.clearRefusal());
    expect(spriteRenders.get(logo)).toBe(drawn);
    expect(hud()).toBe(before);
  });

  it('draws a holding again only for an order of its own: a purchase of another, or cash put in savings, leaves its line and its mark as they are, and no mark\'s picture is drawn again', async () => {
    // Two holdings drawn with their brands' marks: the crypto kid's coin, and a share of Apple bought a round before.
    const { services, session } = await inFinance('crypto_kid');
    await session.playRound({ orders: [{ type: 'buy', assetId: 'apple', amount: 50_000 }] });
    await toFinance(session);
    played(services);
    await screen.findByLabelText('Your investments');
    await settled();
    const drawn = () => ({ coin: spriteRenders.get('logo.bitcoin'), apple: spriteRenders.get('logo.apple') });
    const before = drawn();
    expect(before.coin).toBeGreaterThan(0);
    expect(before.apple).toBeGreaterThan(0);
    // Cash to savings: the cash and the glance change, neither holding; and what everything owned comes to is worked out once, for all who show it.
    quoted.count = 0;
    await settled(() => void probe.state!.addOrder({ type: 'depositIn', amount: 10_000 }));
    expect(probe.state!.orders).toHaveLength(1);
    expect(drawn()).toEqual(before);
    expect(quoted.count).toBe(1);
    // More Apple: its line changes and its mark jumps; the coin's line does not, and neither mark's picture is drawn again (the jump is its box's).
    const worth = () => within(screen.getByLabelText('Your investments')).getByRole('button', { name: /Apple/ }).textContent;
    const was = worth();
    await settled(() => void probe.state!.addOrder({ type: 'buy', assetId: 'apple', amount: 10_000 }));
    expect(probe.state!.orders).toHaveLength(2);
    expect(worth()).not.toBe(was);
    expect(screen.getByLabelText('Your investments').querySelector('[data-mark="buy"] [data-sprite="logo.apple"]')).not.toBeNull();
    expect(drawn()).toEqual(before);
  });
  it('draws no row of the market again for an order, and no mark\'s picture at all (the mark of the asset bought answers in its box); and a change to the debt tab does not draw the Hud again', async () => {
    // Two rounds in: each row says what its asset did this round, the one thing on the screen that writes a change of price (`fmt.change`).
    const { services } = await inFinance('heir', { taught: true });
    const formats: { fmt: ReturnType<typeof useWords>['fmt'] | null } = { fmt: null };
    function Formats() {
      formats.fmt = useWords().fmt;
      return null;
    }
    played(
      services,
      <>
        <Play />
        <Formats />
      </>,
    );
    fireEvent.click(await screen.findByRole('tab', { name: 'Market' }));
    await settled();
    const market = () => screen.getByRole('tabpanel', { name: 'Market' });
    // Two shares drawn with their brands' marks: counted each time the row that holds them is drawn.
    const logos = () => ({ apple: spriteRenders.get('logo.apple'), microsoft: spriteRenders.get('logo.microsoft') });
    const before = logos();
    expect(before.apple).toBeGreaterThan(0);
    expect(before.microsoft).toBeGreaterThan(0);
    expect(market().querySelector('[data-mark]')).toBeNull();
    // The chart of a price is drawn only in the sheet that buys, while it is open: the market draws none.
    expect(screen.queryByRole('img', { name: 'Price history' })).toBeNull();
    const rows = vi.spyOn(formats.fmt!, 'change');
    // Apple bought: its own mark jumps (its box, not its picture), and no row is drawn again, Apple's included; no logo either.
    await settled(() => void probe.state!.addOrder({ type: 'buy', assetId: 'apple', amount: 10_000 }));
    expect(probe.state!.orders).toHaveLength(1);
    expect(market().querySelector('[data-mark="buy"] [data-sprite="logo.apple"]')).not.toBeNull();
    expect(rows).not.toHaveBeenCalled();
    expect(logos()).toEqual(before);
    // Cash to savings: no row of the market changes.
    await settled(() => void probe.state!.addOrder({ type: 'depositIn', amount: 10_000 }));
    expect(probe.state!.orders).toHaveLength(2);
    expect(rows).not.toHaveBeenCalled();
    expect(logos()).toEqual(before);
    rows.mockRestore();

    // The debt tab: the panel changes, the Hud above it does not.
    const hud = () => spriteRenders.get('icon.cash');
    const drawn = hud();
    expect(drawn).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('tab', { name: 'Debt' }));
    await settled();
    expect(screen.getByRole('tabpanel', { name: 'Debt' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Debt' }).getAttribute('aria-selected')).toBe('true');
    expect(hud()).toBe(drawn);
  });
});
