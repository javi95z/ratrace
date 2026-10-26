// @vitest-environment jsdom
import type { Milestone } from '@ratrace/content';
import type { GameSession } from '@ratrace/core/session/types';
import type { GameEvent, GameView } from '@ratrace/engine';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { heard, memoryServices, renderGame } from '../../testing/render';
import { settled } from '../../testing/renders';
import { COLORS } from '../../ui/theme';
import { Play } from './Play';

// The early escape's module also writes a life where the phone keeps it (the device's database): only its life is played here.
vi.mock('../../kvStore', async (original) => ({ ...(await original<typeof import('../../kvStore')>()), KvStore: class {} }));
const { earlyEscape } = await import('../../testing/perfLife');

/*
 * The web's Moments.test.tsx on the phone: a moment of a life takes the screen in a sheet of its own over Play, one at a time, the gravest first;
 * a crisis opens with one and keeps its bar. The sounds are the phone's own player's, as the test double of `useSound` hears them (`heard`).
 */

afterEach(cleanup);

const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

/**
 * A nurse's life in which the next round, whatever is played, ends with the events given; and in which the world is as `world` leaves it.
 */
async function life(options: { events?: GameEvent[]; story?: Milestone[]; world?: (view: GameView) => void } = {}) {
  const services = memoryServices();
  const real = await services.sessions.start('nurse');
  const seen = (): GameView => {
    const view = structuredClone(real.view());
    options.world?.(view);
    return view;
  };
  const session: GameSession = {
    gameId: real.gameId,
    lifeId: real.lifeId,
    view: seen,
    history: () => real.history(),
    bankruptcies: () => 0,
    badges: () => [],
    story: () => options.story ?? [],
    answerCard: async (option) => ({ ...(await real.answerCard(option)), view: seen() }),
    playRound: async (choices) => {
      const result = await real.playRound(choices);
      return { ...result, view: seen(), events: [...result.events, ...(options.events ?? [])] };
    },
  };
  services.sessions.resume = async () => ({ lost: null, session });
  renderGame(<Play />, services);
  await screen.findByRole('heading', { name: 'News' });
  return services;
}

/** Plays the round on screen through to its result, taking the first option of every card. */
async function playRound() {
  fireEvent.click(screen.getByRole('button', { name: /^(See what life brings|To your finances)$/ }));
  for (;;) {
    const choices = screen.queryByRole('group', { name: /^Your choices/ });
    if (!choices) break;
    fireEvent.click(within(choices).getAllByRole('button')[0]);
    fireEvent.click(await screen.findByRole('button', { name: /^(Next card|To your finances)$/ }));
  }
  fireEvent.click(await screen.findByRole('button', { name: 'Play the round' }));
}

/** The sheet of a moment, by its title. */
const sheet = async (name: string) => (await screen.findByRole('heading', { name })).closest('[aria-modal="true"]') as HTMLElement;
const sheetOpen = () => document.querySelector('[aria-modal="true"]');

/** The light of a sheet's frame: gold, wine, or the plain navy of a sheet that carries a choice (the web's `data-tone`). */
function toneOf(open: HTMLElement): 'gold' | 'wine' | 'plain' {
  // The frame is the first box up from the title that is drawn with its strips (a bevel: four of outline, four of edge).
  for (let box = within(open).getAllByRole('heading')[0].parentElement; box !== null && box !== open; box = box.parentElement) {
    const strips = [...box.querySelectorAll<HTMLElement>(':scope > div')].filter((strip) => strip.style.position === 'absolute').map((strip) => strip.style.backgroundColor);
    if (strips.length < 8) continue;
    return strips.includes(rgb(COLORS['gold-200'])) ? 'gold' : strips.includes(rgb(COLORS['wine-500'])) ? 'wine' : 'plain';
  }
  throw new Error('no frame round the sheet');
}

describe('a moment of a life', () => {
  it('takes the screen when the player leaves the rat race, with what made it so, and is heard', async () => {
    // Out in the round played, the first (round 0, lived at 22): the moment tells the age of that round.
    await life({ events: [{ kind: 'escaped', round: 0 }] });
    expect(sheetOpen()).toBeNull();
    await playRound();

    const moment = await sheet('Out of the rat race!');
    expect(toneOf(moment)).toBe('gold');
    expect(within(moment).getByText(/^At 22, your income pays for your whole life/)).toBeTruthy();
    expect(within(moment).getByText('Your passive income, after tax')).toBeTruthy();
    expect(within(moment).getByText('What your life costs')).toBeTruthy();
    expect(moment.querySelector('[data-confetti]')).not.toBeNull();
    expect(heard).toContain('escape');
    // The fanfare has the floor: the ledger does not roll under it.
    expect(heard).not.toContain('round');

    // Once taken in, the result of the round is there underneath, and the moment does not come back.
    fireEvent.click(within(moment).getByRole('button', { name: 'Carry on, for the fun of it' }));
    await waitFor(() => expect(sheetOpen()).toBeNull());
    expect(screen.getByRole('heading', { name: 'Two years later' })).toBeTruthy();
    await settled();
    expect(sheetOpen()).toBeNull();
  });

  it('says what a bankruptcy took and what it left, in wine and without confetti', async () => {
    await life({ events: [{ kind: 'bankrupt', proceeds: 1_250_000, debtsCleared: 9_900_000 }] });
    await playRound();
    const moment = await sheet('Bankrupt');
    expect(toneOf(moment)).toBe('wine');
    expect(within(moment).getByText('$12,500')).toBeTruthy();
    expect(within(moment).getByText('$99,000')).toBeTruthy();
    expect(within(moment).getByText('−25')).toBeTruthy();
    expect(moment.querySelector('[data-confetti]')).toBeNull();
    expect(heard).toContain('bankrupt');
  });

  it('shows one at a time when a round brings more than one, the gravest first', async () => {
    await life({
      events: [{ kind: 'escaped', round: 0 }, { kind: 'bankrupt', proceeds: 0, debtsCleared: 0 }],
      story: [{ round: 1, kind: 'worth', mark: 100_000_000 }],
    });
    await playRound();
    fireEvent.click(within(await sheet('Bankrupt')).getByRole('button', { name: 'Start again' }));
    fireEvent.click(within(await sheet('Out of the rat race!')).getByRole('button', { name: 'Close' }));
    fireEvent.click(within(await sheet('Your first million')).getByRole('button', { name: 'On to the next' }));
    await waitFor(() => expect(sheetOpen()).toBeNull());
  });

  it('is not made of an ordinary round', async () => {
    await life();
    await playRound();
    await screen.findByRole('heading', { name: 'Two years later' });
    expect(sheetOpen()).toBeNull();
    expect(heard).toContain('round');
  });
});

describe('a moment and a legendary badge of the same round', () => {
  it('take their turns, one sheet at a time (iOS presents one Modal at a time): the moments first, as the web draws them on top, then the badge', async () => {
    // The influencer of the early escape, at the finances of the round that takes her out of the rat race at 38 and earns `escaped_before_40`.
    const { store } = await earlyEscape();
    renderGame(<Play />, memoryServices(store));
    fireEvent.click(await screen.findByRole('button', { name: 'Play the round' }));
    const moment = await sheet('Out of the rat race!');
    // The badge's sheet waits its turn: not drawn while the moment's is.
    expect(screen.queryByRole('heading', { name: 'Out before 40' })).toBeNull();
    expect(screen.queryByText('Legendary badge')).toBeNull();
    fireEvent.click(within(moment).getByRole('button', { name: 'Carry on, for the fun of it' }));
    // The round's other moment, the first million, in its turn among the moments (one sheet, one moment after the other, as on the web).
    const million = await sheet('Your first million');
    expect(screen.queryByRole('heading', { name: 'Out before 40' })).toBeNull();
    fireEvent.click(within(million).getAllByRole('button').at(-1)!);
    const badge = await sheet('Out before 40');
    expect(within(badge).getByText('Legendary badge')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Out of the rat race!' })).toBeNull();
    fireEvent.click(within(badge).getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(sheetOpen()).toBeNull());
  }, 60_000);
});

describe('a crisis', () => {
  const crash = (year: number) => (view: GameView) => void (view.timeline[view.round].crisis = { id: 'crash', year, of: 3 });

  it('opens with a moment of its own that says what it is and how long it lasts, and sounds the siren', async () => {
    // The crisis opens with the second round of this life: the first is played in ordinary times.
    await life({ world: (view) => (view.round === 1 ? crash(1)(view) : undefined) });
    await playRound();
    await screen.findByRole('heading', { name: 'Two years later' });
    expect(heard).not.toContain('crisis');
    fireEvent.click(await screen.findByRole('button', { name: 'Next round' }));
    const moment = await sheet('The Great Crash');
    expect(toneOf(moment)).toBe('wine');
    expect(within(moment).getByText('Crisis · lasts 3 rounds')).toBeTruthy();
    expect(within(moment).getByText(/^Markets are in free fall/)).toBeTruthy();
    const years = within(moment).getAllByRole('listitem');
    expect(years).toHaveLength(3);
    expect(years[0].getAttribute('aria-current')).toBe('step');
    expect(heard).toContain('crisis');

    fireEvent.click(within(moment).getByRole('button', { name: 'Face it' }));
    await waitFor(() => expect(sheetOpen()).toBeNull());
    // The news carry its bar for as long as it lasts.
    expect(screen.getByRole('button', { name: 'The Great Crash: year 1 of 3. See what it is.' })).toBeTruthy();
  });

  it('keeps its bar in the news and a strip of it in the HUD, without stopping the game again', async () => {
    await life({ world: crash(2) });
    expect(sheetOpen()).toBeNull();
    const bar = screen.getByRole('button', { name: 'The Great Crash: year 2 of 3. See what it is.' });
    // The phone sets the line of the year in capitals itself (the web's stylesheet does: `uppercase`).
    expect(within(bar).getByText('CRISIS · YEAR 2 OF 3')).toBeTruthy();
    expect(within(bar).getByText('Jobs go, and prices keep sliding.')).toBeTruthy();

    fireEvent.click(bar);
    const details = await sheet('The Great Crash');
    expect(within(details).getAllByRole('listitem')[1].getAttribute('aria-current')).toBe('step');
    fireEvent.click(within(details).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(sheetOpen()).toBeNull());

    // Away from the news the bar is a strip in the HUD: the same button, without the line of the year.
    fireEvent.click(screen.getByRole('button', { name: /^(See what life brings|To your finances)$/ }));
    const strip = await screen.findByRole('button', { name: 'The Great Crash: year 2 of 3. See what it is.' });
    expect(within(strip).queryByText('Jobs go, and prices keep sliding.')).toBeNull();
    expect(sheetOpen()).toBeNull();
  });

  it('shows nothing in ordinary times', async () => {
    await life();
    expect(screen.queryByRole('button', { name: /See what it is/ })).toBeNull();
  });
});

describe('the sounds of a round', () => {
  it('deal the cards with no click at a press (the phone\'s own, off until turned on), tick once it is, and fall silent when sound is turned off', async () => {
    const services = await life();
    fireEvent.click(screen.getByRole('button', { name: /^(See what life brings|To your finances)$/ }));
    expect(heard.filter((cue) => cue === 'tap')).toHaveLength(0);
    if (screen.queryByRole('group', { name: /^Your choices/ })) expect(heard).toContain('card');

    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    const settings = await sheet('Settings');
    fireEvent.click(within(settings).getByRole('switch', { name: /^Click on every press/ }));
    await waitFor(() => expect(within(settings).getByRole('switch', { name: /^Click on every press/ }).getAttribute('aria-checked')).toBe('true'));
    // The press that turned it on was the last silent one: the next one clicks.
    expect(heard.filter((cue) => cue === 'tap')).toHaveLength(0);
    const before = heard.length;
    fireEvent.click(within(settings).getByRole('switch', { name: /^Sound/ }));
    expect(heard.filter((cue) => cue === 'tap')).toHaveLength(1);
    await waitFor(() => expect(within(settings).getByRole('switch', { name: /^Sound/ }).getAttribute('aria-checked')).toBe('false'));
    fireEvent.click(within(settings).getByRole('button', { name: 'Close' }));
    // The press that turned it off was the last thing heard.
    expect(heard.length).toBeLessThanOrEqual(before + 1);
    await waitFor(async () => expect((await services.store.loadProfile()).settings.sound).toBe(false));
    const silent = heard.length;
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    await sheet('Settings');
    expect(heard).toHaveLength(silent);
  });
});
