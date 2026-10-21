// @vitest-environment jsdom
import { content, lives } from '@ratrace/content';
import { memoryBasket } from '@ratrace/core/game/basket';
import { LocalSessions } from '@ratrace/core/session/local';
import type { GameSession, PlayerStore, SavedGame } from '@ratrace/core/session/types';
import type { Order } from '@ratrace/engine';
import { messagesFor } from '@ratrace/i18n';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AccessibilityInfo, Platform } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KvStore } from '../../kvStore';
import { memoryServices, pressBack, renderGame, router, spriteRenders } from '../../testing/render';
import { speaking } from '../../testing/memoryServices';
import { settled } from '../../testing/renders';
import { GameProvider, TAP_GUARD_MS, useGame } from '../context';
import type { Services } from '../context';
import { phoneBasket } from '../phoneBasket';
import { Home } from './Home';
import { Play } from './Play';

afterEach(cleanup);

const en = messagesFor('en');
const button = (name: string | RegExp) => screen.getByRole('button', { name });
/** The stage of the round on screen: a region named for what it is, for someone who cannot see it change. */
const stage = () => screen.getByRole('main');
const stageIs = (name: string | RegExp) => waitFor(() => expect(stage().getAttribute('aria-label')).toMatch(name));
const saved = async (store: PlayerStore) => (await store.loadGame()) as SavedGame;
const choices = () => within(screen.getByRole('group', { name: /^Your choices/ })).getAllByRole('button');

/** Answers every card of the hand with its first choice shown, reading each result on the way, and stops in the finances. */
async function answerHand() {
  for (;;) {
    await waitFor(() => expect(screen.getByRole('group', { name: /^Your choices/ })).toBeTruthy());
    fireEvent.click(choices()[0]);
    await stageIs('What happened');
    const next = screen.queryByRole('button', { name: 'Next card' });
    if (next) fireEvent.click(next);
    else {
      fireEvent.click(button('To your finances'));
      return;
    }
  }
}

/** Plays whole rounds without the screen. */
async function playRounds(session: GameSession, rounds: number) {
  for (let i = 0; i < rounds; i++) {
    while (session.view().phase === 'cards') await session.answerCard(0);
    await session.playRound({ orders: [] });
  }
}

/** A session that answers as the one on the device does, with some of its answers changed. */
function realSession(real: GameSession, change: Partial<GameSession> = {}): GameSession {
  return { gameId: real.gameId, lifeId: real.lifeId, view: () => real.view(), history: () => real.history(), bankruptcies: () => 0, story: () => [], badges: () => [], answerCard: (option) => real.answerCard(option), playRound: (choices) => real.playRound(choices), ...change };
}

describe('the play screen', () => {
  it('sends a visitor with no life in progress back to the front door', async () => {
    renderGame(<Play />, memoryServices());
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/'));
    expect(screen.queryByRole('button', { name: 'Play the round' })).toBeNull();
  });

  it('keeps, where the HUD is compact, the place of a crisis\'s strip under the figures even with no crisis: the stage stands 8 + 12 under them, as on the web (its `mt-2` slot is there all the same)', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    renderGame(<Play />, services);
    await screen.findByRole('heading', { name: 'News' });
    // The news: no strip, and no place for one (the web draws neither).
    expect(stage().previousElementSibling?.textContent).toBe('Nurse, age 22');
    fireEvent.click(button('See what life brings'));
    await stageIs(/^Card 1 of/);
    // The cards of a round with no crisis: an empty place, which the page's gap of 8 stands on either side of, as the web's empty `mt-2` does.
    const slot = stage().previousElementSibling as HTMLElement;
    expect(slot.textContent).toBe('');
    expect(slot.children).toHaveLength(0);
    expect(slot.previousElementSibling?.textContent).toBe('Nurse, age 22');
  });

  it('plays a round from the news to the ledger, and opens the next one', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    renderGame(<Play />, services);

    expect(await screen.findByRole('heading', { name: 'News' })).toBeTruthy();
    expect(screen.getAllByText('Age 22').length).toBeGreaterThan(0);
    // Who lives the life, by name, above it.
    expect(screen.getAllByText('Lucía').length).toBeGreaterThan(0);
    // Every headline is a clipping that says what it is about, in a word and a picture.
    const clippings = within(screen.getByRole('region', { name: 'News' })).getAllByRole('listitem');
    const news = (await saved(services.store)).state.timeline[0].news;
    expect(news.length).toBeGreaterThan(0);
    const SUBJECT = { regime: 'Economy', crypto: 'Crypto', rates: 'Interest rates', inflation: 'Inflation', property: 'Housing', asset: 'Markets', taxes: 'Taxes', noise: 'Society', government: 'Government' };
    expect(clippings.map((clipping) => clipping.querySelector('[data-topic]')?.textContent)).toEqual(news.map((headline) => SUBJECT[headline.topic].toUpperCase()));
    for (const clipping of clippings) expect(clipping.querySelector('[data-sprite]')).not.toBeNull();
    expect(screen.getByText(/^Round 1 of 20 · Madrid/)).toBeTruthy();
    // One top heading says whose life this is; the stage on screen is a region named for what it is.
    expect(screen.getByRole('heading', { name: 'Nurse, age 22' })).toBeTruthy();
    expect(stage().getAttribute('aria-label')).toBe('News');
    expect(screen.getByRole('progressbar', { name: 'Rat race escape' })).toBeTruthy();

    fireEvent.click(button('See what life brings'));
    expect(screen.getByText(/^Card 1 of \d/)).toBeTruthy();
    await stageIs(/^Card 1 of \d/);
    await answerHand();

    await stageIs('Your finances');
    expect(screen.getByText('Cash after the round')).toBeTruthy();
    expect(button('No orders')).toBeTruthy();
    fireEvent.click(button('Play the round'));

    await stageIs('Two years later');
    expect((await saved(services.store)).state.round).toBe(1);
    fireEvent.click(button('Next round'));
    expect(await screen.findByRole('heading', { name: 'News' })).toBeTruthy();
    expect(screen.getAllByText('Age 24').length).toBeGreaterThan(0);
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('carries on in the middle of a hand, on the card that was waiting', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    const hand = session.view().hand.length;
    await session.answerCard(0);
    renderGame(<Play />, services);
    expect(await screen.findByText(new RegExp(`^Card 2 of ${hand}`))).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'News' })).toBeNull();
  });

  it('plays in Spanish', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    renderGame(<Play />, services, 'es');
    expect(await screen.findByRole('heading', { name: 'Noticias' })).toBeTruthy();
    expect(screen.getAllByText('22 años').length).toBeGreaterThan(0);
  });

  it('says why the screen changed when the life was played on somewhere else: on a phone, another device', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    renderGame(<Play />, services);
    await screen.findByRole('button', { name: 'See what life brings' });

    // Another game on the same device's store plays a whole round.
    const other = (await memoryServices(services.store).sessions.resume()).session as GameSession;
    await playRounds(other, 1);

    fireEvent.click(button('See what life brings'));
    fireEvent.click(choices()[0]);
    expect((await screen.findByRole('alert')).textContent).toBe(en.phone.moved);
    expect(en.phone.moved).not.toMatch(/tab/);
    expect(screen.getAllByText('Age 24').length).toBeGreaterThan(0);
    expect(button('See what life brings')).toBeTruthy();
  });

  it('offers a way out when the game itself fails, instead of a button that does nothing', async () => {
    const services = memoryServices();
    const real = await services.sessions.start('nurse');
    services.sessions.resume = async () => ({ lost: null, session: realSession(real, { answerCard: () => Promise.reject(new Error('broken')), playRound: () => Promise.reject(new Error('broken')) }) });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderGame(<Play />, services);
    fireEvent.click(await screen.findByRole('button', { name: 'See what life brings' }));
    fireEvent.click(choices()[0]);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Something went wrong');
    expect(alert.textContent).toContain('Your life is saved as it stood before this step');
    // A new life takes the place of the screen that failed; home is the front door, wherever it is in the stack.
    fireEvent.click(screen.getByRole('link', { name: 'New life' }));
    expect(router.replace).toHaveBeenCalledWith('/new');
    fireEvent.click(screen.getByRole('link', { name: 'Home' }));
    expect(router.dismissTo).toHaveBeenCalledWith('/');
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it('asks before a round that would run the cash out onto the credit card, and plays it only if asked again', async () => {
    const basket = memoryBasket();
    const services = { ...memoryServices(), basket };
    const session = await services.sessions.start('nurse');
    while (session.view().phase === 'cards') await session.answerCard(0);
    // A life above the nurse's pay, planned before the page was closed.
    basket.save(session.gameId, 0, [{ type: 'setLifestyle', tier: 2 } as Order]);
    renderGame(<Play />, services);
    await stageIs('Your finances');
    expect(button('1 order')).toBeTruthy();

    fireEvent.click(button('Play the round'));
    const sheet = (await screen.findByRole('heading', { name: 'Before you play the round' })).closest('[aria-modal="true"]') as HTMLElement;
    const warning = within(sheet).getByRole('listitem').textContent ?? '';
    expect(warning).toMatch(/^You are \$[\d,.]+ short: it goes on the credit card, at /);
    expect(warning).toContain('22');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Review' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Before you play the round' })).toBeNull());
    expect((await saved(services.store)).state.round).toBe(0);

    fireEvent.click(button('Play the round'));
    fireEvent.click(within((await screen.findByRole('heading', { name: 'Before you play the round' })).closest('[aria-modal="true"]') as HTMLElement).getByRole('button', { name: 'Play anyway' }));
    await stageIs('Two years later');
    expect((await saved(services.store)).state.round).toBe(1);
  });
});

describe('the guide of a first life', () => {
  it('gives one tip a stage, each read once, and remembered', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    renderGame(<Play />, services);

    const tip = await screen.findByRole('note', { name: 'Guide' });
    expect(tip.textContent).toContain('Every round opens with the paper');
    fireEvent.click(within(tip).getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('note', { name: 'Guide' })).toBeNull();
    await waitFor(async () => expect((await services.store.loadProfile()).guide).toEqual({ seen: ['news'], off: false }));

    fireEvent.click(button('See what life brings'));
    expect((await screen.findByRole('note', { name: 'Guide' })).textContent).toContain('Life deals you a few cards');
    // On a card the choices come first: a tip must never push them off a small screen.
    const group = screen.getByRole('group', { name: /^Your choices/ });
    expect(group.compareDocumentPosition(screen.getByRole('note', { name: 'Guide' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Left unread, a tip is still there the next time its stage comes round.
    fireEvent.click(choices()[0]);
    await stageIs('What happened');
    expect(screen.queryByRole('note', { name: 'Guide' })).toBeNull();

    // Opened again later, on the next card: what was read stays read, and what was not is offered again.
    cleanup();
    renderGame(<Play />, memoryServices(services.store));
    expect(await screen.findByText(/^Card 2 of/)).toBeTruthy();
    expect((await screen.findByRole('note', { name: 'Guide' })).textContent).toContain('Life deals you a few cards');
    expect((await services.store.loadProfile()).guide.seen).toEqual(['news']);
  });

  it('turns the guide off for good when asked to', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    renderGame(<Play />, services);
    fireEvent.click(within(await screen.findByRole('note', { name: 'Guide' })).getByRole('button', { name: 'Skip the guide' }));
    expect(screen.queryByRole('note', { name: 'Guide' })).toBeNull();
    fireEvent.click(button('See what life brings'));
    expect(screen.getByText(/^Card 1 of \d/)).toBeTruthy();
    expect(screen.queryByRole('note', { name: 'Guide' })).toBeNull();
    await waitFor(async () => expect((await services.store.loadProfile()).guide.off).toBe(true));
  });

  it('does not guide someone who has already lived a life', async () => {
    const services = memoryServices();
    await playRounds(await services.sessions.start('nurse'), 20);
    await services.sessions.start('engineer');
    renderGame(<Play />, services);
    await screen.findByRole('button', { name: 'See what life brings' });
    // Give the device time to answer about past lives: the guide waits for that before it speaks.
    await waitFor(async () => expect(await services.store.listRuns()).toHaveLength(1));
    await settled();
    expect(screen.queryByRole('note', { name: 'Guide' })).toBeNull();
  });

  it('says nothing until the device has said whether a life was ever finished', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    // The device never answers about past lives: for all the screen knows, this is a veteran.
    services.store.listRuns = () => new Promise(() => {});
    renderGame(<Play />, services);
    await screen.findByRole('button', { name: 'See what life brings' });
    await settled();
    expect(screen.queryByRole('note', { name: 'Guide' })).toBeNull();
  });

  it('gives one tip a visit: the next in line waits for the next visit to the stage', async () => {
    const services = memoryServices();
    // The stage tips are read; the ones that wait for the second round are not.
    await services.store.saveProfile({ ...(await services.store.loadProfile()), guide: { seen: ['news', 'cards', 'finance', 'ledger', 'ratRace'], off: false } });
    const session = await services.sessions.start('nurse');
    await playRounds(session, 1);
    while (session.view().phase === 'cards') await session.answerCard(0);
    renderGame(<Play />, services);
    const tip = await screen.findByRole('note', { name: 'Guide' });
    expect(tip.textContent).toContain('Cash earns nothing');
    fireEvent.click(within(tip).getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('note', { name: 'Guide' })).toBeNull();
    await waitFor(async () => expect((await services.store.loadProfile()).guide.seen).toContain('invest'));
  });
});

describe('a tap too many', () => {
  /**
   * The clock the game tells a second tap from a first by (`performance.now`), held still and moved by the test: what is "at once" and what
   * is "a moment later" are then the test's to say, however busy the machine is.
   */
  function heldClock() {
    let now = 10_000;
    const spy = vi.spyOn(performance, 'now').mockImplementation(() => now);
    return { later: (ms: number) => void (now += ms), restore: () => spy.mockRestore() };
  }

  it('ignores the second tap of a double tap: it does not answer the card that took the button’s place', async () => {
    const clock = heldClock();
    try {
      // The guard the app plays with.
      const services = memoryServices(undefined, { tapGuardMs: TAP_GUARD_MS });
      await services.sessions.start('nurse');
      renderGame(<Play />, services);
      const begin = await screen.findByRole('button', { name: 'See what life brings' });
      fireEvent.click(begin);
      fireEvent.click(begin);
      expect(screen.getByText(/^Card 1 of \d/)).toBeTruthy();
      // Whatever now sits under the thumb was pressed at once, and nothing was answered.
      clock.later(50);
      fireEvent.click(choices()[0]);
      await settled();
      expect(stage().getAttribute('aria-label')).toMatch(/^Card 1 of/);
      expect((await saved(services.store)).state.answered).toBe(0);
      // A deliberate tap, a moment later, is taken.
      clock.later(TAP_GUARD_MS);
      fireEvent.click(choices()[0]);
      await stageIs('What happened');
    } finally {
      clock.restore();
    }
  });

  it('plays a round once for a double tap on its button, and does not skip the ledger with the tap after', async () => {
    const clock = heldClock();
    try {
      const services = memoryServices(undefined, { tapGuardMs: TAP_GUARD_MS });
      const session = await services.sessions.start('nurse');
      while (session.view().phase === 'cards') await session.answerCard(0);
      renderGame(<Play />, services);
      await stageIs('Your finances');
      clock.later(TAP_GUARD_MS + 50);
      const play = button('Play the round');
      fireEvent.click(play);
      fireEvent.click(play);
      await stageIs('Two years later');
      // The button that took its place is not pressed by the tail of the same tap.
      clock.later(50);
      fireEvent.click(button('Next round'));
      await settled();
      expect(stage().getAttribute('aria-label')).toBe('Two years later');
      const save = await saved(services.store);
      expect(save.state.round).toBe(1);
      expect(save.log.filter((entry) => entry.orders !== null)).toHaveLength(1);
      // A moment later it is.
      clock.later(TAP_GUARD_MS);
      fireEvent.click(button('Next round'));
      expect(await screen.findByRole('heading', { name: 'News' })).toBeTruthy();
    } finally {
      clock.restore();
    }
  });
});

describe('a screen reader', () => {
  it.each(['ios', 'android'] as const)('is told on %s which stage has opened, as the web hands the stage the focus for every screen reader', async (os) => {
    const was = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    const said = vi.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    try {
      const services = memoryServices();
      await services.sessions.start('nurse');
      renderGame(<Play />, services);
      fireEvent.click(await screen.findByRole('button', { name: 'See what life brings' }));
      await stageIs(/^Card 1 of/);
      expect(said).toHaveBeenCalledWith(expect.stringMatching(/^Card 1 of \d/));
      // Not on opening the screen: the screen itself is what is new, and says so.
      expect(said).toHaveBeenCalledTimes(1);
    } finally {
      said.mockRestore();
      Object.defineProperty(Platform, 'OS', { value: was, configurable: true });
    }
  });
});

describe('Android\'s Back', () => {
  it('goes home from a life being played, and the life stays saved where it was', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    await session.answerCard(0);
    renderGame(<Play />, services);
    await screen.findByText(/^Card 2 of/);
    const before = await saved(services.store);
    expect(pressBack()).toBe('screen');
    expect(router.dismissTo).toHaveBeenCalledWith('/');
    expect(router.replace).not.toHaveBeenCalled();
    expect(await saved(services.store)).toEqual(before);
  });

  it('closes a sheet that is open first, and stays on the life', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    renderGame(<Play />, services);
    fireEvent.click(await screen.findByRole('button', { name: /Cash/ }));
    expect(screen.getByRole('heading', { name: 'Cash' })).toBeTruthy();
    expect(pressBack()).toBe('sheet');
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Cash' })).toBeNull());
    expect(router.dismissTo).not.toHaveBeenCalled();
    // The next press is the screen's: home.
    expect(pressBack()).toBe('screen');
    expect(router.dismissTo).toHaveBeenCalledWith('/');
  });

  it('leaves the app from the front door, and nothing of the life listens once it is gone', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    const { unmount } = renderGame(<Play />, services);
    await screen.findByRole('button', { name: 'See what life brings' });
    unmount();
    renderGame(<Home />, services);
    await screen.findByRole('link', { name: /Continue your life/ });
    expect(pressBack()).toBe('left');
    expect(router.dismissTo).not.toHaveBeenCalled();
  });
});

describe('the app killed in the middle of a round', () => {
  /** The game as the phone keeps it: its device's store and the basket kept beside it, both in the phone's key-value store. */
  function phoneGame(): Services {
    let ids = 0;
    let clock = 1_000;
    const store = new KvStore();
    const sessions = new LocalSessions(store, content, lives, { newId: () => `id-${(ids += 1)}`, newSeed: () => `screen-seed-${ids}`, now: () => (clock += 1) });
    return { sessions, store, tapGuardMs: 0, basket: phoneBasket };
  }

  /** The round store's actions, as the screen's own buttons would take them. */
  let act_: { addOrder(order: Order): boolean } | null = null;
  function Hands() {
    const addOrder = useGame((s) => s.addOrder);
    act_ = { addOrder };
    return null;
  }

  it('opens again on the same round and stage: on the card that was waiting', async () => {
    const first = phoneGame();
    const session = await first.sessions.start('nurse');
    const hand = session.view().hand.length;
    await session.answerCard(0);
    render(<GameProvider services={speaking(first, 'en')}><Play /></GameProvider>);
    await screen.findByText(new RegExp(`^Card 2 of ${hand}`));
    cleanup();
    // The app starts again: a new game on what the phone kept.
    render(<GameProvider services={speaking(phoneGame(), 'en')}><Play /></GameProvider>);
    expect(await screen.findByText(new RegExp(`^Card 2 of ${hand}`))).toBeTruthy();
    expect(screen.getAllByText('Age 22').length).toBeGreaterThan(0);
  });

  it('opens again in the finances with the orders already put in the basket', async () => {
    const first = phoneGame();
    const session = await first.sessions.start('nurse');
    while (session.view().phase === 'cards') await session.answerCard(0);
    render(
      <GameProvider services={speaking(first, 'en')}>
        <Play />
        <Hands />
      </GameProvider>,
    );
    await stageIs('Your finances');
    await settled(() => void act_!.addOrder({ type: 'setLifestyle', tier: 2 } as Order));
    expect(button('1 order')).toBeTruthy();
    cleanup();
    render(<GameProvider services={speaking(phoneGame(), 'en')}><Play /></GameProvider>);
    await stageIs('Your finances');
    expect(button('1 order')).toBeTruthy();
    expect(screen.getAllByText('Age 22').length).toBeGreaterThan(0);
  });
});

describe('the calendar between rounds', () => {
  it('turns a page as a round is played, from the age that was to the age that is', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    while (session.view().phase === 'cards') await session.answerCard(0);
    renderGame(<Play />, services);
    await stageIs('Your finances');
    // Not on opening a life already under way.
    expect(document.querySelector('[data-motion-only]')).toBeNull();
    fireEvent.click(button('Play the round'));
    await stageIs('Two years later');
    const calendar = document.querySelector('[data-motion-only]') as HTMLElement;
    expect(calendar.querySelector('[data-page="torn"]')?.textContent).toContain('22');
    expect(calendar.querySelector('[data-page="new"]')?.textContent).toContain('24');
  });

  it('turns none where motion is left out', async () => {
    const services = memoryServices();
    await services.store.saveProfile({ ...(await services.store.loadProfile()), settings: { ...(await services.store.loadProfile()).settings, reducedMotion: true } });
    const session = await services.sessions.start('nurse');
    while (session.view().phase === 'cards') await session.answerCard(0);
    renderGame(<Play />, services);
    await stageIs('Your finances');
    await settled();
    fireEvent.click(button('Play the round'));
    await stageIs('Two years later');
    expect(document.querySelector('[data-motion-only]')).toBeNull();
  });
});

describe('what is drawn again', () => {
  it('does not draw the Hud’s portrait row again for a change of stage it does not show', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    let play: { leaveNews(): void; pick(option: number): Promise<void>; afterCard(): void } | null = null;
    function Hands() {
      const leaveNews = useGame((s) => s.leaveNews);
      const pick = useGame((s) => s.pick);
      const afterCard = useGame((s) => s.afterCard);
      play = { leaveNews, pick, afterCard };
      return null;
    }
    render(
      <GameProvider services={speaking(services, 'en')}>
        <Play />
        <Hands />
      </GameProvider>,
    );
    await screen.findByRole('button', { name: 'See what life brings' });
    await settled(() => play!.leaveNews());
    await stageIs(/^Card 1 of/);
    // The portrait's row draws its portrait and its settings square: counted each time it is drawn.
    const portrait = 'portrait.nurse.22';
    const drawn = () => [spriteRenders.get(portrait), spriteRenders.get('icon.settings')];
    const before = drawn();
    expect(before[0]).toBeGreaterThan(0);
    // The nurse's first card, a freelance gig taken: the cash moves, nothing the portrait's row shows does; the stage turns to its result.
    await settled(() => play!.pick(1));
    await stageIs('What happened');
    // And on to the next card: the stage turns again, and nothing of the round moves.
    await settled(() => play!.afterCard());
    await stageIs(/^Card 2 of/);
    expect(drawn()).toEqual(before);
  });
});
