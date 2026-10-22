// @vitest-environment jsdom
import type { Milestone } from '@ratrace/content';
import type { GameEvent, GameView } from '@ratrace/engine';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameSession } from '@ratrace/core/session/types';
import { memoryServices, renderGame, setWidth } from '@/testing/render';
import type { Cue, SoundBoard } from '@/ui/sound';
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

/** A board that plays nothing and remembers the cues it was given. */
function listening(): SoundBoard & { heard: Cue[] } {
  const heard: Cue[] = [];
  let on = true;
  return { heard, play: (cue) => void (on && heard.push(cue)), setOn: (next) => void (on = next), get on() { return on; } };
}

/**
 * A nurse's life in which the next round, whatever is played, ends with the events given; and in
 * which the world is as `world` leaves it.
 */
async function life(options: { events?: GameEvent[]; story?: Milestone[]; world?: (view: GameView) => void } = {}) {
  const sound = listening();
  const services = { ...memoryServices(), sound };
  const real = await services.sessions.start('nurse');
  const seen = (): GameView => {
    const view = structuredClone(real.view());
    options.world?.(view);
    return view;
  };
  const session: GameSession = {
    gameId: real.gameId, lifeId: real.lifeId, view: seen, history: () => real.history(), bankruptcies: () => 0, badges: () => [],
    story: () => options.story ?? [],
    answerCard: async (option) => ({ ...(await real.answerCard(option)), view: seen() }),
    playRound: async (choices) => {
      const result = await real.playRound(choices);
      return { ...result, view: seen(), events: [...result.events, ...(options.events ?? [])] };
    },
  };
  services.sessions.resume = async () => ({ lost: null, session });
  const user = userEvent.setup();
  renderGame(<Play />, services);
  await screen.findByRole('heading', { name: 'News' });
  return { user, sound };
}

/** Plays the round on screen through to its result, taking the first option of every card. */
async function playRound(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^(See what life brings|To your finances)$/ }));
  for (;;) {
    const choices = screen.queryByRole('group', { name: /^Your choices/ });
    if (!choices) break;
    await user.click(within(choices).getAllByRole('button')[0]);
    await user.click(await screen.findByRole('button', { name: /^(Next card|To your finances)$/ }));
  }
  await user.click(screen.getByRole('button', { name: 'Play the round' }));
}

describe('a moment of a life', () => {
  it('takes the screen when the player leaves the rat race, with what made it so, and is heard', async () => {
    // Out in the round played, the first (round 0, lived at 22): the moment tells the age of that round.
    const { user, sound } = await life({ events: [{ kind: 'escaped', round: 0 }] });
    expect(screen.queryByRole('dialog')).toBeNull();
    await playRound(user);

    const moment = await screen.findByRole('dialog', { name: 'Out of the rat race!' });
    expect(moment.getAttribute('data-tone')).toBe('gold');
    expect(within(moment).getByText(/^At 22, your income pays for your whole life/)).toBeTruthy();
    expect(within(moment).getByText('Your passive income, after tax')).toBeTruthy();
    expect(within(moment).getByText('What your life costs')).toBeTruthy();
    expect(moment.querySelector('[data-confetti]')).not.toBeNull();
    expect(sound.heard).toContain('escape');
    // The fanfare has the floor: the ledger does not roll under it.
    expect(sound.heard).not.toContain('round');

    // Once taken in, the result of the round is there underneath, and the moment does not come back.
    await user.click(within(moment).getByRole('button', { name: 'Carry on, for the fun of it' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Two years later' })).toBeTruthy();
  });

  it('says what a bankruptcy took and what it left, in wine and without confetti', async () => {
    const { user, sound } = await life({ events: [{ kind: 'bankrupt', proceeds: 1_250_000, debtsCleared: 9_900_000 }] });
    await playRound(user);
    const moment = await screen.findByRole('dialog', { name: 'Bankrupt' });
    expect(moment.getAttribute('data-tone')).toBe('wine');
    expect(within(moment).getByText('$12,500')).toBeTruthy();
    expect(within(moment).getByText('$99,000')).toBeTruthy();
    expect(within(moment).getByText('−25')).toBeTruthy();
    expect(moment.querySelector('[data-confetti]')).toBeNull();
    expect(sound.heard).toContain('bankrupt');
  });

  it('shows one at a time when a round brings more than one, the gravest first', async () => {
    const { user } = await life({
      events: [{ kind: 'escaped', round: 0 }, { kind: 'bankrupt', proceeds: 0, debtsCleared: 0 }],
      story: [{ round: 1, kind: 'worth', mark: 100_000_000 }],
    });
    await playRound(user);
    await user.click(within(await screen.findByRole('dialog', { name: 'Bankrupt' })).getByRole('button', { name: 'Start again' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Out of the rat race!' })).getByRole('button', { name: 'Close' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Your first million' })).getByRole('button', { name: 'On to the next' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is not made of an ordinary round', async () => {
    const { user, sound } = await life();
    await playRound(user);
    await screen.findByRole('heading', { name: 'Two years later' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(sound.heard).toContain('round');
  });
});

describe('a crisis', () => {
  const crash = (year: number) => (view: GameView) => (view.timeline[view.round].crisis = { id: 'crash', year, of: 3 });

  it('opens with a moment of its own that says what it is and how long it lasts, and sounds the siren', async () => {
    // The crisis opens with the second round of this life: the first is played in ordinary times.
    const { user, sound } = await life({ world: (view) => (view.round === 1 ? crash(1)(view) : undefined) });
    await playRound(user);
    expect(sound.heard).not.toContain('crisis');
    await user.click(await screen.findByRole('button', { name: 'Next round' }));
    const moment = await screen.findByRole('dialog', { name: 'The Great Crash' });
    expect(moment.getAttribute('data-tone')).toBe('wine');
    expect(within(moment).getByText('Crisis · lasts 3 rounds')).toBeTruthy();
    expect(within(moment).getByText(/^Markets are in free fall/)).toBeTruthy();
    const years = within(moment).getAllByRole('listitem');
    expect(years).toHaveLength(3);
    expect(years[0].getAttribute('aria-current')).toBe('step');
    expect(sound.heard).toContain('crisis');

    await user.click(within(moment).getByRole('button', { name: 'Face it' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    // The news carry its bar for as long as it lasts.
    expect(screen.getByRole('button', { name: 'The Great Crash: year 1 of 3. See what it is.' })).toBeTruthy();
  });

  it('keeps its bar in the news and a strip of it in the HUD, without stopping the game again', async () => {
    const { user } = await life({ world: crash(2) });
    expect(screen.queryByRole('dialog')).toBeNull();
    const bar = screen.getByRole('button', { name: 'The Great Crash: year 2 of 3. See what it is.' });
    expect(within(bar).getByText('Crisis · year 2 of 3')).toBeTruthy();
    expect(within(bar).getByText('Jobs go, and prices keep sliding.')).toBeTruthy();

    await user.click(bar);
    const sheet = screen.getByRole('dialog', { name: 'The Great Crash' });
    expect(within(sheet).getAllByRole('listitem')[1].getAttribute('aria-current')).toBe('step');
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));

    // Away from the news the bar is a strip in the HUD: the same button, without the line of the year.
    await user.click(screen.getByRole('button', { name: /^(See what life brings|To your finances)$/ }));
    const strip = screen.getByRole('button', { name: 'The Great Crash: year 2 of 3. See what it is.' });
    expect(within(strip).queryByText('Jobs go, and prices keep sliding.')).toBeNull();
  });

  it('shows nothing in ordinary times', async () => {
    await life();
    expect(screen.queryByRole('button', { name: /See what it is/ })).toBeNull();
  });
});

describe('the sounds of a round', () => {
  it('tick at every press, deal the cards, and fall silent when sound is turned off', async () => {
    const { user, sound } = await life();
    await user.click(screen.getByRole('button', { name: /^(See what life brings|To your finances)$/ }));
    expect(sound.heard.filter((cue) => cue === 'tap')).toHaveLength(1);
    if (screen.queryByRole('group', { name: /^Your choices/ })) expect(sound.heard).toContain('card');

    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    const before = sound.heard.length;
    await user.click(within(screen.getByRole('dialog', { name: 'Settings' })).getByRole('switch', { name: /^Sound/ }));
    expect(within(screen.getByRole('dialog', { name: 'Settings' })).getByRole('switch', { name: /^Sound/ }).getAttribute('aria-checked')).toBe('false');
    await user.click(within(screen.getByRole('dialog', { name: 'Settings' })).getByRole('button', { name: 'Close' }));
    // The press that turned it off was the last thing heard.
    expect(sound.heard.length).toBeLessThanOrEqual(before + 1);
    expect(sound.on).toBe(false);
  });
});
