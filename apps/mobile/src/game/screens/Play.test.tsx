// @vitest-environment jsdom
import { content, lives, textFor } from '@ratrace/content';
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
import { painted } from '../../ui/testing/skia';
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
    expect(await screen.findByRole('heading', { name: 'Two years later' })).toBeTruthy();
    expect(screen.getByText('Age 22 to 24')).toBeTruthy();
    const ledger = screen.getByRole('table', { name: 'What came in and went out' });
    expect(within(ledger).getByText('Salary')).toBeTruthy();
    expect(within(ledger).getByText('Living costs')).toBeTruthy();
    // Where the net worth was and how it changed, said so it cannot be read as before and after.
    expect(screen.getByText(/^Was \$[\d,]+$/)).toBeTruthy();
    expect((await saved(services.store)).state.round).toBe(1);
    fireEvent.click(button('Next round'));
    expect(await screen.findByRole('heading', { name: 'News' })).toBeTruthy();
    expect(screen.getAllByText('Age 24').length).toBeGreaterThan(0);
    // How last round's headlines turned out is not told: working that out is the player's.
    expect(screen.queryByRole('heading', { name: "Last round's headlines" })).toBeNull();
    expect(screen.queryByText(/seven in ten/)).toBeNull();
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('announces a life unlocked by a step that earned no badge', async () => {
    const services = memoryServices();
    const real = await services.sessions.start('nurse');
    services.sessions.resume = async () => ({ lost: null, session: realSession(real, { answerCard: async (option: number) => ({ ...(await real.answerCard(option)), earned: [], unlocked: ['heir'] }) }) });
    renderGame(<Play />, services);
    fireEvent.click(await screen.findByRole('button', { name: 'See what life brings' }));
    fireEvent.click(choices()[0]);
    await screen.findByRole('heading', { name: 'What happened' });
    const news = screen.getAllByRole('status').map((note) => note.textContent ?? '');
    expect(news.some((text) => text.includes('New life unlocked') && text.includes('Heir'))).toBe(true);
    expect(news.some((text) => text.includes('Badge earned'))).toBe(false);
  });

  it('celebrates a badge on the ledger of the round that earned it, and the life a round unlocked', async () => {
    const services = memoryServices();
    const real = await services.sessions.start('nurse');
    // A round that earns a badge and unlocks a life, whatever is played.
    services.sessions.resume = async () => ({
      lost: null,
      session: realSession(real, { badges: () => ['millionaire'], playRound: async (choices) => ({ ...(await real.playRound(choices)), earned: ['millionaire'], unlocked: ['heir'] }) }),
    });
    renderGame(<Play />, services);
    fireEvent.click(await screen.findByRole('button', { name: 'See what life brings' }));
    await answerHand();
    await stageIs('Your finances');
    fireEvent.click(button('Play the round'));
    await screen.findByRole('heading', { name: 'Two years later' });
    const news = screen.getAllByRole('status').map((note) => note.textContent ?? '');
    expect(news.some((text) => text.includes('Badge earned') && text.includes('Millionaire') && text.includes('Be worth a million'))).toBe(true);
    expect(news.some((text) => text.includes('New life unlocked') && text.includes('Heir'))).toBe(true);
    // Gone with the ledger: the next round opens without them.
    fireEvent.click(button('Next round'));
    await screen.findByRole('button', { name: 'See what life brings' });
    expect(screen.queryByText('Badge earned')).toBeNull();
  });

  it('counts the orders of the round and lets one be taken back', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    while (session.view().phase === 'cards') await session.answerCard(0);
    renderGame(<Play />, services);

    // An order of the portfolio's (the web's test turns on a course in the Lifestyle tab, which is Task 14's): half the cash to savings.
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    const save = screen.getByRole('heading', { name: 'Move cash to savings' }).closest('[aria-modal="true"]') as HTMLElement;
    fireEvent.click(within(save).getByRole('button', { name: '50%' }));
    fireEvent.click(within(save).getByRole('button', { name: /^Confirm/ }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Move cash to savings' })).toBeNull());
    fireEvent.click(button('1 order'));
    const basket = screen.getByRole('heading', { name: "This round's orders" }).closest('[aria-modal="true"]') as HTMLElement;
    fireEvent.click(within(basket).getByRole('button', { name: /^Remove: Save / }));
    expect(within(basket).getByText(/Nothing yet/)).toBeTruthy();
    // Taken back, it can be put back until the basket changes again: once, and then the offer is gone.
    fireEvent.click(within(basket).getByRole('button', { name: 'Undo' }));
    expect(within(basket).getByText(/^Save /)).toBeTruthy();
    fireEvent.click(within(basket).getByRole('button', { name: /^Remove: Save / }));
    // Android's Back closes it, as the web's Escape does.
    expect(pressBack()).toBe('sheet');
    await waitFor(() => expect(screen.queryByRole('heading', { name: "This round's orders" })).toBeNull());
    expect(button('No orders')).toBeTruthy();
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

  it('says it over a sheet that is open, in the sheet\'s own window, as the web\'s notice stands over its sheets', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    let hands: { leaveNews(): void; pick(option: number): Promise<void> } | null = null;
    function Hands() {
      const leaveNews = useGame((s) => s.leaveNews);
      const pick = useGame((s) => s.pick);
      hands = { leaveNews, pick };
      return null;
    }
    render(
      <GameProvider services={speaking(services, 'en')}>
        <Play />
        <Hands />
      </GameProvider>,
    );
    await screen.findByRole('button', { name: 'See what life brings' });
    const other = (await memoryServices(services.store).sessions.resume()).session as GameSession;
    await playRounds(other, 1);
    await settled(() => hands!.leaveNews());
    // The cash's sheet open over the page; the step the game takes under it finds the life moved on.
    fireEvent.click(screen.getByRole('button', { name: /Cash/ }));
    const sheet = screen.getByRole('heading', { name: 'Cash' }).closest('[aria-modal="true"]') as HTMLElement;
    await settled(() => hands!.pick(0));
    const notice = await screen.findByRole('alert');
    expect(notice.textContent).toBe(en.phone.moved);
    expect(sheet.contains(notice)).toBe(true);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
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

describe('the profile', () => {
  it('opens from the portrait, and closes again', async () => {
    const services = memoryServices();
    await services.sessions.start('engineer');
    renderGame(<Play />, services);

    fireEvent.click(await screen.findByRole('button', { name: 'Open your profile' }));
    const profile = screen.getByRole('heading', { name: 'Your life' }).closest('[aria-modal="true"]') as HTMLElement;
    // A panel's title is set in capitals, as the web's stylesheet sets it.
    for (const label of ['WORK', 'Finance', 'Focus this round', 'INCOME STATEMENT, PER YEAR', 'BALANCE SHEET', 'Net worth']) {
      expect(within(profile).getByText(label), label).toBeTruthy();
    }
    expect(within(profile).getByRole('link', { name: /Leave to the home screen/ })).toBeTruthy();
    expect(pressBack()).toBe('sheet');
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Your life' })).toBeNull());
    expect(router.dismissTo).not.toHaveBeenCalled();
  });
});

describe('the end of a life', () => {
  /** A panel by the name it is given (a screen reader's region; the web's `section aria-label`). */
  const panel = (name: string) => screen.getByLabelText(name);

  it('ends on the score, with the way to another life', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('civil_servant');
    await playRounds(session, 19);
    renderGame(<Play />, services);

    fireEvent.click(await screen.findByRole('button', { name: 'See what life brings' }));
    await answerHand();
    fireEvent.click(await screen.findByRole('button', { name: 'Play the round' }));
    fireEvent.click(await screen.findByRole('button', { name: 'See how it ended' }));

    expect(await screen.findByRole('heading', { name: 'The end' })).toBeTruthy();
    expect(screen.getByText('Age 62 · Civil servant · Madrid')).toBeTruthy();
    // The life on one line, from its first age to its last, with what happened on the way in words.
    const line = panel('Your life on one line');
    expect(within(line).getByText('22 years old')).toBeTruthy();
    expect(within(line).getByText('62 years old')).toBeTruthy();
    const [run] = await services.store.listRuns();
    expect(run.history).toHaveLength(21);
    const score = screen.getByRole('group', { name: 'Score' });
    // The score counts up as it is shown; it is read out as it ends, from words only a screen reader hears.
    const full = new Intl.NumberFormat('en-US').format(run.score);
    expect(within(score).getAllByText(full).length).toBeGreaterThan(0);
    expect(within(score).getByText('Wealth')).toBeTruthy();
    expect(within(score).getByText('Status')).toBeTruthy();
    expect(within(score).getByText(String(run.status))).toBeTruthy();
    expect(screen.getByRole('img', { name: /Your net worth through life/ })).toBeTruthy();

    // A first life lived to the end: its badges are shown, and the life it unlocked.
    const earned = panel('Badges of this life');
    expect(run.badges.length).toBeGreaterThan(0);
    expect(within(earned).getAllByRole('listitem')).toHaveLength(run.badges.length);
    expect(within(earned).getAllByText('New').length).toBe(run.badges.length);
    // Two a row and named only: what a badge asks is in its sheet.
    const [first] = run.badges;
    const badgeText = textFor('en').text.badges[first];
    expect(within(earned).queryByText(badgeText.how)).toBeNull();
    fireEvent.click(within(earned).getByRole('button', { name: new RegExp(`^${badgeText.name}`) }));
    const sheet = screen.getByRole('heading', { name: badgeText.name }).closest('[aria-modal="true"]') as HTMLElement;
    expect(within(sheet).getByText(badgeText.how)).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: badgeText.name })).toBeNull());
    expect(screen.getByText('New life unlocked: Delivery rider')).toBeTruthy();
    // The life unlocked gets a card of its own, with a way to begin it at once.
    const card = panel('A new life is open');
    expect(within(card).getByText(/Delivery rider is open to you/)).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Try it now' })).toBeTruthy();
    // Nothing to beat in a first life, so no personal best is claimed.
    expect(screen.queryByText('New best score')).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'See your collection' }));
    expect(router.push).toHaveBeenCalledWith('/collection');

    // The picture to share is shown to someone else: it speaks of the life, not to the player. No sprite arrives in a test: each is left out.
    fireEvent.click(screen.getByRole('button', { name: 'Share this life' }));
    await screen.findByRole('img', { name: /^Civil servant: score/ });
    const written = painted.calls.filter(([kind]) => kind === 'text').map((call) => call[2]);
    expect(written.join('')).toContain(run.escapedAtRound === null ? 'Never left the rat race' : `Out of the rat race at ${22 + run.escapedAtRound * 2}`);
    expect(written.some((words) => /\byou\b/i.test(String(words)))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'A picture of this life' })).toBeNull());

    // The two ways out: another life, in place of this screen, and the front door.
    fireEvent.click(screen.getByRole('link', { name: 'Live another life' }));
    expect(router.replace).toHaveBeenCalledWith('/new');
    fireEvent.click(screen.getByRole('link', { name: 'Home' }));
    expect(router.dismissTo).toHaveBeenCalledWith('/');

    // The app is closed on the score and opened again: the score is still there.
    expect((await saved(services.store)).state.finished).toBe(true);
    cleanup();
    renderGame(<Play />, memoryServices(services.store));
    expect(await screen.findByRole('heading', { name: 'The end' })).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Score' })).getAllByText(full).length).toBeGreaterThan(0);

    // The card offers the life it unlocked, and "Try it now" starts it, on this very screen.
    fireEvent.click(within(panel('A new life is open')).getByRole('button', { name: 'Try it now' }));
    expect(await screen.findByRole('heading', { name: 'News' })).toBeTruthy();
    expect((await saved(services.store)).lifeId).toBe('rider');
    expect(router.push).not.toHaveBeenCalledWith('/new');
  });

  it('marks a second life that beats the first', async () => {
    const services = memoryServices();
    // A first life that went badly: lavish on a nurse's pay.
    const poor = await services.sessions.start('nurse');
    for (let i = 0; i < 20; i++) {
      while (poor.view().phase === 'cards') await poor.answerCard(0);
      await poor.playRound({ orders: [{ type: 'setLifestyle', tier: 3 }] });
    }
    const better = await services.sessions.start('nurse');
    await playRounds(better, 20);
    const runs = await services.store.listRuns();
    expect(runs[0].score).toBeGreaterThan(runs[1].score);
    renderGame(<Play />, services);
    expect(await screen.findByRole('heading', { name: 'The end' })).toBeTruthy();
    expect(await screen.findByText('New best score')).toBeTruthy();
    expect(screen.getByText('Your richest life yet')).toBeTruthy();
    // The rider was unlocked by the first life, not by this one.
    expect(screen.queryByText(/New life unlocked/)).toBeNull();
  });
});
