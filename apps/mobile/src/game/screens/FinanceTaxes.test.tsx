// @vitest-environment jsdom
import { content } from '@ratrace/content';
import type { RoundActions, RoundState } from '@ratrace/core/game/store';
import { formatFor } from '@ratrace/core/lib/format';
import type { GameSession, SavedGame } from '@ratrace/core/session/types';
import { indexed, previewRound } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';
import { settled } from '../../testing/renders';
import { useGame } from '../context';
import { Play } from './Play';

/*
 * The taxes of the finances (the web's Finance.test.tsx: what is not declared, and the tax residency of Bangkok), and the round's figures the tab
 * lays out, on the phone; and that what is hidden is ordered once for a double tap.
 */

afterEach(cleanup);

const fmt = formatFor('en');
const button = (name: string | RegExp) => screen.getByRole('button', { name });
/** A sheet by its title: the window that holds it. */
const sheetTitled = (title: string) => screen.getByRole('heading', { name: title }).closest('[aria-modal="true"]') as HTMLElement;
/** A panel by the name it is given: the web's `section`, named. */
const panel = (name: string) => screen.getByLabelText(name);

/** A life taken to the finances of its current round, without the screen. */
async function inFinance(lifeId: string) {
  const services = memoryServices();
  // The crypto kid and the rider are lives a player has to unlock before choosing them.
  await services.store.saveProfile({ ...(await services.store.loadProfile()), unlocked: { crypto_kid: { at: 1, gameId: 'earlier' }, rider: { at: 1, gameId: 'earlier' } } });
  const session = await services.sessions.start(lifeId);
  await toFinance(session);
  return { services, session };
}
async function toFinance(session: GameSession) {
  while (session.view().phase === 'cards') await session.answerCard(0);
}
const stateOf = async (services: ReturnType<typeof memoryServices>) => ((await services.store.loadGame()) as SavedGame).state;

const probe: { state: (RoundState & RoundActions) | null } = { state: null };
function Probe() {
  probe.state = useGame((s) => s);
  return null;
}

/** Play, on the Taxes tab of the finances. */
async function onTaxes(services: ReturnType<typeof memoryServices>) {
  renderGame(
    <>
      <Play />
      <Probe />
    </>,
    services,
  );
  fireEvent.click(await screen.findByRole('tab', { name: 'Taxes' }));
  return screen.getByRole('tabpanel', { name: 'Taxes' });
}
/** The names of the round's orders, as the basket lists them. */
function basket(): string[] {
  const count = probe.state?.orders.length ?? 0;
  fireEvent.click(button(count === 0 ? 'No orders' : count === 1 ? '1 order' : `${count} orders`));
  const names = within(sheetTitled("This round's orders"))
    .queryAllByRole('button', { name: /^Remove: / })
    .map((b) => (b.getAttribute('aria-label') ?? '').replace('Remove: ', ''));
  fireEvent.click(within(sheetTitled("This round's orders")).getByRole('button', { name: 'Close' }));
  return names;
}

describe('the taxes tab', () => {
  it('lays out the round as it will resolve: the tax of its two years, the cash now and after it, and the escape test', async () => {
    const { services, session } = await inFinance('nurse');
    // A round on: what the rise in prices took from the cash left idle is told too.
    await session.playRound({ orders: [] });
    await toFinance(session);
    const state = await stateOf(services);
    const preview = previewRound(content, state, { orders: [] });
    const tab = await onTaxes(services);

    // (The tax's panel and the escape test's are titled, not named, as the web's are: read in the tab.)
    expect(within(tab).getByText(`Tax over ${content.yearsPerRound} years`.toUpperCase())).toBeTruthy();
    const tax = tab;
    expect(within(tax).getByText('Income tax')).toBeTruthy();
    expect(within(tax).getByText(fmt.signed(-preview.tax.income))).toBeTruthy();
    expect(within(tax).getByText('Tax on investments')).toBeTruthy();
    expect(within(tax).getByText('Property tax')).toBeTruthy();
    const now = state.timeline[state.round];
    const before = state.timeline[state.round - 1];
    const eatenPct = Math.max(0, 1 - before.priceLevel / now.priceLevel);
    const eaten = Math.round(state.player.cash * eatenPct);
    if (eaten > 0) {
      expect(within(tax).getByText('Inflation on your cash')).toBeTruthy();
      expect(within(tax).getByText(fmt.signed(-eaten))).toBeTruthy();
    }

    expect(within(tab).getByText('Cash now')).toBeTruthy();
    expect(within(tab).getByText('Cash after the round')).toBeTruthy();
    expect(within(tab).getByText(fmt.money(preview.cashAfter))).toBeTruthy();
    expect(within(tab).getByText("These are this round's exact figures, not an estimate. Prices move after you play.")).toBeTruthy();
    expect(within(tab).getByRole('progressbar', { name: 'Escape test' })).toBeTruthy();
    expect(within(tab).getByText(fmt.money(preview.escape.outgoings))).toBeTruthy();
    // Nothing of a residency in a city that offers none.
    expect(screen.queryByLabelText(/^Tax residency in/)).toBeNull();
  });
});

describe('what is not declared', () => {
  const openTaxes = async (lifeId: string) => {
    const { services, session } = await inFinance(lifeId);
    await onTaxes(services);
    return { services, session, panel: panel('What you do not declare') };
  };

  it('takes pay under the table by order: the income tax falls by what is saved, and suspicion rises with it', async () => {
    const { services, panel: hidden } = await openTaxes('nurse');
    const state = await stateOf(services);
    const honest = previewRound(content, state, { orders: [] });
    const black = previewRound(content, state, { orders: [{ type: 'setEvasion', blackPct: 25 }] });
    expect(within(hidden).getByText(/^Chance of an inspection when the round is played: 0%/)).toBeTruthy();
    const quarter = within(hidden).getByRole('radio', { name: /^25%/ });
    // A double tap on the share: one order.
    act(() => {
      fireEvent.click(quarter);
      fireEvent.click(quarter);
    });
    await settled();
    expect(probe.state!.orders).toEqual([{ type: 'setEvasion', blackPct: 25 }]);
    const after = panel('What you do not declare');
    expect(within(after).getByText(`This round you save ${fmt.money(black.evaded.black)}.`)).toBeTruthy();
    expect(screen.getByText(fmt.signed(-black.tax.income))).toBeTruthy();
    expect(black.tax.income).toBeLessThan(honest.tax.income);
    // A quarter of the pay is a few points of suspicion a round; the city's tax office makes the chance of an inspection of them.
    const points = Math.floor((25 * content.evasion.blackSuspicionPer100) / 100);
    expect(within(after).getByText(`Chance of an inspection when the round is played: ${Math.round((points * (content.cities.find((city) => city.id === state.player.cityId)?.taxOfficePct ?? 100)) / 100)}%`)).toBeTruthy();
    expect(basket()).toEqual(['Pay under the table: 25%']);
    // Choosing nothing again takes the order back.
    fireEvent.click(within(panel('What you do not declare')).getByRole('radio', { name: /^None/ }));
    await settled();
    expect(probe.state!.orders).toEqual([]);
  });

  it('says what it risks: how hard the city looks, how long it can be claimed, and the adviser\'s word in one line', async () => {
    const { panel: hidden } = await openTaxes('nurse');
    const risk = within(hidden).getByRole('region', { name: 'The risk' });
    expect(within(risk).getByRole('progressbar', { name: "The tax office's suspicion" })).toBeTruthy();
    expect(within(risk).getByText(/^The tax office here /)).toBeTruthy();
    expect(within(risk).getByText(/^What is hidden can be claimed for /)).toBeTruthy();
    // Who speaks and what they say, one paragraph: nothing hidden, nothing to worry about.
    expect(risk.textContent).toContain('YOUR ADVISER: "All in order. Frankly, a bit boring."');
    // What it is about is kept behind "What is this?" until it is wanted.
    fireEvent.click(within(hidden).getByRole('button', { name: 'What is this?' }));
    expect(within(panel('What you do not declare')).getByText(/^Paying the tax office less saves money now/)).toBeTruthy();
  });

  it('offers an offshore company only to someone who knows money well', async () => {
    const { panel: hidden } = await openTaxes('nurse');
    expect(within(hidden).queryByRole('switch', { name: /^Offshore company/ })).toBeNull();
  });

  it('offers an offshore company only where investments are taxed', async () => {
    // The same lives, having learnt to run one.
    const skilled = async (lifeId: string) => {
      const { services, session } = await inFinance(lifeId);
      const view = (): GameView => ({ ...session.view(), player: { ...session.view().player, life: { ...session.view().player.life, financeSkill: 3 } } });
      const investor: GameSession = { gameId: session.gameId, lifeId: session.lifeId, view, history: () => session.history(), bankruptcies: () => 0, story: () => [], badges: () => [], answerCard: (option) => session.answerCard(option), playRound: (choices) => session.playRound(choices) };
      services.sessions.resume = async () => ({ lost: null, session: investor });
      await onTaxes(services);
      const offered = within(panel('What you do not declare')).queryByRole('switch', { name: /^Offshore company/ }) !== null;
      cleanup();
      return offered;
    };
    // Madrid taxes gains, dividends and rent; Singapore taxes none of them, and rent only with the salary.
    expect(await skilled('nurse')).toBe(true);
    expect(await skilled('crypto_kid')).toBe(false);
  });

  it('offers to hide crypto gains only where gains are taxed', async () => {
    // The crypto kid begins where a gain pays nothing: there is nothing to hide.
    const { panel: hidden } = await openTaxes('crypto_kid');
    expect(within(hidden).queryByRole('switch', { name: /^Hide crypto gains/ })).toBeNull();
  });

  it('hides crypto gains by order, and says nothing is saved in a round with nothing sold', async () => {
    const { panel: hidden } = await openTaxes('nurse');
    fireEvent.click(within(hidden).getByRole('switch', { name: /^Hide crypto gains/ }));
    await settled();
    expect(within(panel('What you do not declare')).getByRole('switch', { name: /^Hide crypto gains/ }).textContent).toContain('This round you save nothing.');
    // On the switch, and among the round's orders.
    expect(basket()).toEqual(['Hide crypto gains']);
  });
});

describe('the tax residency of Bangkok', () => {
  it('says what it is for, the rate it changes, and what it would come to for the player this year', async () => {
    const { services } = await inFinance('rider');
    await onTaxes(services);
    const residency = panel('Tax residency in Bangkok');
    expect(within(residency).getByText(/Your dividends and interest are taxed at 0(\.0)?% instead of the usual/)).toBeTruthy();
    // A rider with nothing invested would pay the fee for nothing: it says so, and when it pays off.
    expect(within(residency).getByText(/it would cost you .* a year more than it saves/)).toBeTruthy();
    expect(within(residency).getByText(/Thailand taxes what is earned abroad only when the money is brought into the country/)).toBeTruthy();
  });

  it('is taken by order, at its fee, and given up again by the same switch', async () => {
    const { services } = await inFinance('rider');
    const state = await stateOf(services);
    const city = content.cities.find((one) => one.id === state.player.cityId);
    if (!city?.residency) throw new Error('Bangkok offers a tax residency');
    await onTaxes(services);
    const residency = () => panel('Tax residency in Bangkok');
    expect(within(residency()).getByRole('switch', { name: /^Take the tax residency/ }).textContent).toContain(`It costs ${fmt.money(indexed(city.residency.feeAnnual, state.timeline[state.round]))} a year`);
    fireEvent.click(within(residency()).getByRole('switch', { name: /^Take the tax residency/ }));
    await settled();
    expect(probe.state!.orders).toEqual([{ type: 'setResidency', on: true }]);
    expect(within(residency()).getByRole('switch', { name: /^Take the tax residency/ }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(residency()).getByRole('switch', { name: /^Take the tax residency/ }));
    await settled();
    expect(probe.state!.orders).toEqual([]);
    await waitFor(() => expect(within(residency()).getByRole('switch', { name: /^Take the tax residency/ }).getAttribute('aria-checked')).toBe('false'));
  });
});
