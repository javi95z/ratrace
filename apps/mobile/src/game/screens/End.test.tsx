// @vitest-environment jsdom
import { challengeOf, content, CONTENT_VERSION, endingArt, lives, textFor, weekOf } from '@ratrace/content';
import type { Ending } from '@ratrace/content';
import { prizedBadge } from '@ratrace/core/game/present';
import { LocalSessions } from '@ratrace/core/session/local';
import { MemoryStore } from '@ratrace/core/session/memory';
import { RankedSessions } from '@ratrace/core/session/ranked';
import { GameSessions } from '@ratrace/core/session/sessions';
import { sceneStore } from '@ratrace/core/testing/scenes';
import type { GameSession, SavedGame } from '@ratrace/core/session/types';
import { ENGINE_VERSION } from '@ratrace/engine';
import type { Account, AccountState, Community } from '@ratrace/online/types';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rankedServer } from '../../../../web/src/testing/rankedServer';
import { network } from '../../testing/fakes';
import { heard, memoryServices, renderGame, router, spriteRenders } from '../../testing/render';
import { speaking } from '../../testing/memoryServices';
import { settled, steady } from '../../testing/renders';
import { KEYFRAMES } from '../../ui/motion';
import { rea } from '../../ui/testing/reanimated';
import { GameProvider, useGame } from '../context';
import { COMPARE_MIN, End } from './End';
import { Home } from './Home';
import { Play } from './Play';
import { RankGain } from './RankCard';

// The panels under the first screen, held back by a test until it lets them in (`drawn.hold`); otherwise as ui/drawnFirst.ts puts them in.
const drawn = vi.hoisted(() => ({ hold: false, release: () => {} }));
vi.mock('../../ui/drawnFirst', async (original) => {
  const real = await original<typeof import('../../ui/drawnFirst')>();
  const { useEffect, useState } = await import('react');
  return {
    ...real,
    useDrawnFirst: () => {
      const shown = real.useDrawnFirst();
      const [free, setFree] = useState(!drawn.hold);
      useEffect(() => {
        if (!free) drawn.release = () => setFree(true);
      }, [free]);
      return shown && free;
    },
  };
});

afterEach(() => {
  drawn.hold = false;
  cleanup();
});

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
  it('lets the life go once its end screen is left: it is among the finished lives, and the front door offers nothing of it, before or after', async () => {
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
    // While the end is on screen, the front door under it offers no look back at the life that is over: that is in the records.
    expect(screen.queryByText(/last life|lastLife/)).toBeNull();
    expect(await services.store.loadGame()).not.toBeNull();
    await settled(() => leave!());
    await waitFor(async () => expect(await services.store.loadGame()).toBeNull());
    expect(screen.queryByText(/last life|lastLife/)).toBeNull();
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
    // The life it opened, in the reward sheet over the end: Try it now closes it, then begins the life.
    const sheet = (await screen.findByText('New life unlocked')).closest('[aria-modal="true"]') as HTMLElement;
    await settled(() => void fireEvent.click(within(sheet).getByRole('button', { name: 'Try it now' })));
    await waitFor(() => expect(screen.queryByText('New life unlocked')).toBeNull());
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/en/new'));
    // In place of this screen, as "Live another life" goes: never a second Play on the stack.
    expect(router.push).not.toHaveBeenCalled();
    said.mockRestore();
  });

  it('begins the life it opened from its reward sheet: Try it now closes the sheet, then that life is on screen', async () => {
    const { services, gameId } = await aWholeLife();
    await services.store.saveProfile({ ...(await services.store.loadProfile()), unlocked: { rider: { at: 1, gameId } } });
    let lifeId: string | null = null;
    function Hands() {
      lifeId = useGame((s) => s.lifeId);
      return null;
    }
    renderGame(
      <>
        <Play />
        <Hands />
      </>,
      services,
    );
    const sheet = (await screen.findByText('New life unlocked')).closest('[aria-modal="true"]') as HTMLElement;
    expect(within(sheet).getByRole('heading', { name: 'Somchai' })).toBeTruthy();
    await settled(() => void fireEvent.click(within(sheet).getByRole('button', { name: 'Try it now' })));
    await waitFor(() => expect(lifeId).toBe('rider'));
    expect(screen.queryByText('New life unlocked')).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
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

  it('tells what became of each person the life met, with their face, before its obituary', async () => {
    const { services } = await aWholeLife();
    const flags = ((await services.store.loadGame()) as SavedGame).state.player.life.flags;
    renderGame(<Play />, services);
    const told = await screen.findByLabelText('Your life, told');
    // The nurse, answering every card with its first choice, says she will manage without her parents' help: they are proud of her.
    expect(Object.hasOwn(flags, 'parents_met')).toBe(true);
    const line = within(told).getByText(text.people.parents.endings.fine);
    const people = within(told).getByRole('list', { name: 'What became of them' });
    expect(people.contains(line)).toBe(true);
    expect(people.querySelector('[data-sprite="person.parents.pleased"]')?.closest('[aria-hidden="true"]')).not.toBeNull();
    // Only the people met are told of.
    expect(within(people).getAllByRole('listitem')).toHaveLength(Object.keys(flags).filter((flag) => /^(inlaw|boss|landlord|founder|advisor|parents)_met$/.test(flag)).length);
    expect(told.textContent?.indexOf(text.people.parents.endings.fine)).toBeLessThan(told.textContent?.indexOf('OBITUARY') ?? 0);
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

  it('cheers no badge in a box of its own (the badges of the life are in their list), and says what the life did for the rat\'s rank', async () => {
    // The engineer of the scenes' end, played by the saver: out of the rat race, a millionaire, and a rank higher.
    const store = await sceneStore('end-escaped');
    const services = memoryServices(store);
    renderGame(<Play />, services);
    expect(await screen.findByRole('heading', { name: 'The end' })).toBeTruthy();
    const [run] = await store.listRuns();
    const prized = prizedBadge(run.badges);
    // The scene's life did win one (a rare badge, the first of its kind): it is in the life's list of badges, and nowhere in a cheer of its own.
    expect(prized).toBeDefined();
    const name = text.badges[prized!.id].name;
    expect(screen.queryByText(`A legendary badge: ${name}!`)).toBeNull();
    expect(screen.queryByText(`A rare badge: ${name}!`)).toBeNull();
    expect(await screen.findByText(name)).toBeTruthy();
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

describe('the page as it comes', () => {
  it('puts nothing in above what is on screen: the share card and the ways out come with the panels under the first screen, under them', async () => {
    const { services } = await aWholeLife();
    drawn.hold = true;
    renderGame(<Play />, services);
    expect(await screen.findByRole('heading', { name: 'The end' })).toBeTruthy();
    // The first screen alone: none of what stands under the panels put in second, which would be pushed down by them on a screen tall enough.
    expect(screen.queryByLabelText('Your life on one line')).toBeNull();
    for (const [role, name] of [['button', 'Share this life'], ['link', 'Live another life'], ['link', 'Home']] as const) expect(screen.queryByRole(role, { name }), name).toBeNull();
    await act(async () => drawn.release());
    const badges = await screen.findByLabelText('Badges of this life');
    // Then every one of them, under the last panel.
    for (const [role, name] of [['button', 'Share this life'], ['link', 'Live another life'], ['link', 'Home']] as const) {
      const action = screen.getByRole(role, { name });
      expect(badges.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING, name).toBeTruthy();
    }
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
    // Counted from where the screen has settled: its drawings of the picture stop changing.
    await steady(() => spriteRenders.get(ending));
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

describe('the end of a life, beside the lives of others', () => {
  /** A community that answers the comparison as told, and nothing else. */
  const others = (answer: { below: number; total: number } | null, asked: unknown[]): Community =>
    ({ compare: async (query: unknown) => (asked.push(query), answer) }) as unknown as Community;
  const ended = async (answer: { below: number; total: number } | null) => {
    const asked: unknown[] = [];
    const { services } = await aWholeLife();
    const community = others(answer, asked);
    renderGame(<End />, { ...services, community: () => community });
    expect(await screen.findByRole('heading', { name: 'The end' })).toBeTruthy();
    const [run] = await services.store.listRuns();
    return { asked, run };
  };

  it('says how many of the lives others played from the same start scored less', async () => {
    const { asked, run } = await ended({ below: 31, total: 40 });
    const score = screen.getByRole('group', { name: 'Score' });
    expect(await within(score).findByText('Better than 77% of the Nurse lives others have played (40).')).toBeTruthy();
    expect(within(score).getByRole('status').querySelector('[data-sprite="icon.percentile"]')).not.toBeNull();
    // Asked of this life and its score, however many times the screen is drawn.
    expect(asked.length).toBeGreaterThan(0);
    for (const query of asked) expect(query).toEqual({ lifeId: 'nurse', score: run.score });
  });

  it('says nothing with too few to compare with, or with nobody to ask', async () => {
    await ended({ below: 3, total: COMPARE_MIN - 1 });
    await settled();
    expect(screen.queryByText(/lives others have played/)).toBeNull();
    cleanup();
    await ended(null);
    await settled();
    expect(screen.queryByText(/lives others have played/)).toBeNull();
  });

  it('is not drawn again once the others have answered, nor for the connection coming and going', async () => {
    const asked: unknown[] = [];
    const { services } = await aWholeLife();
    const community = others({ below: 31, total: 40 }, asked);
    // Someone signed in: with a connection their lives are ranked, and without one they are not, which the end of this life does not draw.
    const guest: AccountState = { kind: 'guest', userId: 'u', notice: null };
    const account: Account = { state: () => guest, subscribe: () => () => {}, start: async () => {}, keepWithGoogle: async () => true, useExistingAccount: async () => true, dismissNotice: () => {}, signOut: async () => false };
    renderGame(<End />, { ...services, account, community: () => community });
    await screen.findByText('Better than 77% of the Nurse lives others have played (40).');
    const ending = endingArt(document.querySelector('[data-ending]')?.getAttribute('data-ending') as Ending);
    await steady(() => spriteRenders.get(ending));
    const before = spriteRenders.get(ending);
    await settled(() => network.set(false));
    await settled(() => network.set(true));
    expect(spriteRenders.get(ending)).toBe(before);
  });
});

describe('the end of a ranked life', { timeout: 60_000 }, () => {
  const guest: AccountState = { kind: 'guest', userId: 'u', notice: null };
  const account: Account = { state: () => guest, subscribe: () => () => {}, start: async () => {}, keepWithGoogle: async () => true, useExistingAccount: async () => true, dismissNotice: () => {}, signOut: async () => false };
  /** The game over sessions of both kinds, and a server of ranked lives on the day it says it is. */
  function rankedGame() {
    const server = rankedServer();
    const store = new MemoryStore();
    let ids = 0;
    let clock = 0;
    const deps = { newId: () => `local-${(ids += 1)}`, newSeed: () => `seed-${ids}`, now: () => (clock += 1) };
    const versions = { engine: ENGINE_VERSION, content: CONTENT_VERSION };
    const sessions = new GameSessions(store, new LocalSessions(store, content, lives, deps), new RankedSessions(() => server.api, store, content, lives, versions, deps), versions);
    return { server, services: { sessions, store, account, tapGuardMs: 0 } };
  }

  it('says at the end of a ranked life that it is in the rankings, and leads to them; a casual life says nothing of them', async () => {
    const ranked = rankedGame();
    await playRounds(await ranked.services.sessions.start('nurse', { ranked: true }), content.rounds);
    renderGame(<End />, ranked.services);
    expect(await screen.findByRole('heading', { name: 'The end' })).toBeTruthy();
    const link = screen.getByRole('link', { name: 'This life is ranked: see the rankings' });
    expect(within(screen.getByRole('group', { name: 'Score' })).getByRole('link', { name: 'This life is ranked: see the rankings' })).toBe(link);
    fireEvent.click(link);
    expect(router.push).toHaveBeenCalledWith('/en/rankings');
    cleanup();

    const casual = rankedGame();
    await playRounds(await casual.services.sessions.start('nurse'), content.rounds);
    renderGame(<End />, casual.services);
    expect(await screen.findByRole('heading', { name: 'The end' })).toBeTruthy();
    expect(screen.queryByText(/in the rankings/)).toBeNull();
    expect(screen.queryByRole('link', { name: /see the rankings/ })).toBeNull();
  });

  it('says nothing of the week\'s ranking at the end of a practice of the challenge, and asks nothing of it', async () => {
    const week = challengeOf(weekOf(Date.now()), lives);
    if (!week) throw new Error('no challenge this week');
    const services = memoryServices();
    await playRounds(await services.sessions.start(week.lifeId, { challenge: week.week }), content.rounds);
    const asked: string[] = [];
    const community = { compare: async () => null, challengeRanking: async () => (asked.push('ranking'), null), challengeChoices: async () => (asked.push('choices'), null) } as unknown as Community;
    renderGame(<End />, { ...services, account, community: () => community });
    expect(await screen.findByRole('heading', { name: 'The end' })).toBeTruthy();
    await settled();
    expect(screen.queryByText(/^Place \d+ of \d+/)).toBeNull();
    expect(asked).toEqual([]);
  });

  it('says where the week\'s attempt stands among everyone\'s, at the end of a ranked life of the week\'s challenge', async () => {
    const SERVER_NOW = Date.UTC(2026, 9, 13, 12);
    const served = challengeOf(weekOf(SERVER_NOW), lives);
    if (!served) throw new Error('no challenge the server\'s week');
    const { services } = rankedGame();
    await playRounds(await services.sessions.start(served.lifeId, { ranked: true, challenge: served.week }), content.rounds);
    const asked: string[] = [];
    const community = {
      compare: async () => null,
      challengeRanking: async (week: string) => (asked.push(week), { rows: [{ place: 2, userId: 'u', nickname: null, score: 900, finishedAt: 0, mine: true }], entrants: 30 }),
      challengeChoices: async () => [],
    } as unknown as Community;
    renderGame(<End />, { ...services, now: () => SERVER_NOW, community: () => community });
    expect(await screen.findByText('Place 2 of 30 · Top 10%')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'This life is ranked: see the rankings' })).toBeTruthy();
    expect(asked).toContain(served.week);
  });
});
