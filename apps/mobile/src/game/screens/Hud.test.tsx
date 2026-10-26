// @vitest-environment jsdom
import { content } from '@ratrace/content';
import { formatFor } from '@ratrace/core/lib/format';
import { cashflow, taxAnnual } from '@ratrace/engine';
import { messagesFor } from '@ratrace/i18n';
import type { GameView } from '@ratrace/engine';
import type { GameSession } from '@ratrace/core/session/types';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameProvider, useGame } from '../context';
import { HudScene } from '../../testing/hudScene';
import { StickyScreen } from '../../ui/Sticky';
import { Hud, raysOf } from './Hud';
import { memoryServices, renderGame } from '../../testing/render';
import { speaking } from '../../testing/memoryServices';
import { Counted, settled } from '../../testing/renders';
import { COLORS } from '../../ui/theme';

const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
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

  it('say the flow as what a round leaves in cash: the lines, less tax, and the figure on the HUD that same year, short', async () => {
    const services = await open();
    const view = (await services.sessions.resume()).session!.view();
    const figure = screen.getByRole('button', { name: /Flow/ });
    fireEvent.click(figure);
    const lines = sheetTitled('Flow');
    // The year as the engine has it: what comes in, less what goes out, less tax (a nurse's salary is taxed).
    const whole = cashflow(content, view);
    const tax = taxAnnual(content, view);
    expect(tax).toBeGreaterThan(0);
    const year = whole.salaryAnnual + whole.passiveAnnual - whole.expensesAnnual - tax;
    const fmt = formatFor('en');
    expect(within(lines).getByText('Tax')).toBeTruthy();
    expect(valueOf(lines, 'Tax')).toBe(fmt.signed(-tax));
    expect(valueOf(lines, 'Flow per year')).toBe(fmt.signed(year));
    // The lines of the sheet add up to it, each written to the dollar: the salary in, the living costs and the tax out.
    const dollars = (text: string) => (text.startsWith('−') || text.startsWith('-') ? -1 : 1) * Number(text.replace(/[^\d]/g, ''));
    const sum = ['Salary', 'Living costs', 'Tax'].reduce((total, label) => total + dollars(valueOf(lines, label)), 0);
    expect(Math.abs(sum - dollars(valueOf(lines, 'Flow per year')))).toBeLessThanOrEqual(2);
    // The figure on the HUD is that same year, in the HUD's short money, signed.
    expect(within(figure).getByText(fmt.compact(year).replace(/^(?=[^−])/, '+'))).toBeTruthy();
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

  it('tell, under the things, how long each status that runs out still counts, its last round in the warning colour', async () => {
    const fading = [
      { itemId: 'sea_yacht_charter', value: 0, roundsLeft: 2, paid: 0, age: 0 },
      { itemId: 'travel_weekend', value: 0, roundsLeft: 1, paid: 0, age: 0 },
    ];
    await open({ view: (view) => ({ ...view, player: { ...view.player, life: { ...view.player.life, items: fading } } }) });
    fireEvent.click(screen.getByRole('button', { name: /Status/ }));
    const parts = sheetTitled('Status');
    // The soonest first.
    expect(valueOf(parts, 'Ryanair weekend')).toBe('Last round');
    expect(valueOf(parts, 'Yacht charter week')).toBe('2 rounds left');
    expect(within(parts).getByText('Last round').closest('[style*="color"]')?.getAttribute('style')).toContain(rgb(COLORS['wine-300']));
    const order = [...parts.querySelectorAll('div')].map((el) => el.textContent).filter((t) => t === 'Ryanair weekend' || t === 'Yacht charter week');
    expect(order[0]).toBe('Ryanair weekend');
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

describe('the gold rays behind a portrait in a gold frame', () => {
  it('are the web\'s repeating conic gradient: eighteen gold-700 rays of ten degrees from the middle of the foot, the first straight up, turning clockwise', () => {
    const rays = raysOf(64, 64)
      .split(' M')
      .map((ray) => ray.replace(/^M/, ''));
    expect(rays).toHaveLength(18);
    const points = (ray: string) => [...ray.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);
    const angle = ([x, y]: readonly [number, number]) => ((Math.atan2(x - 32, 64 - y) * 180) / Math.PI + 360) % 360;
    for (const [i, ray] of rays.entries()) {
      const [centre, from, to] = points(ray);
      // From the middle of the foot (CSS `at 50% 100%`), out past the corners of the box.
      expect(centre).toEqual([32, 64]);
      expect(Math.hypot(from[0] - 32, from[1] - 64)).toBeGreaterThan(Math.hypot(32, 64));
      // Ray i covers 20i to 20i + 10 degrees from straight up, clockwise (CSS's conic angles); the other ten are the gold-900 behind.
      expect(angle(from)).toBeCloseTo(i * 20, 0);
      expect(angle(to)).toBeCloseTo(i * 20 + 10, 0);
      expect(ray.trim().endsWith('Z')).toBe(true);
    }
    // The first goes straight up: its first edge has the centre's x; and it turns to the right (clockwise on the screen).
    const [, first, next] = points(rays[0]);
    expect(first[0]).toBeCloseTo(32, 5);
    expect(first[1]).toBeLessThan(0);
    expect(next[0]).toBeGreaterThan(32);
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
  it('draws each part again only for what it shows: a card that moves the cash draws the figures again, and not the portrait\'s row', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    const lead: Renders = { count: 0 };
    const header: Renders = { count: 0 };
    let play: { leaveNews(): void; pick(option: number): Promise<void> } | null = null;
    let seen: () => GameView | null = () => null;
    function Hand() {
      const leaveNews = useGame((s) => s.leaveNews);
      const pick = useGame((s) => s.pick);
      const view = useGame((s) => s.view);
      seen = () => view;
      play = { leaveNews, pick };
      return null;
    }
    function Playing({ children }: { children: ReactNode }) {
      return useGame((s) => s.view !== null) ? children : null;
    }
    render(
      <GameProvider services={speaking(services, 'en')}>
        <Playing>
          <StickyScreen
            contentStyle={{ paddingTop: 0, gap: 8 }}
            lead={
              <Counted into={lead}>
                <Hud part="lead" />
              </Counted>
            }
            header={
              <Counted into={header}>
                <Hud part="header" />
              </Counted>
            }
          />
        </Playing>
        <Hand />
      </GameProvider>,
    );
    await screen.findByText('Age 22');
    await settled(() => play!.leaveNews());
    const before = { lead: lead.count, header: header.count, view: seen() };
    // The card answered (the nurse's first, a freelance gig, taken) changes the round on screen: the cash, and nothing the portrait's row draws.
    await settled(() => play!.pick(1));
    const after = seen();
    expect(after).not.toBe(before.view);
    expect(after?.player.cash).not.toBe(before.view?.player.cash);
    for (const same of [(v: GameView | null) => v?.player.statusPoints, (v: GameView | null) => v?.player.cityId, (v: GameView | null) => v?.player.life.career?.level, (v: GameView | null) => v?.player.life.jailRounds, (v: GameView | null) => v?.round]) {
      expect(same(after)).toBe(same(before.view));
    }
    expect(header.count).toBeGreaterThan(before.header);
    expect(lead.count).toBe(before.lead);
  });

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
describe('what sticks to the top of a round', () => {
  /** The block of the page that sticks to its top, where this element is in it (React Native Web draws a sticky row `position: sticky`). */
  const stuckIn = (el: HTMLElement) => {
    for (let up: HTMLElement | null = el; up; up = up.parentElement) if (getComputedStyle(up).position === 'sticky') return up;
    return null;
  };

  it('is the three figures alone: once the portrait has scrolled away nothing says whose life or which round it is, and the way out scrolls with the page', async () => {
    // The page is laid out as it is drawn (jsdom lays out nothing: every box is at 0, the lead too).
    vi.stubGlobal('ResizeObserver', LaidOut);
    await open();
    scrollPast();
    await settled();
    // Whose life and which round are told only by the portrait's row, which has scrolled away: no strip says them again.
    expect(screen.queryByText('Round 1 of 20')).toBeNull();
    expect(screen.getAllByText(/Age 22/)).toHaveLength(1);
    // The figures stick; the way out of the rat race, just under them, does not.
    for (const figure of [/Cash/, /Flow/, /Status/]) expect(stuckIn(screen.getByRole('button', { name: figure })), String(figure)).not.toBeNull();
    const wayOut = screen.getByRole('button', { name: /Rat race escape/ });
    expect(stuckIn(wayOut)).toBeNull();
    expect(stuckIn(screen.getByRole('button', { name: /Cash/ }))!.compareDocumentPosition(wayOut) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
