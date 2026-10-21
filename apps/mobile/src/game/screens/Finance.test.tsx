// @vitest-environment jsdom
import { content } from '@ratrace/content';
import { messagesFor } from '@ratrace/i18n';
import type { RoundActions, RoundState } from '@ratrace/core/game/store';
import { formatFor } from '@ratrace/core/lib/format';
import type { GameSession, SavedGame } from '@ratrace/core/session/types';
import { previewRound, quoteMargin, quotePlans, quotePortfolio, viewOf } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame, spriteRenders } from '../../testing/render';
import { settled } from '../../testing/renders';
import { COLORS } from '../../ui/theme';
import { useGame } from '../context';
import { FinanceOpened, GEARS, MarginGauge } from './Finance';
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

/** The round store as it stands, and its actions: what a sheet of a later task (the market's) would do with them. */
const probe: { state: (RoundState & RoundActions) | null } = { state: null };
function Probe() {
  probe.state = useGame((s) => s);
  return null;
}
/** The gauge of a broker's loan on the S&P 500, once the game is open in the finances (it is drawn in them only). */
function Gauge() {
  const ready = useGame((s) => s.view !== null && s.preview !== null);
  return ready ? (
    <div data-gauge-ready>
      <MarginGauge assetId="sp500" />
    </div>
  ) : null;
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
    // The ledger is Task 16's: the round is played, and what it did is in the life.
    await waitFor(async () => expect((await stateOf(services)).round).toBe(state.round + 1));
    const after = await stateOf(services);
    expect(after.player.reinvest).toBe(true);
    // Each holding cost what it cost, and what it paid on top.
    for (const paid of quote.dividends) expect(after.player.positions[paid.assetId].basis).toBe(state.player.positions[paid.assetId].basis + paid.amount);
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
  /** The same life with the skill for it, as years of investing would leave it. */
  const seasoned = async (lifeId: string, change: (view: GameView) => GameView = (view) => view) => {
    const { services, session } = await inFinance(lifeId);
    const skilled = (): GameView => change({ ...session.view(), player: { ...session.view().player, life: { ...session.view().player.life, financeSkill: 3 } } });
    const investor: GameSession = { gameId: session.gameId, lifeId: session.lifeId, view: skilled, history: () => session.history(), bankruptcies: () => 0, story: () => [], badges: () => [], answerCard: (option) => session.answerCard(option), playRound: (choices) => session.playRound(choices) };
    services.sessions.resume = async () => ({ lost: null, session: investor });
    return { services, view: skilled() };
  };

  it('names the order for what it is, and the holding says what is owed on it and how far it may fall (the market\'s sheet that buys it is Task 13\'s)', async () => {
    const { services, view } = await seasoned('civil_servant');
    expect(quoteMargin(content, view, 'sp500')).toMatchObject({ lock: null, canDouble: true });
    played(services);
    await screen.findByLabelText('Your investments');
    // Bought ×2 with $1,000 of the player's own, as the market's sheet orders it.
    await settled(() => void probe.state!.addOrder({ type: 'buy', assetId: 'sp500', amount: 100_000, margin: 100_000 }));
    fireEvent.click(button('1 order'));
    expect(within(sheetTitled("This round's orders")).getByRole('button', { name: 'Remove: Buy $2,000 of S&P 500 on margin (you put in $1,000)' })).toBeTruthy();
    fireEvent.click(within(sheetTitled("This round's orders")).getByRole('button', { name: 'Close' }));

    // The holding is twice what was put in, and says what is owed on it and how far it may fall.
    const holdings = screen.getByLabelText('Your investments');
    expect(within(holdings).getByText('$2,000')).toBeTruthy();
    const owed = within(holdings).getByText('You owe the broker $1,000 · sold if it falls 33.3%');
    expect((owed.parentElement as HTMLElement).style.color).toBe(rgb(COLORS['wine-300']));
  });

  it('shows how near a broker\'s loan is to the forced sale: a meter of the loan against the holding, wine as it nears', async () => {
    const { services } = await seasoned('civil_servant', (view) => ({
      ...view,
      player: { ...view.player, positions: { sp500: { value: 200_000, basis: 200_000 } }, debts: [...view.player.debts, { id: 'debt-m', kind: 'margin', principal: 100_000, fixedRateBp: 0, roundsLeft: 0, forAsset: 'sp500' }] },
    }));
    renderGame(<Gauge />, services);
    // The debt tab draws it, Task 13: here on its own.
    expect(await screen.findByText('On S&P 500, worth $2,000')).toBeTruthy();
    const meter = screen.getByRole('meter', { name: 'How near the forced sale' });
    expect(meter.getAttribute('aria-valuenow')).toBe('67');
    expect(screen.getByText('sold if it falls 33.3%')).toBeTruthy();
    // Two thirds of the way: gold, not yet wine.
    const fill = meter.firstElementChild as HTMLElement;
    expect(fill.style.width).toMatch(/^66\.6+7?%$/);
    expect(fill.style.backgroundColor).toBe(rgb(COLORS['gold-500']));
    // The gears a purchase may be geared by, as the market's sheet offers them (Task 13).
    expect(GEARS).toEqual([1, 1.25, 1.5, 2]);
  });

  it('draws no meter for a holding bought outright', async () => {
    const { services } = await seasoned('civil_servant');
    const { container } = renderGame(<Gauge />, services);
    await waitFor(() => expect(container.querySelector('[data-gauge-ready]')).not.toBeNull());
    expect(container.textContent).toBe('');
  });
});

describe('investing every round', () => {
  const plansPanel = () => panel('Regular investing');

  it('says how to begin, and once a plan is ordered lists it as new, counts it in the round and buys it as the round is played', async () => {
    const { services } = await inFinance('civil_servant', { taught: true });
    played(services);
    // Nothing yet, and the panel says how to begin.
    await screen.findByLabelText('Regular investing');
    expect(within(plansPanel()).getByText(/^Nothing yet\. In the Market/)).toBeTruthy();

    // Set from the market's sheet (Task 13), as that sheet orders it.
    await settled(() => void probe.state!.setOrder((order) => order.type === 'setPlan' && order.assetId === 'sp500', { type: 'setPlan', assetId: 'sp500', amount: 100_000 }));
    const row = within(plansPanel()).getByRole('button', { name: /S&P 500/ });
    expect(row.textContent).toContain('$1,000');
    expect(row.textContent).toContain('New plan');
    expect(within(plansPanel()).getByText('Each round you invest $1,000 without lifting a finger.')).toBeTruthy();
    fireEvent.click(button('1 order'));
    expect(within(sheetTitled("This round's orders")).getByRole('button', { name: 'Remove: Invest $1,000 every round in S&P 500' })).toBeTruthy();
    fireEvent.click(within(sheetTitled("This round's orders")).getByRole('button', { name: 'Close' }));

    const before = await stateOf(services);
    fireEvent.click(button('Play the round'));
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
  it('stand on one panel a tab: the portfolio is the first, the one open, and the tabs not on the phone yet are not shown at all', async () => {
    const { services } = await inFinance('heir');
    renderGame(<Play />, services);
    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Portfolio']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tablist', { name: 'Your finances' })).toBeTruthy();
    expect(screen.getByRole('tabpanel', { name: 'Portfolio' })).toBeTruthy();
    // Its panels, top to bottom, as the web lays them: at a glance; cash, savings and the pension; the investments; what they pay (none yet); the plans.
    const order = ['At a glance', 'Cash', 'Your investments', 'Regular investing'].map((name) => (name === 'Cash' ? screen.getByText('Earns nothing') : panel(name)));
    for (let i = 1; i < order.length; i++) expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('opens, from a holding, the sheet that buys more of it (the market\'s, Task 13: its stand-in until then)', async () => {
    const { services, session } = await inFinance('heir', { taught: true });
    await session.playRound({ orders: [{ type: 'buy', assetId: 'sp500', amount: 1_000_000 }] });
    await toFinance(session);
    renderGame(<Play />, services);
    const holdings = await screen.findByLabelText('Your investments');
    fireEvent.click(within(holdings).getByRole('button', { name: /S&P 500/ }));
    expect(await screen.findByRole('heading', { name: 'Buy S&P 500' })).toBeTruthy();
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
      // Opened on a tab of a later task (not drawn): pressing the portfolio's is a change of tab.
      <FinanceOpened value={{ tab: 'market' }}>
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
});

