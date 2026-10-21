// @vitest-environment jsdom
import { messagesFor } from '@ratrace/i18n';
import type { GameView } from '@ratrace/engine';
import type { GameSession } from '@ratrace/core/session/types';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameProvider, useGame } from '../context';
import { HudScene } from '../../testing/hudScene';
import { memoryServices, renderGame } from '../../testing/render';
import { speaking } from '../../testing/memoryServices';
import { Counted, settled } from '../../testing/renders';
import type { Renders } from '../../testing/renders';

afterEach(cleanup);

/** A life begun on a device, and the Hud drawn over it as Play draws it: its lead, the figures that stick, and what hangs under them. */
async function open(options: { locale?: 'en' | 'es' | 'ru'; life?: string; onProfile?: () => void; view?: (view: GameView) => GameView } = {}) {
  const services = memoryServices();
  const real = await services.sessions.start(options.life ?? 'nurse');
  if (options.view) {
    // The game on the device, with its view changed as the test needs it (the web's Jail and Hud tests do the same).
    const change = options.view;
    const session: GameSession = { ...realSession(real), view: () => change(real.view()) };
    services.sessions.resume = async () => ({ lost: null, session });
  }
  renderGame(<HudScene onProfile={options.onProfile} />, services, options.locale ?? 'en');
  // The game is opened as the Hud is drawn: the portrait hangs once it is.
  await waitFor(() => expect(document.querySelector('[data-frame]')).toBeTruthy());
  return services;
}

/** A session that answers as the one on the device does. */
function realSession(real: GameSession): GameSession {
  return { gameId: real.gameId, lifeId: real.lifeId, view: () => real.view(), history: () => real.history(), bankruptcies: () => 0, story: () => [], badges: () => [], answerCard: (option) => real.answerCard(option), playRound: (choices) => real.playRound(choices) };
}

/** The sheet with this title. */
const sheetTitled = (title: string) => screen.getByRole('heading', { name: title }).closest('[aria-modal="true"]') as HTMLElement;

/**
 * The text that says `label` in `sheet`, whole: a Russian line is set in runs of its fonts (Exo 2 for its letters, Chakra Petch for a space), so
 * its words can be in several pieces. The innermost element that holds all of it.
 */
function textIn(sheet: HTMLElement, label: string): HTMLElement {
  const all = within(sheet).getAllByText((_, el) => el?.textContent === label);
  return all[all.length - 1];
}

/** The figure a Row of a sheet shows beside its label: the last text of the line the label is on. */
function valueOf(sheet: HTMLElement, label: string): string {
  // The line is the box that sets its two sides apart: the label (with a hint under it) on the left, the figure on the right.
  for (let up: HTMLElement | null = textIn(sheet, label); up && up !== sheet; up = up.parentElement) {
    if (up.style.justifyContent === 'space-between' && up.children.length === 2) return up.lastElementChild?.textContent ?? '';
  }
  throw new Error(`no line for ${label}`);
}

describe('the figures of the HUD', () => {
  it('open a sheet of what they mean and what they are made of, over a dimmed page', async () => {
    await open();
    const cash = screen.getByRole('button', { name: /Cash/ });
    expect(screen.queryByRole('heading', { name: 'Cash' })).toBeNull();

    fireEvent.click(cash);
    const about = sheetTitled('Cash');
    expect(about.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByTestId('sheet-backdrop')).toBeTruthy();
    // What it means is a tap away, so the figures come first.
    expect(within(about).queryByText(/The money you have on hand/)).toBeNull();
    fireEvent.click(within(about).getByRole('button', { name: 'What is this?' }));
    expect(within(about).getByText(/The money you have on hand/)).toBeTruthy();
    expect(within(about).queryByRole('button', { name: 'What is this?' })).toBeNull();
    expect(within(about).getByText('Net worth')).toBeTruthy();
    expect(within(about).getByText('Everything you own less everything you owe')).toBeTruthy();

    fireEvent.click(within(about).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Cash' })).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /Flow/ }));
    const lines = sheetTitled('Flow');
    expect(within(lines).getByText('Salary')).toBeTruthy();
    expect(within(lines).getByText('Living costs')).toBeTruthy();
    expect(within(lines).getByText('Flow per year')).toBeTruthy();
    // A nurse starts with no debt and nothing invested: lines that would only say zero are left out.
    expect(within(lines).queryByText('Debts')).toBeNull();
    expect(within(lines).queryByText('Rent')).toBeNull();
  });

  it('say the flow as what a round leaves in cash: after tax, as the figure itself says it', async () => {
    await open();
    const figure = screen.getByRole('button', { name: /Flow/ });
    fireEvent.click(figure);
    const lines = sheetTitled('Flow');
    // A nurse's salary is taxed: the tax is a line of its own, and the year's flow is what is left after it.
    expect(within(lines).getByText('Tax')).toBeTruthy();
    const perYear = valueOf(lines, 'Flow per year');
    expect(perYear.startsWith('+')).toBe(true);
    // The figure on the HUD is that same year, short.
    expect(figure.textContent?.startsWith('+')).toBe(true);
  });

  it('show status by source, adding up to the figure, in the language in use', async () => {
    for (const locale of ['es', 'ru'] as const) {
      const hud = messagesFor(locale).hud as unknown as Record<string, string>;
      await open({ locale });
      const status = screen.getByRole('button', { name: new RegExp(hud.status) });
      fireEvent.click(status);
      const parts = sheetTitled(hud.status);
      for (const key of ['statusJob', 'statusHome', 'statusCity', 'statusLifestyle', 'statusItems', 'statusNow', 'statusLived']) expect(textIn(parts, hud[key]), `${locale} ${key}`).toBeTruthy();
      const [job, home, city, lifestyle, things, now] = ['statusJob', 'statusHome', 'statusCity', 'statusLifestyle', 'statusItems', 'statusNow'].map((key) => Number(valueOf(parts, hud[key]).replace('+', '').replace(/\s/g, '')));
      expect(job + home + city + lifestyle + things, locale).toBe(now);
      expect(status.textContent, locale).toContain(String(now));
      cleanup();
    }
  });

  it('say what status is for: the score as it stands today, and how much of it is money and how much status', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: /Status/ }));
    const score = within(sheetTitled('Status')).getByRole('region', { name: 'Your score today' });
    const wealth = Number(within(score).getByText(/ for net worth$/).textContent?.split(' ')[0].replace(/,/g, ''));
    const status = Number(within(score).getByText(/ for status$/).textContent?.split(' ')[0].replace(/,/g, ''));
    // The two parts add up to the figure, which is the engine's own: nobody has got out of the rat race at twenty-two.
    expect(within(score).getByText(String(wealth + status))).toBeTruthy();
    expect(within(score).getByText(/^The score adds the points of your net worth to your average status\./)).toBeTruthy();
    // The bar is split the same way: the money gold, the status teal, in the share each has.
    const share = Math.round((status * 100) / Math.max(1, wealth + status));
    expect(score.querySelector(`[data-split="wealth"]`)?.getAttribute('style')).toContain(`width: ${100 - share}%`);
    expect(score.querySelector(`[data-split="status"]`)?.getAttribute('style')).toContain(`width: ${share}%`);
  });

  it('hang the portrait in the frame its status has earned', async () => {
    await open();
    // A nurse of twenty-two has the status of a job and a city, and a plain frame.
    const frame = document.querySelector('[data-frame]');
    expect(frame?.getAttribute('data-frame')).toBe('frame.plain');
    expect(frame?.querySelector('[data-sprite="frame.plain"]')).toBeTruthy();
    expect(frame?.querySelector('[data-sprite="portrait.nurse.22"]')).toBeTruthy();
    // Nothing stands behind a plain one.
    expect(frame?.querySelector('[data-backdrop]')).toBeNull();
  });

  it('put a backdrop behind a portrait that has earned a better frame: a colour, stage lights, then rays of gold', async () => {
    for (const [points, frame, backdrop] of [
      [30, 'frame.bronze', 'colour'],
      [70, 'frame.silver', 'lights'],
      [120, 'frame.gold', 'rays'],
    ] as const) {
      await open({ view: (view) => ({ ...view, player: { ...view.player, statusPoints: points } }) });
      const hung = document.querySelector('[data-frame]');
      expect(hung?.getAttribute('data-frame')).toBe(frame);
      expect(hung?.querySelector('[data-backdrop]')?.getAttribute('data-backdrop')).toBe(backdrop);
      cleanup();
    }
  });

  it('say how far passive income is from the year\'s outgoings, and open the way out from the bar', async () => {
    await open();
    const bar = screen.getByRole('button', { name: /Rat race escape/ });
    expect(within(bar).getByRole('progressbar', { name: 'Rat race escape' })).toBeTruthy();
    expect(bar.textContent).toMatch(/\$0 \/ \$[\d.]+K/);
    fireEvent.click(bar);
    const out = sheetTitled('Rat race escape');
    // The label is in capitals, as the web's `uppercase` draws it.
    expect(within(out).getByText('COVERED')).toBeTruthy();
    expect(within(out).getByText('0%')).toBeTruthy();
    expect(within(out).getByText('Still short a year')).toBeTruthy();
    expect(within(out).getByText(/^Getting out now would multiply your score by /)).toBeTruthy();
    // The rat runs in its wheel, dressed as the life is lived.
    expect(out.querySelector('[data-sprite^="anim.wheel"]')).toBeTruthy();
  });

  it('show the player\'s profile from the portrait, where the screen gives one', async () => {
    const onProfile = vi.fn();
    await open({ onProfile });
    fireEvent.click(screen.getByRole('button', { name: 'Open your profile' }));
    expect(onProfile).toHaveBeenCalledTimes(1);
  });
});

describe('what the HUD says of the life', () => {
  it('names who lives it, how old they are, which round and where, and the job', async () => {
    await open();
    expect(screen.getByText('Age 22')).toBeTruthy();
    expect(screen.getByText('Round 1 of 20 · Madrid')).toBeTruthy();
    expect(screen.getByText('Nurse')).toBeTruthy();
    // The city, on its banner, at the first light of the round's news.
    const banner = document.querySelector('[data-city-light]');
    expect(banner?.getAttribute('data-city-light')).toBe('day');
    expect(banner?.querySelector('[data-sprite="skyline.madrid.day"]')).toBeTruthy();
  });

  it('keeps the paper of the round to read again once the news are left, and the settings always', async () => {
    let leave: (() => void) | null = null;
    function Hand() {
      leave = useGame((s) => s.leaveNews);
      return null;
    }
    const services = memoryServices();
    await services.sessions.start('nurse');
    render(
      <GameProvider services={speaking(services, 'en')}>
        <HudScene />
        <Hand />
      </GameProvider>,
    );
    await screen.findByText('Age 22');
    expect(screen.queryByRole('button', { name: 'Read the paper again' })).toBeNull();
    await act(async () => leave!());
    // Out of the news the banner is dropped for the cards (the compact HUD), and the paper can be read again.
    const paper = await screen.findByRole('button', { name: 'Read the paper again' });
    expect(document.querySelector('[data-city-light]')).toBeNull();
    fireEvent.click(paper);
    expect(sheetTitled('The paper')).toBeTruthy();
    fireEvent.click(within(sheetTitled('The paper')).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'The paper' })).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(sheetTitled('Settings')).toBeTruthy();
  });

});

/** Scrolls the page far down: past the lead, whatever height it was laid out at (the phone's layout is not run here). */
function scrollPast() {
  const scroller = [...document.querySelectorAll<HTMLElement>('div')].find((el) => ['auto', 'scroll'].includes(getComputedStyle(el).overflowY));
  if (!scroller) throw new Error('no scroll');
  act(() => {
    scroller.scrollTop = 2_000;
    fireEvent.scroll(scroller, { target: { scrollTop: 2_000 } });
  });
}

describe('what the HUD is drawn again for', () => {
  it('is not drawn again by a change of the round it does not show: from a card\'s result to the next card, with the device read again', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    const renders: Renders = { count: 0 };
    let play: { leaveNews(): void; pick(option: number): Promise<void>; afterCard(): void } | null = null;
    function Hand() {
      const leaveNews = useGame((s) => s.leaveNews);
      const pick = useGame((s) => s.pick);
      const afterCard = useGame((s) => s.afterCard);
      play = { leaveNews, pick, afterCard };
      return null;
    }
    render(
      <GameProvider services={speaking(services, 'en')}>
        <Counted into={renders}>
          <HudScene />
        </Counted>
        <Hand />
      </GameProvider>,
    );
    await screen.findByText('Age 22');
    await settled(() => play!.leaveNews());
    // A card answered: what it did is drawn (the cash, the status).
    await settled(() => play!.pick(0));
    const before = renders.count;
    // From its result to the next card: the stage changes, the round on screen does not.
    await settled(() => play!.afterCard());
    expect(renders.count).toBe(before);
  });
});

/** A layout that answers at once, for every box it is asked about: what the phone does after drawing, and jsdom does not. */
class LaidOut {
  constructor(private readonly told: (entries: Array<{ target: Element }>) => void) {}
  observe(target: Element) {
    this.told([{ target }]);
  }
  unobserve() {}
  disconnect() {}
}

// Last: the layout it brings stays with the page's library for the rest of the file.
describe('the strip that sticks', () => {
  it('says whose life and which round it is in the strip that sticks, once the portrait has scrolled away', async () => {
    // The page is laid out as it is drawn (jsdom lays out nothing: every box is at 0, the lead too).
    vi.stubGlobal('ResizeObserver', LaidOut);
    await open();
    expect(screen.queryByText('Round 1 of 20')).toBeNull();
    scrollPast();
    expect(await screen.findByText('Round 1 of 20')).toBeTruthy();
    expect(screen.getAllByText(/Age 22/)).toHaveLength(2);
  });
});
