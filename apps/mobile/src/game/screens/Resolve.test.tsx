// @vitest-environment jsdom
import { textFor } from '@ratrace/content';
import type { Milestone } from '@ratrace/content';
import type { RoundActions, RoundState } from '@ratrace/core/game/store';
import { bankQuip } from '@ratrace/core/game/quips';
import { formatFor } from '@ratrace/core/lib/format';
import { messagesFor } from '@ratrace/i18n';
import { MemoryStore } from '@ratrace/core/session/memory';
import { newProfile } from '@ratrace/core/session/types';
import type { GameSession } from '@ratrace/core/session/types';
import { netWorth } from '@ratrace/engine';
import type { GameEvent, GameView } from '@ratrace/engine';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { heard, memoryServices, renderGame } from '../../testing/render';
import { Counted, settled } from '../../testing/renders';
import type { Renders } from '../../testing/renders';
import { rea } from '../../ui/testing/reanimated';
import { COLORS } from '../../ui/theme';

// Every line of the ledger is a box of its own (`role="row"`): what is counted each time one is drawn, by the line it says.
const rows = vi.hoisted(() => ({ drawn: [] as string[] }));
vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return {
    ...rn,
    View: (props: Record<string, unknown>) => {
      if (props.role === 'row') rows.drawn.push(String((props.dataSet as { line?: string } | undefined)?.line));
      return <rn.View {...props} />;
    },
  };
});

const { useGame, useGuide, useSettings } = await import('../context');
const { Play } = await import('./Play');
const { Resolve } = await import('./Resolve');

const { text } = textFor('en');
const en = messagesFor('en');
const fmt = formatFor('en');
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
/** Whether something is drawn on a ground of this colour. */
const onGround = (box: Element | undefined, colour: keyof typeof COLORS) => [...(box?.querySelectorAll<HTMLElement>('div') ?? [])].some((one) => one.style.backgroundColor === rgb(COLORS[colour]));

/** The lines money came in by on its own: where coins fly from when they paid (the web's `PASSIVE`). */
const PASSIVE = ['dividends', 'interest', 'rent', 'otherPassive', 'business'];

beforeEach(() => {
  rea.assigned.length = 0;
  rows.drawn.length = 0;
});
afterEach(() => {
  rea.restyle = true;
  cleanup();
});

/** The round store, read and driven from the test. */
const probe: { state: (RoundState & RoundActions) | null } = { state: null };
function Probe() {
  probe.state = useGame((s) => s);
  return null;
}

type Life = { events?: (events: GameEvent[]) => GameEvent[]; story?: Milestone[]; world?: (view: GameView) => void; still?: boolean };

/**
 * A nurse's life at the finances of its first round, with its cards answered, in which the round, whatever is played, ends with the events `events`
 * makes of the engine's; and whose world is as `world` leaves it. `still`: the player has asked for less motion.
 */
async function nurse({ events = (all) => all, story = [], world, still = false }: Life = {}) {
  const store = new MemoryStore();
  if (still) await store.saveProfile({ ...newProfile(), settings: { ...newProfile().settings, reducedMotion: true } });
  const services = memoryServices(store);
  const real = await services.sessions.start('nurse');
  while (real.view().phase === 'cards') await real.answerCard(0);
  const seen = (): GameView => {
    const view = structuredClone(real.view());
    world?.(view);
    return view;
  };
  const session: GameSession = {
    gameId: real.gameId,
    lifeId: real.lifeId,
    view: seen,
    history: () => real.history(),
    bankruptcies: () => 0,
    badges: () => [],
    story: () => story,
    answerCard: async (option) => ({ ...(await real.answerCard(option)), view: seen() }),
    playRound: async (choices) => {
      const result = await real.playRound(choices);
      return { ...result, view: seen(), events: events(result.events) };
    },
  };
  services.sessions.resume = async () => ({ lost: null, session });
  return services;
}

/** Plays the round of a life drawn in Play, and waits for its ledger. */
async function inPlay(life: Life = {}) {
  const services = await nurse(life);
  renderGame(
    <>
      <Play />
      <Probe />
    </>,
    services,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Play the round' }));
  await screen.findByRole('heading', { name: 'Two years later' });
  return services;
}

const ledger = () => screen.getByRole('table', { name: 'What came in and went out' });
const resolved = () => probe.state!.resolved!;
const linesOf = (events: GameEvent[]) => events.filter((e): e is Extract<GameEvent, { kind: 'ledger' }> => e.kind === 'ledger');
/** The row of the money there is now: its visible figure, and what a screen reader is told it comes to. */
const cashNow = () => {
  const counted = document.querySelector<HTMLElement>('[data-coin-to]') as HTMLElement;
  const parts = [...counted.children];
  return {
    shown: parts.filter((part) => part.getAttribute('aria-hidden') === 'true').map((part) => part.textContent).join(''),
    said: parts.filter((part) => part.getAttribute('aria-hidden') !== 'true').map((part) => part.textContent).join(''),
  };
};
/** The net worth where the round leaves it: the figure, and its change. */
const worth = () => document.querySelector<HTMLElement>('[data-worth]') as HTMLElement;
const coins = () => document.querySelectorAll('[data-testid="coin-layer"] > div');

describe('the ledger of a round', () => {
  it('says that two years went by, from which age to which, with the rat in its wheel', async () => {
    await inPlay();
    expect(screen.getByText('Age 22 to 24')).toBeTruthy();
    const title = screen.getByRole('heading', { name: 'Two years later' });
    expect(title.querySelector('[data-sprite^="anim.wheel"]')).not.toBeNull();
  });

  it('shows every line the round wrote, in the order it wrote them: the money in in teal, the money out in wine', async () => {
    await inPlay();
    const lines = linesOf(resolved().events);
    expect(lines.length).toBeGreaterThan(2);
    const drawn = within(ledger()).getAllByRole('row');
    expect(drawn.map((row) => row.getAttribute('data-line'))).toEqual(lines.map((line) => line.line));
    lines.forEach((line, i) => {
      expect(within(drawn[i]).getByText(text.ledger[line.line])).toBeTruthy();
      const amount = within(drawn[i]).getByText(fmt.signed(line.amount));
      expect(amount.closest('[style*="color"]')?.getAttribute('style')).toContain(rgb(COLORS[line.amount >= 0 ? 'teal-300' : 'wine-300']));
    });
  });

  it('rolls up one line after another: each waits 80 ms more than the one before it, and rises in 280', async () => {
    // A round of more lines than a nurse's first: a sale, a gift, a repair and a fine besides her pay and her costs.
    const more: GameEvent[] = [
      { kind: 'ledger', line: 'itemSales', amount: 20_000 },
      { kind: 'ledger', line: 'familyGift', amount: 50_000 },
      { kind: 'ledger', line: 'repairs', amount: -8_000 },
      { kind: 'ledger', line: 'taxAudit', amount: -12_000 },
    ];
    await inPlay({ events: (all) => [...all, ...more] });
    const lines = linesOf(resolved().events);
    expect(lines.length).toBeGreaterThan(5);
    // A rise is one run of its delay and its own 280 ms (the kit's `useRise`): the lines' are 280, 360, 440…
    const runs = rea.assigned.filter((one) => one.kind === 'timing' && one.to === 1).map((one) => one.duration);
    for (let i = 0; i < lines.length; i++) expect(runs, `line ${i + 1}`).toContain(i * 80 + 280);
    // The first is up once its own 280 ms have run, while the last still waits for its turn.
    const drawn = () => within(ledger()).getAllByRole('row').map((row) => (row.parentElement as HTMLElement).style.opacity);
    await waitFor(() => expect(drawn()[0]).toBe('1'));
    expect(drawn()[lines.length - 1]).toBe('0');
    await waitFor(() => expect(drawn().every((opacity) => opacity === '1')).toBe(true));
  });

  it('counts the cash up from what it was to what it is once the ledger has rolled, and says where it ends to a screen reader from the start', async () => {
    await inPlay();
    const was = fmt.money(resolved().before.player.cash);
    const is = fmt.money(probe.state!.view!.player.cash);
    expect(was).not.toBe(is);
    expect(cashNow().said).toBe(is);
    expect(cashNow().shown).toBe(was);
    await waitFor(() => expect(cashNow().shown).toBe(is), { timeout: 5_000 });
    expect(screen.getByText('Cash now')).toBeTruthy();
  });

  it('says where the net worth was, and counts it to where it is, with the change beside it once it lands', async () => {
    await inPlay();
    const before = netWorth(resolved().before.player);
    const after = netWorth(probe.state!.view!.player);
    expect(within(worth()).getByText(`Was ${fmt.money(before)}`)).toBeTruthy();
    expect(within(worth()).getByText('Net worth')).toBeTruthy();
    const change = within(worth()).getByText(fmt.signed(after - before));
    // Not there until it lands: its place is kept, unseen.
    const tag = () => (change.closest('[style*="opacity"]') as HTMLElement).style.opacity;
    expect(tag()).toBe('0');
    // A screen reader is told where it ends from the start; the figure counts there.
    expect(within(worth()).getAllByText(fmt.money(after))).toHaveLength(1);
    await waitFor(() => expect(within(worth()).getAllByText(fmt.money(after))).toHaveLength(2), { timeout: 6_000 });
    await waitFor(() => expect(tag()).toBe('1'));
  });

  it('stands where it ends at once for a player who asked for less motion: the cash, the net worth and its change, and no sparks', async () => {
    await inPlay({ still: true });
    const is = fmt.money(probe.state!.view!.player.cash);
    expect(cashNow().shown).toBe(is);
    const after = netWorth(probe.state!.view!.player);
    const before = netWorth(resolved().before.player);
    expect(within(worth()).getAllByText(fmt.money(after))).toHaveLength(2);
    expect((within(worth()).getByText(fmt.signed(after - before)).closest('[style*="opacity"]') as HTMLElement | null)?.style.opacity ?? '1').toBe('1');
    // Nothing that is only movement: no sparks over the figure, no coins.
    expect(worth().querySelector('[aria-hidden="true"] > div[style*="position: absolute"]')).toBeNull();
    await new Promise((done) => setTimeout(done, linesOf(resolved().events).length * 80 + 280 + 300));
    expect(coins()).toHaveLength(0);
  });
});

describe('the coins of a ledger', () => {
  it('fly from the lines that paid on their own to the cash now, once every line has risen, and are heard', async () => {
    await inPlay({ events: (all) => [...all.filter((e) => !(e.kind === 'ledger' && PASSIVE.includes(e.line))), { kind: 'ledger', line: 'dividends', amount: 50_000 }] });
    const lines = linesOf(resolved().events);
    const paid = within(ledger()).getAllByRole('row').filter((row) => row.querySelector('[data-coin-from]') !== null);
    expect(paid.map((row) => row.getAttribute('data-line'))).toEqual(['dividends']);
    expect(coins()).toHaveLength(0);
    // The ledger rolls for 80 ms a line and the last one's 280 to rise: then they take off, three from the one line.
    await waitFor(() => expect(coins().length).toBe(3), { timeout: lines.length * 80 + 280 + 2_000 });
    expect(heard).toContain('coin');
  });

  it('never fly from money that was earned or spent: a round with nothing paid on its own flies none', async () => {
    await inPlay({ events: (all) => all.filter((e) => !(e.kind === 'ledger' && PASSIVE.includes(e.line))) });
    const lines = linesOf(resolved().events);
    // The salary came in, and is not where coins fly from.
    expect(lines.some((line) => line.line === 'salary' && line.amount > 0)).toBe(true);
    expect(within(ledger()).queryAllByRole('row').filter((row) => row.querySelector('[data-coin-from]') !== null)).toHaveLength(0);
    await new Promise((done) => setTimeout(done, lines.length * 80 + 280 + 300));
    expect(coins()).toHaveLength(0);
    expect(heard).not.toContain('coin');
  });
});

describe('what the round brought besides the money', () => {
  it('shows a milestone of the life with its picture, on the round it happened in', async () => {
    await inPlay({ story: [{ round: 1, kind: 'home', typeId: 'studio' }] });
    const caption = screen.getByText('Your first home');
    const figure = caption.closest('[data-milestone]') as HTMLElement;
    expect(figure.getAttribute('data-milestone')).toBe('home');
    expect(figure.querySelector('[data-sprite="card.moment_home"]')).not.toBeNull();
  });

  it('shows none in a round without one', async () => {
    await inPlay();
    expect(document.querySelector('[data-milestone]')).toBeNull();
  });

  it('says when a crisis that was on is over', async () => {
    await inPlay({ world: (view) => void (view.round === 0 ? (view.timeline[0].crisis = { id: 'crash', year: 3, of: 3 }) : undefined) });
    const over = screen.getAllByRole('status').find((note) => note.textContent?.includes('The Great Crash is over.'));
    expect(over?.textContent).toContain('What fell does not rise by itself');
    expect(over?.querySelector('[data-sprite="icon.economy"]')).not.toBeNull();
  });

  it('tells each piece of news in its colour, and cheers a promotion', async () => {
    await inPlay({ events: (all) => [...all, { kind: 'promoted', careerId: 'healthcare', level: 1 }, { kind: 'lent', to: 'abcd1234-ffff', amount: 100_000, rateBp: 500, rounds: 2 }] });
    const notes = screen.getAllByRole('status');
    const promoted = notes.find((note) => note.textContent?.startsWith('Promoted: '));
    expect(promoted?.textContent).toContain(text.careers.healthcare.levels[1]);
    expect(promoted?.querySelector('[data-sprite^="anim.confetti"]')).not.toBeNull();
    expect(onGround(promoted, 'teal-800')).toBe(true);
    // On a phone there is no room: someone a life is lent to is named as a room names a stranger.
    const lent = notes.find((note) => note.textContent?.startsWith('You lend '));
    expect(lent?.textContent).toContain('Rat ABCD');
    expect(lent?.textContent).toContain('$1,000');
    expect(onGround(lent, 'night-700')).toBe(true);
    expect(lent?.querySelector('[data-sprite^="anim.confetti"]')).toBeNull();
  });

  it('says what the bank and the family make of the two years: the bank only when it has something to say', async () => {
    await inPlay({ events: (all) => [...all, { kind: 'ledger', line: 'creditCardDraw', amount: 10_000 }] });
    expect(screen.getByText('Your bank')).toBeTruthy();
    expect(screen.getByText(en.resolve.bank.card)).toBeTruthy();
    expect(screen.getByText('At the Christmas dinner')).toBeTruthy();
    cleanup();
    // A round the bank has nothing to say of: the family still does.
    await inPlay({ events: (all) => all.filter((e) => !(e.kind === 'ledger' && e.line === 'creditCardDraw')) });
    expect(bankQuip(resolved().before, probe.state!.view!, resolved().events)).toBeNull();
    expect(screen.queryByText('Your bank')).toBeNull();
    expect(screen.getByText('At the Christmas dinner')).toBeTruthy();
    expect(screen.getByText('At the Christmas dinner')).toBeTruthy();
  });
});

describe('what is drawn again', () => {
  it('is not drawn again by a change of the game it does not show: the profile read again, a tip read, the sound turned off, a step of nothing it reads', async () => {
    const services = await nurse({ still: true });
    const renders: Renders = { count: 0 };
    let hands: { read(tip: string): void; setSound(on: boolean): void } | null = null;
    function Hands() {
      const guide = useGuide();
      const { setSound } = useSettings();
      hands = { read: guide.read, setSound };
      return null;
    }
    renderGame(
      <>
        <Counted into={renders}>
          <Resolve />
        </Counted>
        <Probe />
        <Hands />
      </>,
      services,
    );
    await waitFor(() => expect(probe.state?.stage).toBe('finance'));
    await settled(() => probe.state!.play());
    await screen.findByRole('heading', { name: 'Two years later' });
    await settled();
    const before = renders.count;
    await settled(() => hands!.read('ledger'));
    await settled(() => hands!.setSound(false));
    await settled(() => probe.state!.clearMoved());
    await settled(() => probe.state!.clearRefusal());
    expect(renders.count).toBe(before);
    // What it shows does draw it again: the next round, which it is not.
    await settled(() => probe.state!.next());
    expect(renders.count).toBeGreaterThan(before);
    expect(screen.queryByRole('heading', { name: 'Two years later' })).toBeNull();
  });

  it('does not draw a line of the ledger again while the cash counts up: each is drawn once, as it rises', async () => {
    // As the phone's UI thread runs an animated style: worked out once, with no word to React.
    rea.restyle = false;
    const services = await nurse();
    renderGame(
      <>
        <Resolve />
        <Probe />
      </>,
      services,
    );
    await waitFor(() => expect(probe.state?.stage).toBe('finance'));
    await settled(() => probe.state!.play());
    await screen.findByRole('heading', { name: 'Two years later' });
    const lines = linesOf(resolved().events).map((line) => line.line);
    expect(rows.drawn).toEqual(lines);
    const was = fmt.money(resolved().before.player.cash);
    const is = fmt.money(probe.state!.view!.player.cash);
    // The cash is seen part way, and then where it ends: it counted, frame by frame.
    const seen = new Set<string>();
    await waitFor(
      () => {
        seen.add(cashNow().shown);
        expect(cashNow().shown).toBe(is);
      },
      { timeout: 6_000, interval: 10 },
    );
    expect([...seen].filter((shown) => shown !== was && shown !== is).length).toBeGreaterThan(0);
    expect(rows.drawn).toEqual(lines);
  });
});
