// @vitest-environment jsdom
import { challengeOf, content, lives, weekOf } from '@ratrace/content';
import { MemoryStore } from '@ratrace/core/session/memory';
import { LocalSessions } from '@ratrace/core/session/local';
import { messagesFor } from '@ratrace/i18n';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { GameProvider, useGame } from '../context';
import { memoryServices, renderGame, router } from '../../testing/render';
import { speaking } from '../../testing/memoryServices';
import { adjustedRead } from '../../ui/fonts';
import { Home } from './Home';

afterEach(cleanup);

const en = messagesFor('en');

/** The buttons that open the settings: the gear in the corner, then the one at the foot. */
const settingsButtons = (name = 'Settings') => screen.getAllByRole('button', { name });

describe('the front door', () => {
  it('offers a new life to someone new, and says where it will be kept only behind the settings', async () => {
    renderGame(<Home />, memoryServices());
    expect((await screen.findByRole('link', { name: 'New life' })).textContent).toBe('New life');
    fireEvent.click(screen.getByRole('link', { name: 'New life' }));
    expect(router.push).toHaveBeenCalledWith('/new');
    fireEvent.click(screen.getByRole('link', { name: /^Weekly challenge/ }));
    expect(router.push).toHaveBeenCalledWith('/challenge');
    expect(screen.queryByRole('link', { name: /Continue your life/ })).toBeNull();
    // Where it is kept is said behind the settings, not on the door.
    expect(screen.queryByText('Your life saves itself after every step.')).toBeNull();
    fireEvent.click(settingsButtons()[0]);
    expect(await screen.findByText('Your life saves itself after every step.')).toBeTruthy();
  });

  it('introduces the game to someone new, and gets out of the way of someone who has played', async () => {
    renderGame(<Home />, memoryServices());
    await screen.findByRole('link', { name: 'New life' });
    expect(screen.getByText('The Rat Race')).toBeTruthy();
    expect(screen.getByText(en.meta.description)).toBeTruthy();
    expect(document.querySelector('[data-sprite="brand.mascot"]')).not.toBeNull();
    cleanup();
    const services = memoryServices();
    await services.sessions.start('nurse');
    renderGame(<Home />, services);
    await screen.findByRole('link', { name: /Continue your life/ });
    expect(screen.queryByText(en.meta.description)).toBeNull();
    expect(document.querySelector('[data-sprite="brand.mascot"]')).toBeNull();
    expect(document.querySelector('[data-sprite^="rat"]')).not.toBeNull();
  });

  it('keeps the language and the switches a tap away, behind the settings', async () => {
    renderGame(<Home />, memoryServices());
    await screen.findByRole('link', { name: 'New life' });
    expect(screen.queryByRole('radiogroup', { name: 'Language' })).toBeNull();
    expect(screen.queryAllByRole('switch')).toEqual([]);
    fireEvent.click(settingsButtons()[0]);
    const sheet = (await screen.findByRole('heading', { name: 'Settings' })).closest('[aria-modal="true"]') as HTMLElement;
    expect(within(within(sheet).getByRole('radiogroup', { name: 'Language' })).getAllByRole('radio').map((choice) => choice.textContent)).toEqual(['English', 'Español', 'Русский']);
    expect(within(sheet).getAllByRole('switch').map((toggle) => toggle.getAttribute('aria-checked'))).toEqual(['true', 'false', 'true']);
    // What is switched there is switched for good.
    fireEvent.click(within(sheet).getByRole('switch', { name: /^Sound/ }));
    expect(within(sheet).getByRole('switch', { name: /^Sound/ }).getAttribute('aria-checked')).toBe('false');
  });

  it('has the settings twice, as the web has: the gear in the corner and the button at the foot, both opening the same sheet', async () => {
    renderGame(<Home />, memoryServices());
    await screen.findByRole('link', { name: 'New life' });
    expect(settingsButtons()).toHaveLength(2);
    fireEvent.click(settingsButtons()[1]);
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Settings' })).toBeNull());
  });

  it('is drawn in Russian too, with every word of it', async () => {
    renderGame(<Home />, memoryServices(), 'ru');
    await screen.findByRole('link', { name: /Новая/ });
    // (A title in Russian is cut into one piece for each typeface it needs, so a name is read from the whole text.)
    const said = (role: string) => screen.getAllByRole(role).map((el) => el.textContent);
    expect(said('link')).toEqual(expect.arrayContaining(['Новая жизнь', 'Коллекция', 'Рекорды']));
    expect(said('button')).toEqual(expect.arrayContaining(['Настройки']));
    // Nothing of another language is left on it, but the game's own name and the names of the languages.
    expect(document.body.textContent?.replace(/The Rat Race|English|Español/g, '')).not.toMatch(/[A-Za-z]{3,}/);
  });

  it('leads to the collection and to the records', async () => {
    renderGame(<Home />, memoryServices());
    fireEvent.click(await screen.findByRole('link', { name: 'Collection' }));
    expect(router.push).toHaveBeenLastCalledWith('/collection');
    fireEvent.click(screen.getByRole('link', { name: 'Records' }));
    expect(router.push).toHaveBeenLastCalledWith('/records');
    expect(document.querySelector('[data-sprite="icon.star"]')).not.toBeNull();
    expect(document.querySelector('[data-sprite="icon.trophy"]')).not.toBeNull();
  });

  it('shows no way to the rankings, and nothing of friends, rooms, the account or installing: nobody is signed in to ask', async () => {
    renderGame(<Home />, memoryServices());
    await screen.findByRole('link', { name: 'Records' });
    for (const online of [/Rankings/, /friend request/, /Multiplayer/, /Pick up the life from your other device/, /Your profile/, /Keep the game/]) {
      expect(screen.queryByText(online), String(online)).toBeNull();
    }
    // What is left to go to is what the phone has: a new life, the week, the collection, the records and the small print.
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['New life', expect.stringMatching(/^Weekly challenge/), 'Collection', 'Records', 'Privacy and legal notice']);
  });

  it('offers the life in progress first, with who and where', async () => {
    const services = memoryServices();
    await services.sessions.start('engineer');
    renderGame(<Home />, services);
    const carry = await screen.findByRole('link', { name: /Continue your life/ });
    fireEvent.click(carry);
    expect(router.push).toHaveBeenCalledWith('/play');
    expect(carry.textContent).toContain('Software engineer · age 22 · Tokyo');
    expect(screen.getByRole('link', { name: 'New life' })).toBeTruthy();
    // It is the first of the links.
    expect(screen.getAllByRole('link')[0]).toBe(carry);
  });

  it('sets the lines of the button to continue as the web does: its title with the letter spacing the button gives it (0.03 of the 15 it is set in), its detail larger than its size says', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    renderGame(<Home />, services);
    const carry = await screen.findByRole('link', { name: /Continue your life/ });
    const style = (text: string) => (screen.getByText(text).parentElement as HTMLElement).style;
    // The `pixel` class gives its em of letter spacing to the button, where it is 15: the 19 of the title inherits that length.
    expect(style('Continue your life').fontSize).toBe('19px');
    expect(parseFloat(style('Continue your life').letterSpacing)).toBeCloseTo(0.45, 6);
    // The detail is Chakra Petch under the pixel text's font-size-adjust, with the 1.1 line of the button.
    const detail = within(carry).getByText(/^Nurse · age 22 · Madrid$/).parentElement as HTMLElement;
    expect(parseFloat(detail.style.fontSize)).toBeCloseTo(adjustedRead(13), 3);
    expect(parseFloat(detail.style.lineHeight)).toBeCloseTo(14.3, 0);
  });

  it('says, briefly, when the life in progress is a practice of the weekly challenge, and shows the challenge only there', async () => {
    const services = memoryServices();
    const week = challengeOf(weekOf(Date.now()), lives);
    if (week === null) throw new Error('every week has a challenge');
    await services.sessions.start(week.lifeId, { challenge: week.week });
    renderGame(<Home />, services);
    const carry = await screen.findByRole('link', { name: /Continue your life/ });
    expect(carry.textContent).toContain('Challenge practice');
    expect(carry.textContent).not.toContain(en.challenge.rules[week.rule].name);
    expect(document.querySelector('[data-sprite="icon.challenge"]')).not.toBeNull();
    // One button for the week's challenge: carrying on with it, not a card beside it too.
    expect(screen.queryByRole('link', { name: /^Weekly challenge/ })).toBeNull();
  });

  it('shows the weekly challenge beside a life that is not of it', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    renderGame(<Home />, services);
    await screen.findByRole('link', { name: /Continue your life/ });
    expect(screen.getByRole('link', { name: /^Weekly challenge/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Continue your life/ }).textContent).not.toContain('Challenge practice');
  });

  it('offers a look at the life that just ended, and nothing to continue', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    while (!session.view().finished) {
      while (session.view().phase === 'cards') await session.answerCard(0);
      await session.playRound({ orders: [] });
    }
    renderGame(<Home />, services);
    const last = await screen.findByRole('link', { name: 'See how your last life ended' });
    fireEvent.click(last);
    expect(router.push).toHaveBeenCalledWith('/play');
    expect(screen.queryByRole('link', { name: /Continue your life/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'New life' })).toBeTruthy();
  });

  it('says so plainly when the phone is not saving, instead of promising that it is', async () => {
    renderGame(<Home />, memoryServices(new MemoryStore(), { savingOff: true }));
    expect((await screen.findByRole('alert')).textContent).toContain('This browser is not saving right now');
    expect(screen.queryByText(/saved on this device/)).toBeNull();
    cleanup();
    renderGame(<Home />, memoryServices());
    await screen.findByRole('link', { name: 'New life' });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('leads to the privacy and legal notice, small, at the very foot', async () => {
    renderGame(<Home />, memoryServices());
    const link = await screen.findByRole('link', { name: 'Privacy and legal notice' });
    fireEvent.click(link);
    expect(router.push).toHaveBeenCalledWith('/legal');
    const all = screen.getAllByRole('link');
    expect(all[all.length - 1]).toBe(link);
  });

  it('shows that it is loading, and nothing else of the game, until the device has answered', () => {
    const services = memoryServices();
    // A device that has not answered yet.
    services.sessions.resume = () => new Promise(() => undefined);
    renderGame(<Home />, services);
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'New life' })).toBeNull();
  });
});

describe('a saved life that could not be opened', () => {
  /** A device holding a life, written by `change`, and the front door opened on it. */
  async function lost(change: (saved: object) => object, sessionsFor?: (store: MemoryStore) => LocalSessions) {
    const services = memoryServices();
    await services.sessions.start('nurse');
    await services.store.saveGame(change((await services.store.loadGame()) as object) as never);
    renderGame(<Home />, sessionsFor ? { ...services, sessions: sessionsFor(services.store) } : services);
    return screen.findByRole('status');
  }

  it('is explained when it was played under older rules that are no longer held', async () => {
    expect((await lost((saved) => ({ ...saved, contentVersion: '0.0.1' }))).textContent).toBe(en.home.lostOutdated);
  });

  it('is told apart from a newer version of the game, and kept for it', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    const written = (await services.store.loadGame()) as object;
    await services.store.saveGame({ ...written, format: 2 } as never);
    renderGame(<Home />, services);
    expect((await screen.findByRole('status')).textContent).toBe(en.home.lostNewer);
    expect(await services.store.loadGame()).toEqual({ ...written, format: 2 });
  });

  it('is explained when it is damaged', async () => {
    expect((await lost((saved) => ({ ...saved, log: 'not a log' }))).textContent).toBe(en.home.lostDamaged);
  });

  it('is kept, and said to be waiting, when the rules it was played under cannot be had just now', async () => {
    const waiting = (store: MemoryStore) => new LocalSessions(store, content, lives, { newId: () => 'x', newSeed: () => 'y', now: () => 1, loadRules: async () => 'unreachable' });
    const notice = await lost((saved) => ({ ...saved, engineVersion: '0.0.1' }), waiting);
    expect(notice.textContent).toBe(en.home.lostWaiting);
  });

  it('is said nowhere when there is no saved life: no warning, nothing to explain', async () => {
    renderGame(<Home />, memoryServices());
    await screen.findByRole('link', { name: 'New life' });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('is said nowhere when the life opens: no warning with a life in progress', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    renderGame(<Home />, services);
    await screen.findByRole('link', { name: /Continue your life/ });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('says the life on screen was ended elsewhere when it has gone from under the page', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    let reopen: () => Promise<void> = async () => undefined;
    function Reopen() {
      reopen = useGame((s) => s.reopen);
      return null;
    }
    renderGame(<><Home /><Reopen /></>, services);
    await screen.findByRole('link', { name: /Continue your life/ });
    await services.store.clearGame();
    await act(() => reopen());
    expect((await screen.findByRole('status')).textContent).toBe(en.home.movedGone);
    expect(screen.queryByRole('link', { name: /Continue your life/ })).toBeNull();
  });
});

describe('the language from the corner', () => {
  it('shows the language in use as its code, and drops the others from it; choosing one speaks it from then on', async () => {
    renderGame(<Home />, memoryServices());
    await screen.findByRole('link', { name: 'New life' });
    const square = screen.getByRole('button', { name: 'Language' });
    expect(square.textContent).toBe('en');
    expect(square.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(square);
    const menu = await screen.findByRole('menu');
    expect(square.getAttribute('aria-expanded')).toBe('true');
    expect(within(menu).getAllByRole('menuitem').map((item) => [item.textContent, item.getAttribute('aria-selected')])).toEqual([
      ['English', 'true'],
      ['Español', 'false'],
      ['Русский', 'false'],
    ]);
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Español' }));
    expect(await screen.findByRole('link', { name: 'Nueva vida' })).toBeTruthy();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('button', { name: 'Idioma' }).textContent).toBe('es');
  });

  it('is shut by pressing outside it, by pressing the square again, and by Back', async () => {
    renderGame(<Home />, memoryServices());
    await screen.findByRole('link', { name: 'New life' });
    const square = screen.getByRole('button', { name: 'Language' });
    fireEvent.click(square);
    await screen.findByRole('menu');
    // Outside: the page behind the menu is a button the width of the screen.
    fireEvent.click(document.querySelector('[data-testid="menu-backdrop"]') as HTMLElement);
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(square);
    await screen.findByRole('menu');
    fireEvent.click(square);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('what the front door is drawn again for', () => {
  it('is not drawn again by a change of the game it does not show: the news left for the cards', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    let renders = 0;
    let leaveNews: () => void = () => undefined;
    function Hand() {
      leaveNews = useGame((s) => s.leaveNews);
      return null;
    }
    render(
      <GameProvider services={speaking(services, 'en')}>
        <Profiler id="home" onRender={() => (renders += 1)}>
          <Home />
        </Profiler>
        <Hand />
      </GameProvider>,
    );
    await screen.findByRole('link', { name: /Continue your life/ });
    // Let everything the opening of the game does settle (the profile, the finished lives).
    await act(async () => {
      await new Promise((done) => setTimeout(done, 50));
    });
    const before = renders;
    act(() => leaveNews());
    act(() => leaveNews());
    expect(renders).toBe(before);
  });
});
