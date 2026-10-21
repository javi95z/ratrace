// @vitest-environment jsdom
import { endingArt, lives, rarityOf, textFor } from '@ratrace/content';
import type { Ending } from '@ratrace/content';
import { prizedBadge } from '@ratrace/core/game/present';
import { sceneStore } from '@ratrace/core/testing/scenes';
import type { GameSession, SavedGame } from '@ratrace/core/session/types';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { heard, memoryServices, renderGame, router, spriteRenders } from '../../testing/render';
import { speaking } from '../../testing/memoryServices';
import { settled } from '../../testing/renders';
import { KEYFRAMES } from '../../ui/motion';
import { rea } from '../../ui/testing/reanimated';
import { GameProvider, useGame } from '../context';
import { End } from './End';
import { Home } from './Home';
import { Play } from './Play';
import { RankGain } from './RankCard';

afterEach(cleanup);

const { text } = textFor('en');

/** Plays whole rounds without the screen. */
async function playRounds(session: GameSession, rounds: number) {
  for (let i = 0; i < rounds; i++) {
    while (session.view().phase === 'cards') await session.answerCard(0);
    await session.playRound({ orders: [] });
  }
}

/** A nurse's whole life, played with the first choice of every card and no orders: the device then opens on its end. */
async function aWholeLife() {
  const services = memoryServices();
  const session = await services.sessions.start('nurse');
  await playRounds(session, 20);
  return { services, gameId: session.gameId };
}

describe('the end of a life, as it is left', () => {
  it('lets the life go once its end screen is left: it is among the finished lives, and the front door no longer offers to see how it ended', async () => {
    const { services } = await aWholeLife();
    let leave: (() => void) | null = null;
    // The end screen, and the front door under it in the stack, as the phone has them: the end screen is left, the front door stays.
    function Stack() {
      const [onEnd, setOnEnd] = useState(true);
      leave = () => setOnEnd(false);
      return (
        <>
          {onEnd ? <Play /> : null}
          <Home />
        </>
      );
    }
    renderGame(<Stack />, services);
    expect(await screen.findByRole('heading', { name: 'The end' })).toBeTruthy();
    // While the end is on screen, the life that is over can be looked at again from the front door.
    expect(screen.getByRole('link', { name: 'See how your last life ended' })).toBeTruthy();
    await settled(() => leave!());
    await waitFor(() => expect(screen.queryByRole('link', { name: 'See how your last life ended' })).toBeNull());
    expect(await services.store.loadGame()).toBeNull();
    expect(await services.store.listRuns()).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'New life' })).toBeTruthy();
  });

  it('keeps the life when its end screen is drawn again at once: only leaving it lets it go', async () => {
    const { services } = await aWholeLife();
    const held = speaking(services, 'en');
    const { rerender } = render(
      <GameProvider services={held}>
        <End key="first" />
      </GameProvider>,
    );
    expect(await screen.findByRole('heading', { name: 'The end' })).toBeTruthy();
    rerender(
      <GameProvider services={held}>
        <End key="again" />
      </GameProvider>,
    );
    await settled();
    expect(screen.getByRole('heading', { name: 'The end' })).toBeTruthy();
    expect(await services.store.loadGame()).not.toBeNull();
  });

  it('takes the player to the page where a life is chosen, in place of the end, when the life it opened cannot begin from here', async () => {
    const { services, gameId } = await aWholeLife();
    // A life the game does not know, opened by this one: beginning it is refused.
    await services.store.saveProfile({ ...(await services.store.loadProfile()), unlocked: { nobody: { at: 1, gameId } } });
    const said = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderGame(<Play />, services);
    const card = await screen.findByLabelText('A new life is open');
    await settled(() => void fireEvent.click(within(card).getByRole('button', { name: 'Try it now' })));
    expect(router.replace).toHaveBeenCalledWith('/new');
    // In place of this screen, as "Live another life" goes: never a second Play on the stack.
    expect(router.push).not.toHaveBeenCalled();
    said.mockRestore();
  });

  it('lets go of nothing once another life has taken its place', async () => {
    const { services } = await aWholeLife();
    let start: ((lifeId: string) => Promise<boolean>) | null = null;
    function Hands() {
      start = useGame((s) => s.start);
      return null;
    }
    renderGame(
      <>
        <Play />
        <Hands />
      </>,
      services,
    );
    expect(await screen.findByRole('heading', { name: 'The end' })).toBeTruthy();
    await settled(() => start!('engineer'));
    expect(await screen.findByRole('heading', { name: 'News' })).toBeTruthy();
    await settled();
    expect(((await services.store.loadGame()) as SavedGame | null)?.lifeId).toBe('engineer');
  });
});

describe('the end of a life, as it is drawn', () => {
  it('tells the life in paragraphs that rise one after another, and closes on its obituary', async () => {
    const { services } = await aWholeLife();
    rea.assigned.length = 0;
    renderGame(<Play />, services);
    const told = await screen.findByLabelText('Your life, told');
    // One line of words, its title in the pixel face: the title and what follows it are pieces of the same text.
    expect(told.textContent).toMatch(/OBITUARY: \S/);
    // Each paragraph waits 350 ms more than the one before, from 300; the obituary after the last.
    const rises = rea.assigned.filter((one) => one.kind === 'timing' && one.to === 1).map((one) => one.duration - KEYFRAMES.rise.ms);
    const paragraphs = rises.filter((wait) => wait >= 300 && (wait - 300) % 350 === 0).map((wait) => (wait - 300) / 350);
    expect(paragraphs.length).toBeGreaterThan(1);
    expect(paragraphs).toEqual([...paragraphs].sort((a, b) => a - b));
    expect(paragraphs).toEqual(paragraphs.map((_, i) => i));
  });

  it('draws the route, the figures and the badges of the life, and says why a badge is in it in its sheet', async () => {
    const { services } = await aWholeLife();
    renderGame(<Play />, services);
    expect(await screen.findByRole('heading', { name: 'The end' })).toBeTruthy();
    // The nurse never moved: the map is Madrid alone (under the first screen, once the first is on it: ui/drawnFirst.ts).
    expect(await screen.findByRole('img', { name: 'A map of the world with your route: Madrid' })).toBeTruthy();
    const figures = screen.getByLabelText('Your life in figures');
    for (const label of ['Net worth', 'At its richest', 'Out of the rat race at', 'Badges']) expect(within(figures).getByText(label), label).toBeTruthy();
    // The net worth after inflation is in words the messages have.
    expect(within(figures).getByText(/ without inflation$/)).toBeTruthy();
    expect(figures.textContent).not.toMatch(/\bend\.\w+/);
    // The ending's picture, by how the life ended.
    expect(document.querySelector('[data-ending]')).not.toBeNull();
  });

  it('cheers a rare badge won for the first time, and says what the life did for the rat\'s rank', async () => {
    // The engineer of the scenes' end, played by the saver: out of the rat race, a millionaire, and a rank higher.
    const store = await sceneStore('end-escaped');
    const services = memoryServices(store);
    renderGame(<Play />, services);
    expect(await screen.findByRole('heading', { name: 'The end' })).toBeTruthy();
    const [run] = await store.listRuns();
    const prized = prizedBadge(run.badges);
    // The scene's life did win one (a rare badge, the first of its kind): the cheer is there to be found, not skipped for want of one.
    expect(prized).toBeDefined();
    const name = text.badges[prized!.id].name;
    expect(screen.getByText(rarityOf(prized!.id) === 'legendary' ? `A legendary badge: ${name}!` : `A rare badge: ${name}!`)).toBeTruthy();
    const gained = (await store.loadProfile()).rank.lives[run.runId];
    expect(gained).toBeGreaterThan(0);
    expect(await screen.findByText(new RegExp(`^\\+${gained} points · `))).toBeTruthy();
  });
});

describe('what the life did for the rat\'s rank', () => {
  it('gives the points of the life, and a card with its sound when it made the player a higher rank', async () => {
    const services = memoryServices();
    // 40 points before, 30 from this life: from the sewer to the office.
    await services.store.saveProfile({ ...(await services.store.loadProfile()), rank: { points: 70, lives: { earlier: 40, mine: 30 } } });
    renderGame(<RankGain gameId="mine" />, services);
    expect(await screen.findByText('New rank: Office rat!')).toBeTruthy();
    expect(screen.getByText('+30 points · 80 points to Stock rat')).toBeTruthy();
    await waitFor(() => expect(heard).toContain('promote'));
  });

  it('gives the points alone when the life made no higher rank, and nothing for a life the rank has not counted', async () => {
    const services = memoryServices();
    await services.store.saveProfile({ ...(await services.store.loadProfile()), rank: { points: 20, lives: { mine: 20 } } });
    renderGame(
      <>
        <RankGain gameId="mine" />
        <RankGain gameId="uncounted" />
      </>,
      services,
    );
    expect(await screen.findByText('+20 points · 30 points to Office rat')).toBeTruthy();
    expect(screen.queryByText(/New rank/)).toBeNull();
    expect(screen.getAllByText(/^\+/)).toHaveLength(1);
    expect(heard).not.toContain('promote');
  });
});

describe('what is drawn again', () => {
  it('does not draw the end screen again while its score counts up, nor for a change of the game it does not draw', async () => {
    const { services } = await aWholeLife();
    const lifeId = 'nurse';
    let clearMoved: (() => void) | null = null;
    function Hands() {
      clearMoved = useGame((s) => s.clearMoved);
      return null;
    }
    renderGame(
      <>
        <End />
        <Hands />
      </>,
      services,
    );
    const score = await screen.findByRole('group', { name: 'Score' });
    // The picture of how the life ended, which the screen draws itself: counted each time the screen is drawn. (Its portrait is the walker's on the
    // life's line too, which moves on its own.)
    const ending = endingArt(document.querySelector('[data-ending]')?.getAttribute('data-ending') as Ending);
    await settled();
    const before = spriteRenders.get(ending);
    expect(before).toBeGreaterThan(0);
    // The figure counts up from nothing to the score, in a leaf of its own.
    const [run] = await services.store.listRuns();
    const full = new Intl.NumberFormat('en-US').format(run.score);
    await waitFor(() => expect(within(score).getAllByText(full)).toHaveLength(2), { timeout: 3_000 });
    await settled(() => clearMoved!());
    expect(spriteRenders.get(ending)).toBe(before);
    expect(lives.some((life) => life.id === lifeId)).toBe(true);
  });

  it('starts the score from nothing, and where motion is left out shows it whole at once', async () => {
    const { services } = await aWholeLife();
    renderGame(<End />, services);
    const score = await screen.findByRole('group', { name: 'Score' });
    const [run] = await services.store.listRuns();
    const full = new Intl.NumberFormat('en-US').format(run.score);
    // Read out whole at once, by words only a screen reader hears; the figure on screen begins at nothing.
    expect(within(score).getAllByText(full).length).toBeGreaterThan(0);
    expect(within(score).getAllByText('0').length).toBeGreaterThan(0);
    cleanup();
    await act(async () => {
      await services.store.saveProfile({ ...(await services.store.loadProfile()), settings: { ...(await services.store.loadProfile()).settings, reducedMotion: true } });
    });
    renderGame(<End />, memoryServices(services.store));
    const still = await screen.findByRole('group', { name: 'Score' });
    await waitFor(() => expect(within(still).getAllByText(full)).toHaveLength(2));
    expect(router.replace).not.toHaveBeenCalled();
  });
});
