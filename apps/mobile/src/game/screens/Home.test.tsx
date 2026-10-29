// @vitest-environment jsdom
import { challengeOf, content, CONTENT_VERSION, lives, weekOf } from '@ratrace/content';
import { MemoryStore } from '@ratrace/core/session/memory';
import { LocalSessions } from '@ratrace/core/session/local';
import { rankedNote, RankedSessions } from '@ratrace/core/session/ranked';
import type { RankedApi } from '@ratrace/core/session/ranked';
import { GameSessions } from '@ratrace/core/session/sessions';
import { ENGINE_VERSION } from '@ratrace/engine';
import { messagesFor } from '@ratrace/i18n';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Account, AccountLife, AccountSaves, AccountState, Community } from '@ratrace/online/types';
import { afterEach, describe, expect, it } from 'vitest';
import { GameProvider, useGame } from '../context';
import { rankedServer } from '../../../../web/src/testing/rankedServer';
import { focus, network } from '../../testing/fakes';
import { memoryServices, renderGame, router } from '../../testing/render';
import { Counted, settled, steady } from '../../testing/renders';
import type { Renders } from '../../testing/renders';
import { speaking } from '../../testing/memoryServices';
import { adjustedRead } from '../../ui/fonts';
import { sheetOpened } from '../../ui/back';
import { Home, pictureSide } from './Home';

afterEach(cleanup);

const en = messagesFor('en');

/** The buttons that open the settings: the gear in the corner, the only one. */
const settingsButtons = (name = 'Settings') => screen.getAllByRole('button', { name });

describe('the front door', () => {
  it('offers a new life to someone new, and says where it will be kept only behind the settings', async () => {
    renderGame(<Home />, memoryServices());
    expect((await screen.findByRole('link', { name: 'New life' })).textContent).toBe('New life');
    fireEvent.click(screen.getByRole('link', { name: 'New life' }));
    expect(router.push).toHaveBeenCalledWith('/en/new');
    fireEvent.click(screen.getByRole('link', { name: /^Weekly challenge/ }));
    expect(router.push).toHaveBeenCalledWith('/en/challenge');
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
    // Sound on, a press's click off (the phone's own), less motion off, the guide's tips on.
    expect(within(sheet).getAllByRole('switch').map((toggle) => toggle.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false', 'true']);
    // What is switched there is switched for good.
    fireEvent.click(within(sheet).getByRole('switch', { name: /^Sound/ }));
    expect(within(sheet).getByRole('switch', { name: /^Sound/ }).getAttribute('aria-checked')).toBe('false');
  });

  it('has the settings once, behind the gear in the corner: no row at the foot takes the room the door needs', async () => {
    renderGame(<Home />, memoryServices());
    await screen.findByRole('link', { name: 'New life' });
    expect(settingsButtons()).toHaveLength(1);
    expect(settingsButtons()[0].querySelector('[data-sprite="icon.settings"]')).not.toBeNull();
    // The gear comes first, before the door's buttons, for a keyboard and a screen reader as for the eye.
    expect(settingsButtons()[0].compareDocumentPosition(screen.getByRole('link', { name: 'New life' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(settingsButtons()[0]);
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Settings' })).toBeNull());
  });

  it('is drawn in Russian too, with every word of it', async () => {
    renderGame(<Home />, memoryServices(), 'ru');
    await screen.findByRole('link', { name: /Новая/ });
    // (A title in Russian is cut into one piece for each typeface it needs, so a name is read from the whole text.)
    const said = (role: string) => screen.getAllByRole(role).map((el) => el.textContent);
    expect(said('link')).toEqual(expect.arrayContaining(['Новая жизнь', 'Коллекция', 'История']));
    expect(screen.getByRole('button', { name: 'Настройки' })).toBeTruthy();
    // Nothing of another language is left on it, but the game's own name and the names of the languages.
    expect(document.body.textContent?.replace(/The Rat Race|English|Español/g, '')).not.toMatch(/[A-Za-z]{3,}/);
  });

  it('leads to the collection and to the records', async () => {
    renderGame(<Home />, memoryServices());
    const collection = await screen.findByRole('link', { name: 'Collection' });
    fireEvent.click(collection);
    expect(router.push).toHaveBeenLastCalledWith('/en/collection');
    const records = screen.getByRole('link', { name: 'History' });
    fireEvent.click(records);
    expect(router.push).toHaveBeenLastCalledWith('/en/records');
    expect(collection.querySelector('[data-sprite="icon.star"]')).not.toBeNull();
    expect(records.querySelector('[data-sprite="icon.trophy"]')).not.toBeNull();
  });

  it('shows no way to the rankings, and nothing of friends, rooms, the account or installing: nobody is signed in to ask', async () => {
    renderGame(<Home />, memoryServices());
    await screen.findByRole('link', { name: 'History' });
    for (const online of [/Rankings/, /friend request/, /Multiplayer/, /Pick up the life from your other device/, /Your profile/, /Keep the game/]) {
      expect(screen.queryByText(online), String(online)).toBeNull();
    }
    // What is left to go to is what the phone has: a new life, the week, the collection and the records (the small print is in the settings).
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['New life', expect.stringMatching(/^Weekly challenge/), 'Collection', 'History']);
  });

  it('offers the life in progress first, with who and where', async () => {
    const services = memoryServices();
    await services.sessions.start('engineer');
    renderGame(<Home />, services);
    const carry = await screen.findByRole('link', { name: /Continue your life/ });
    fireEvent.click(carry);
    expect(router.push).toHaveBeenCalledWith('/en/play');
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

  it('offers nothing of the life that just ended: its look back is in the records', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    while (!session.view().finished) {
      while (session.view().phase === 'cards') await session.answerCard(0);
      await session.playRound({ orders: [] });
    }
    renderGame(<Home />, services);
    expect(await screen.findByRole('link', { name: 'New life' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Continue your life/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /last life/ })).toBeNull();
    // Nothing else to go to but what the door always has.
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['New life', expect.stringMatching(/^Weekly challenge/), 'Collection', 'History']);
  });

  it('says so plainly when the phone is not saving, instead of promising that it is', async () => {
    renderGame(<Home />, memoryServices(new MemoryStore(), { savingOff: true }));
    expect((await screen.findByRole('alert')).textContent).toBe(en.phone.notSaved);
    expect(en.phone.notSaved).toContain('This phone is not saving right now');
    expect(screen.queryByText(/saved on this device/)).toBeNull();
    cleanup();
    renderGame(<Home />, memoryServices());
    await screen.findByRole('link', { name: 'New life' });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps its corner to the settings alone: the language is chosen in them, as a phone app\'s', async () => {
    renderGame(<Home />, memoryServices());
    await screen.findByRole('link', { name: 'New life' });
    expect(screen.queryByRole('button', { name: 'Language' })).toBeNull();
    fireEvent.click(settingsButtons()[0]);
    const sheet = (await screen.findByRole('heading', { name: 'Settings' })).closest('[aria-modal="true"]') as HTMLElement;
    expect(within(sheet).getByRole('radiogroup', { name: 'Language' })).toBeTruthy();
  });

  it('leads to the privacy and legal notice from the foot of the settings, opened once they have gone, and has none at its own foot', async () => {
    renderGame(<Home />, memoryServices());
    await screen.findByRole('link', { name: 'New life' });
    expect(screen.queryByRole('link', { name: 'Privacy and legal notice' })).toBeNull();
    fireEvent.click(settingsButtons()[0]);
    const sheet = (await screen.findByRole('heading', { name: 'Settings' })).closest('[aria-modal="true"]') as HTMLElement;
    const link = within(sheet).getByRole('link', { name: 'Privacy and legal notice' });
    // Under every switch and the account's deletion, over the version.
    expect(link.compareDocumentPosition(within(sheet).getByText(/^Version/)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(link);
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Settings' })).toBeNull());
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/en/legal'));
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

describe('the picture on top of the door', () => {
  it('takes the room the rest of the door leaves it, in whole points, no larger than its art and no smaller than its least', () => {
    expect(pictureSide(400, 256, 96)).toBe(256);
    expect(pictureSide(180.7, 256, 96)).toBe(180);
    expect(pictureSide(40, 256, 96)).toBe(96);
    expect(pictureSide(0, 128, 64)).toBe(64);
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
    expect((await screen.findByRole('status')).textContent).toBe(en.phone.lostNewer);
    expect(await services.store.loadGame()).toEqual({ ...written, format: 2 });
  });

  it('is explained when it is damaged', async () => {
    expect((await lost((saved) => ({ ...saved, log: 'not a log' }))).textContent).toBe(en.home.lostDamaged);
  });

  it('is kept, and said to be waiting, when the rules it was played under cannot be had just now', async () => {
    const waiting = (store: MemoryStore) => new LocalSessions(store, content, lives, { newId: () => 'x', newSeed: () => 'y', now: () => 1, loadRules: async () => 'unreachable' });
    const notice = await lost((saved) => ({ ...saved, engineVersion: '0.0.1' }), waiting);
    expect(notice.textContent).toBe(en.phone.lostWaiting);
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
    expect((await screen.findByRole('status')).textContent).toBe(en.phone.movedGone);
    expect(screen.queryByRole('link', { name: /Continue your life/ })).toBeNull();
  });
});

describe('what the front door is drawn again for', () => {
  it('is not drawn again by a change of the game it does not show: the news left, a card answered, with the device read again after each step', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    const renders: Renders = { count: 0 };
    let play: { leaveNews(): void; pick(option: number): Promise<void> } | null = null;
    function Hand() {
      const leaveNews = useGame((s) => s.leaveNews);
      const pick = useGame((s) => s.pick);
      play = { leaveNews, pick };
      return null;
    }
    render(
      <GameProvider services={speaking(services, 'en')}>
        <Counted into={renders}>
          <Home />
        </Counted>
        <Hand />
      </GameProvider>,
    );
    await screen.findByRole('link', { name: /Continue your life/ });
    // Let everything the opening of the game does settle (the profile, the finished lives): until the drawings stop changing.
    await steady(() => renders.count);
    const before = renders.count;
    // The news are left and a card answered: the round on screen and the view change, the profile and the lives are read again from the device.
    await settled(async () => {
      play!.leaveNews();
      await play!.pick(0);
    });
    expect(renders.count).toBe(before);
    // And another step.
    await settled(() => play!.leaveNews());
    expect(renders.count).toBe(before);
  });
});

/** An account holding a different life, which remembers what it was asked and does it. */
function accountWith(life: AccountLife | null, take: () => Promise<void> = async () => {}) {
  let offered = life;
  let status: 'saved' | 'sending' = 'saved';
  const watching = new Set<() => void>();
  const asked: string[] = [];
  const told = () => {
    for (const listener of [...watching]) listener();
  };
  const offer = (next: AccountLife | null) => {
    offered = next;
    told();
  };
  const saves: AccountSaves = {
    status: () => status,
    offer: () => offered,
    subscribe: (listener) => (watching.add(listener), () => watching.delete(listener)),
    onDeviceChanged: () => () => {},
    takeOffer: async () => {
      asked.push('take');
      await take();
      offer(null);
      return true;
    },
    declineOffer: async () => {
      asked.push('decline');
      offer(null);
    },
  };
  /** The account's copy on its way and back, as it goes with every step of a life: nothing the front door draws. */
  const sending = (next: 'saved' | 'sending') => {
    status = next;
    told();
  };
  return { saves, asked, offer, sending };
}
const elsewhere: AccountLife = { gameId: 'g-9', lifeId: 'engineer', round: 4, cityId: 'madrid' };
const OFFER = { name: /Pick up the life from your other device/ };
/** The sheet with this title. */
const sheetTitled = (title: string) => screen.getByRole('heading', { name: title }).closest('[aria-modal="true"]') as HTMLElement;

describe('the life waiting in the account', () => {
  it('offers nothing from the account when it holds no other life', async () => {
    renderGame(<Home />, memoryServices());
    await screen.findByRole('link', { name: 'New life' });
    expect(screen.queryByRole('button', OFFER)).toBeNull();
  });

  it('offers the life waiting in the account, and asks before it ends the one on this phone', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    // Taking it puts the account's life on the phone, as the real thing does.
    const other = memoryServices();
    const { saves, asked } = accountWith(elsewhere, async () => {
      await other.sessions.start('engineer');
      await services.store.saveGame((await other.store.loadGame()) as never);
    });
    renderGame(<Home />, { ...services, saves });
    const offer = await screen.findByRole('button', OFFER);
    expect(offer.textContent).toContain('Software engineer · age 30 · Madrid');
    // Nothing has been asked of the account yet, and the life on this phone is still the one to continue.
    expect(asked).toEqual([]);
    expect(screen.getByRole('link', { name: /Continue your life/ }).textContent).toContain('Nurse');

    // Whether the question was still there when the game was opened.
    const pushedWithSheet: boolean[] = [];
    router.push.mockImplementation(() => void pushedWithSheet.push(screen.queryByRole('heading', { name: 'A life on another device' }) !== null));
    fireEvent.click(offer);
    const sheet = sheetTitled('A life on another device');
    expect(sheet.textContent).toContain('Picking it up here ends the life on this device: Nurse, age 22.');
    // A sheet still leaving, as an iOS Modal takes a moment to dismiss: the game waits for it.
    const leaving = sheetOpened();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Pick it up here' }));
    await waitFor(() => expect(asked).toEqual(['take']));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'A life on another device' })).toBeNull());
    await new Promise((done) => setTimeout(done, 50));
    expect(router.push).not.toHaveBeenCalled();
    // The sheets gone, the game is opened, and the question was not there.
    act(() => leaving());
    await waitFor(() => expect(pushedWithSheet).toEqual([false]));
    expect(router.push).toHaveBeenCalledWith('/en/play');
    expect(asked).toEqual(['take']);
    // The game on screen is the one that was taken.
    expect(screen.getByRole('link', { name: /Continue your life/ }).textContent).toContain('Software engineer');
    expect(screen.queryByRole('button', OFFER)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'A life on another device' })).toBeNull();
  });

  it('lets the player end the life in the account instead, and keeps the one on this phone', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    const { saves, asked, offer } = accountWith(elsewhere);
    renderGame(<Home />, { ...services, saves });
    fireEvent.click(await screen.findByRole('button', OFFER));
    fireEvent.click(within(sheetTitled('A life on another device')).getByRole('button', { name: 'End it' }));
    expect(asked).toEqual(['decline']);
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'A life on another device' })).toBeNull());
    expect(screen.queryByRole('button', OFFER)).toBeNull();
    expect(screen.getByRole('link', { name: /Continue your life/ }).textContent).toContain('Nurse');
    expect(router.push).not.toHaveBeenCalled();
    // Another life offered later is offered: the question does not ask itself.
    act(() => offer({ ...elsewhere, gameId: 'g-10', round: 7 }));
    expect(screen.getByRole('button', OFFER).textContent).toContain('age 36');
    expect(screen.queryByRole('heading', { name: 'A life on another device' })).toBeNull();
  });

  it('does not open the question by itself for another life, after the one it was asked about went away under it', async () => {
    const { saves, offer } = accountWith(elsewhere);
    renderGame(<Home />, { ...memoryServices(), saves });
    fireEvent.click(await screen.findByRole('button', OFFER));
    expect(sheetTitled('A life on another device')).toBeTruthy();
    // The other device ends that life while the sheet is open.
    act(() => offer(null));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'A life on another device' })).toBeNull());
    // Later the account brings another. It is offered; "End it" is not put in front of anyone unasked.
    act(() => offer({ ...elsewhere, gameId: 'g-11', lifeId: 'nurse' }));
    expect(screen.getByRole('button', OFFER).textContent).toContain('Nurse');
    expect(screen.queryByRole('heading', { name: 'A life on another device' })).toBeNull();
  });

  it('shows the life the account brings after the front door has opened', async () => {
    const { saves, offer } = accountWith(null);
    renderGame(<Home />, { ...memoryServices(), saves });
    await screen.findByRole('link', { name: 'New life' });
    expect(screen.queryByRole('button', OFFER)).toBeNull();
    act(() => offer(elsewhere));
    expect(screen.getByRole('button', OFFER)).toBeTruthy();
  });

  it('warns of nothing when no life is being lived on this phone', async () => {
    const { saves } = accountWith(elsewhere);
    renderGame(<Home />, { ...memoryServices(), saves }, 'es');
    fireEvent.click(await screen.findByRole('button', { name: /Seguir la vida de tu otro dispositivo/ }));
    const sheet = sheetTitled('Tienes una vida en otro dispositivo');
    expect(sheet.textContent).toContain('Ingeniero de software, 30 años, en Madrid. La dejaste en otro dispositivo.');
    expect(sheet.textContent).not.toContain('se acaba la que tienes');
  });

  it('is not drawn again, the front door, for the account\'s copy going and coming with each step', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    const { saves, sending } = accountWith(null);
    const renders: Renders = { count: 0 };
    render(
      <GameProvider services={speaking({ ...services, saves }, 'en')}>
        <Counted into={renders}>
          <Home />
        </Counted>
      </GameProvider>,
    );
    await screen.findByRole('link', { name: /Continue your life/ });
    await steady(() => renders.count);
    const before = renders.count;
    await settled(() => sending('sending'));
    await settled(() => sending('saved'));
    expect(renders.count).toBe(before);
  });
});

describe('the account at the foot of the front door', () => {
  /** An account that only says who is playing. */
  const accountAs = (state: AccountState) => ({
    state: () => state,
    subscribe: () => () => {},
    start: async () => undefined,
    keepWithGoogle: async () => false,
    useExistingAccount: async () => false,
    dismissNotice: () => undefined,
    signOut: async () => false,
  });

  it('shows a guest the way into Google at the foot, and nothing else there: no profile, no settings, said where things are kept only for a phone with no account', async () => {
    renderGame(<Home />, { ...memoryServices(), account: accountAs({ kind: 'guest', userId: 'u', notice: null }) });
    await screen.findByRole('link', { name: 'New life' });
    const foot = screen.getByRole('region', { name: 'Account' });
    expect(within(foot).getByRole('button', { name: 'Sign in with Google' })).toBeTruthy();
    expect(within(foot).queryAllByRole('link')).toEqual([]);
    expect(screen.queryByRole('link', { name: 'Your profile' })).toBeNull();
    expect(within(foot).queryByRole('button', { name: 'Settings' })).toBeNull();
    // At the foot with no frame round it, as the web's: no box of the settings holds the account.
    expect(foot.closest('[aria-label="Settings"]')).toBeNull();
    // No way out of the account on the front door itself: that is in the settings.
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
    fireEvent.click(settingsButtons()[0]);
    const sheet = sheetTitled('Settings');
    expect(within(sheet).getByRole('region', { name: 'Account' })).toBeTruthy();
    expect(within(sheet).queryByText('Your life saves itself after every step.')).toBeNull();
  });

  it('shows a member their profile where the way into Google was, and says they are kept, and offers to sign out, in the settings', async () => {
    renderGame(<Home />, { ...memoryServices(), account: accountAs({ kind: 'member', userId: 'u', email: 'ana.garcia@example.com' }) });
    await screen.findByRole('link', { name: 'New life' });
    const foot = screen.getByRole('region', { name: 'Account' });
    expect(within(foot).getByRole('link', { name: 'Your profile' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sign in with Google' })).toBeNull();
    expect(foot.textContent).not.toContain('Linked to Google');
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
    fireEvent.click(settingsButtons()[0]);
    const sheet = sheetTitled('Settings');
    expect(within(sheet).getByRole('region', { name: 'Account' }).textContent).toContain('Linked to Google');
    expect(within(sheet).getByRole('button', { name: 'Sign out' })).toBeTruthy();
  });

  it('shows no account at the foot of a phone with no account: nothing to sign in to, no profile', async () => {
    renderGame(<Home />, memoryServices());
    await screen.findByRole('link', { name: 'New life' });
    expect(screen.queryByRole('region', { name: 'Account' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sign in with Google' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Your profile' })).toBeNull();
  });
});

describe('the front door of a player with an account', () => {
  /** An account that only says who is playing, and lets a test change it; `settled` false while it is still signing in at a start. */
  function accountOf(initial: AccountState, settled = true) {
    let state = initial;
    let done = settled;
    const watching = new Set<() => void>();
    const account: Account = {
      state: () => state,
      settled: () => done,
      subscribe: (listener) => (watching.add(listener), () => watching.delete(listener)),
      start: async () => undefined,
      keepWithGoogle: async () => false,
      useExistingAccount: async () => false,
      dismissNotice: () => undefined,
      signOut: async () => false,
    };
    const become = (next: AccountState) => {
      state = next;
      done = true;
      act(() => watching.forEach((listener) => listener()));
    };
    return { account, become };
  }
  const GUEST: AccountState = { kind: 'guest', userId: 'u-guest', notice: null };
  const MEMBER: AccountState = { kind: 'member', userId: 'u-member', email: null };

  /**
   * The account's copy as the phone's mirror tells of it: not read yet (the start's reading under way), until the test reads it: the device then
   * holds what the account brought (`deviceChanged`), and those who wait are told it has been read.
   */
  function readingAccount() {
    let read = false;
    const changes = new Set<(what: 'game') => void>();
    const reads = new Set<() => void>();
    const saves = {
      status: () => 'sending' as const,
      offer: () => null,
      subscribe: () => () => undefined,
      onDeviceChanged: (listener: (what: 'game') => void) => (changes.add(listener), () => void changes.delete(listener)),
      takeOffer: async () => false,
      declineOffer: async () => undefined,
      lifeRead: () => read,
      onLifeRead: (listener: () => void) => (reads.add(listener), () => void reads.delete(listener)),
    };
    const readNow = () =>
      act(() => {
        changes.forEach((listener) => listener('game'));
        read = true;
        reads.forEach((listener) => listener());
      });
    return { saves: saves as unknown as AccountSaves, readNow };
  }

  /** A life on this phone a round behind the account's copy of it, played further on another device. */
  async function behind(services: ReturnType<typeof memoryServices>) {
    const session = await services.sessions.start('engineer');
    const older = await services.store.loadGame();
    while (session.view().phase === 'cards') await session.answerCard(0);
    await session.playRound({ orders: [] });
    const newer = await services.store.loadGame();
    await services.store.saveGame(older as never);
    return { newer, newerRound: session.view().round };
  }

  it('never continues a life at a round another device has played past: pressed while the account is read, it waits, then opens the further copy', async () => {
    const services = memoryServices();
    const { newer, newerRound } = await behind(services);
    const cloud = readingAccount();
    let roundNow: number | null = null;
    function Round() {
      roundNow = useGame((s) => s.view?.round ?? null);
      return null;
    }
    const opened: Array<number | null> = [];
    router.push.mockImplementation(() => void opened.push(roundNow));
    try {
      renderGame(
        <>
          <Home />
          <Round />
        </>,
        { ...services, account: accountOf(MEMBER).account, saves: cloud.saves },
      );
      const carry = await screen.findByRole('link', { name: /Continue your life/ });
      const before = carry.textContent;
      expect(roundNow).toBe(newerRound - 1);
      fireEvent.click(carry);
      // Waiting for the account: the button still there, its detail the web's word for loading, nothing opened.
      expect(router.push).not.toHaveBeenCalled();
      expect(carry.textContent).toContain('Loading…');
      // The account read: it brought the further copy, which the device now holds and the game opens; the line says where it is now, and Play opens it.
      await services.store.saveGame(newer as never);
      cloud.readNow();
      await waitFor(() => expect(router.push).toHaveBeenCalledWith('/en/play'));
      expect(opened).toEqual([newerRound]);
      expect(screen.getByRole('link', { name: /Continue your life/ }).textContent).not.toBe(before);
    } finally {
      router.push.mockReset();
    }
  });

  it('waits too while the account is still signing in (a stored session run out, renewed over the network): the older round is not continued', async () => {
    const services = memoryServices();
    const { newer, newerRound } = await behind(services);
    const cloud = readingAccount();
    const signing = accountOf({ kind: 'offline' }, false);
    let roundNow: number | null = null;
    function Round() {
      roundNow = useGame((s) => s.view?.round ?? null);
      return null;
    }
    const opened: Array<number | null> = [];
    router.push.mockImplementation(() => void opened.push(roundNow));
    try {
      renderGame(
        <>
          <Home />
          <Round />
        </>,
        { ...services, account: signing.account, saves: cloud.saves },
      );
      fireEvent.click(await screen.findByRole('link', { name: /Continue your life/ }));
      expect(router.push).not.toHaveBeenCalled();
      // Signed in: still waiting, now for the account to be read for the life.
      signing.become(MEMBER);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(router.push).not.toHaveBeenCalled();
      await services.store.saveGame(newer as never);
      cloud.readNow();
      await waitFor(() => expect(router.push).toHaveBeenCalledWith('/en/play'));
      expect(opened).toEqual([newerRound]);
    } finally {
      router.push.mockReset();
    }
  });

  it('drops Continue once the wait is over if the player has left the front door meanwhile', async () => {
    const services = memoryServices();
    await services.sessions.start('engineer');
    const cloud = readingAccount();
    const { unmount } = renderGame(<Home />, { ...services, account: accountOf(MEMBER).account, saves: cloud.saves });
    fireEvent.click(await screen.findByRole('link', { name: /Continue your life/ }));
    // Elsewhere (the front door no longer in front): the account read after that takes nobody to Play.
    unmount();
    cloud.readNow();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(router.push).not.toHaveBeenCalled();
  });

  it('waits a second and a half at most for the account: past that, it carries on with the life it has', async () => {
    const services = memoryServices();
    await services.sessions.start('engineer');
    const cloud = readingAccount();
    renderGame(<Home />, { ...services, account: accountOf(MEMBER).account, saves: cloud.saves });
    const carry = await screen.findByRole('link', { name: /Continue your life/ });
    const pressed = Date.now();
    fireEvent.click(carry);
    expect(router.push).not.toHaveBeenCalled();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/en/play'), { timeout: 3000 });
    expect(Date.now() - pressed).toBeGreaterThanOrEqual(1400);
  });
  /** The other players, answering only what the front door asks: the player's own profile, their friends, today's attempt. */
  const othersOf = (answers: Partial<Community> = {}): Community =>
    ({ me: async () => null, friends: async () => null, challengeEntry: async () => null, ...answers }) as unknown as Community;
  const friend = (userId: string) => ({ userId, nickname: null, avatar: null });

  it('leads to the rankings where someone is signed in, a guest too, and shows no way to them where nobody is', async () => {
    renderGame(<Home />, { ...memoryServices(), account: accountOf(GUEST).account, community: () => othersOf() });
    const rankings = await screen.findByRole('link', { name: 'Rankings' });
    fireEvent.click(rankings);
    expect(router.push).toHaveBeenLastCalledWith('/en/rankings');
    expect(rankings.querySelector('[data-sprite="icon.status"]')).not.toBeNull();
    // A third tile in the row of the collection and the records: the smallest box that holds the three holds no other link.
    const collection = screen.getByRole('link', { name: 'Collection' });
    let row = collection.parentElement as HTMLElement;
    while (!row.contains(rankings)) row = row.parentElement as HTMLElement;
    expect(within(row).getAllByRole('link').map((link) => link.textContent)).toEqual(['Collection', 'History', 'Rankings']);
    // A guest has no profile on the door: the way into Google stands where it would be.
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['New life', expect.stringMatching(/^Weekly challenge/), 'Collection', 'History', 'Rankings']);
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeTruthy();
  });

  it('keeps the way to the rankings with no connection: they are the account\'s, and say so themselves', async () => {
    network.connected = false;
    renderGame(<Home />, { ...memoryServices(), account: accountOf(GUEST).account, community: () => othersOf() });
    expect(await screen.findByRole('link', { name: 'Rankings' })).toBeTruthy();
  });

  it('says how many friend requests wait on the player, and leads to them, for a guest or a member: nothing when there are none', async () => {
    const asked: string[] = [];
    const others = othersOf({ friends: async () => (asked.push('friends'), { friends: [], incoming: [friend('a'), friend('b')], outgoing: [] }) });
    renderGame(<Home />, { ...memoryServices(), account: accountOf(GUEST).account, community: () => others });
    const requests = await screen.findByRole('link', { name: '2 friend requests' });
    expect(requests.querySelector('[data-sprite="icon.multiplayer"]')).not.toBeNull();
    fireEvent.click(requests);
    expect(router.push).toHaveBeenLastCalledWith('/en/room');
    expect(asked).toEqual(['friends']);
    cleanup();
    renderGame(<Home />, { ...memoryServices(), account: accountOf(MEMBER).account, community: () => othersOf({ friends: async () => ({ friends: [friend('c')], incoming: [], outgoing: [] }) }) });
    await screen.findByRole('link', { name: 'Rankings' });
    await settled();
    expect(screen.queryByText(/friend request/)).toBeNull();
  });

  it('asks nobody of friends, and shows no request, where nobody is signed in', async () => {
    const asked: string[] = [];
    renderGame(<Home />, { ...memoryServices(), community: () => othersOf({ friends: async () => (asked.push('friends'), null) }) });
    await screen.findByRole('link', { name: 'History' });
    await settled();
    expect(asked).toEqual([]);
  });

  it('leads a member to their profile with their rat on it, at the foot where a guest is offered Google; a guest has none there, and is given it once kept', async () => {
    const asked: string[] = [];
    const services = { ...memoryServices(), community: () => othersOf({ me: async () => (asked.push('me'), { nickname: 'Rata', friendCode: 'ABCD2345', avatar: null }) }) };
    renderGame(<Home />, { ...services, account: accountOf(MEMBER).account });
    const profile = await screen.findByRole('link', { name: 'Your profile' });
    fireEvent.click(profile);
    expect(router.push).toHaveBeenLastCalledWith('/en/player');
    // At the foot, in the account's place, with no frame round it; the last thing the door leads to.
    const foot = screen.getByRole('region', { name: 'Account' });
    expect(foot.contains(profile)).toBe(true);
    expect(foot.closest('[aria-label="Settings"]')).toBeNull();
    expect(screen.getAllByRole('link').at(-1)).toBe(profile);
    // The rat on it is the member's own, as their profile on the server keeps it.
    await waitFor(() => expect(asked).toContain('me'));
    cleanup();
    // A guest: the way into Google in its place, and no profile on the door; once kept with Google, the profile takes the button's place.
    const { account, become } = accountOf(GUEST);
    renderGame(<Home />, { ...services, account });
    expect(await screen.findByRole('button', { name: 'Sign in with Google' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Your profile' })).toBeNull();
    become(MEMBER);
    expect(await screen.findByRole('link', { name: 'Your profile' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sign in with Google' })).toBeNull();
  });

  it('asks the other players again each time it is shown again, as the web asks on every visit: requests answered and a rat dressed on the screens over it', async () => {
    // The front door stays drawn under the friends and the profile; what was done there is told when it is shown again.
    let incoming = [friend('a'), friend('b')];
    let avatar: string | null = null;
    let entered = false;
    const asked: string[] = [];
    const others = othersOf({
      friends: async () => (asked.push('friends'), { friends: [], incoming, outgoing: [] }),
      me: async () => (asked.push('me'), { nickname: 'Rata', friendCode: 'ABCD2345', avatar }),
      challengeEntry: async () => (asked.push('entry'), { entered, score: null }),
    });
    renderGame(<Home />, { ...memoryServices(), account: accountOf(MEMBER).account, community: () => others });
    fireEvent.click(await screen.findByRole('link', { name: '2 friend requests' }));
    expect(router.push).toHaveBeenLastCalledWith('/en/room');
    await screen.findByText(/^(Ends today|\d days? left)$/);
    const before = { friends: asked.filter((what) => what === 'friends').length, me: asked.filter((what) => what === 'me').length };
    // On the games with others' page both requests are answered; on the profile's the rat is dressed; and today's attempt is played.
    incoming = [];
    avatar = 'rat_gold';
    entered = true;
    await act(async () => focus.again());
    await waitFor(() => expect(screen.queryByRole('link', { name: /friend request/ })).toBeNull());
    expect(await screen.findByText('Played today')).toBeTruthy();
    expect(asked.filter((what) => what === 'friends')).toHaveLength(before.friends + 1);
    expect(asked.filter((what) => what === 'me')).toHaveLength(before.me + 1);
    // A request that came meanwhile is told, the next time it is shown.
    incoming = [friend('c')];
    await act(async () => focus.again());
    expect(await screen.findByRole('link', { name: '1 friend request' })).toBeTruthy();
  });

  it('shows the ranked life the phone has only a note of, once there is someone signed in to ask the server for it', async () => {
    // The phone opens before anyone is signed in. A note the account left here, never opened, has nothing to show yet.
    const server = rankedServer();
    const versions = { engine: ENGINE_VERSION, content: CONTENT_VERSION };
    const deps = { newId: () => 'local-1', newSeed: () => 'seed-1', now: () => 1 };
    const elsewhere = new MemoryStore();
    const there = await new GameSessions(elsewhere, new LocalSessions(elsewhere, content, lives, deps), new RankedSessions(() => server.api, elsewhere, content, lives, versions, deps), versions).start('nurse', { ranked: true });
    const store = new MemoryStore();
    await store.saveGame(rankedNote({ gameId: there.gameId, lifeId: 'nurse', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION }));
    let api: RankedApi | null = null;
    const { account, become } = accountOf({ kind: 'offline' });
    const sessions = new GameSessions(store, new LocalSessions(store, content, lives, deps), new RankedSessions(() => api, store, content, lives, versions, deps), versions);
    renderGame(<Home />, { sessions, store, account, tapGuardMs: 0 });
    await screen.findByRole('link', { name: 'New life' });
    expect(screen.queryByRole('link', { name: /Continue your life/ })).toBeNull();
    // Sign-in lands, a moment after the phone opened.
    api = server.api;
    become(GUEST);
    expect(await screen.findByRole('link', { name: /Continue your life/ })).toBeTruthy();
    expect(server.games.get(there.gameId)?.status).toBe('playing');
  });

  it('is not drawn again for the connection coming and going, a change of the game it does not show, or being shown again, once the other players have answered', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    const others = othersOf({
      me: async () => ({ nickname: 'Rata', friendCode: 'ABCD2345', avatar: null }),
      friends: async () => ({ friends: [], incoming: [friend('a')], outgoing: [] }),
      challengeEntry: async () => ({ entered: true, score: 300 }),
    });
    const renders: Renders = { count: 0 };
    let leave: (() => void) | null = null;
    function Hand() {
      leave = useGame((s) => s.leaveNews);
      return null;
    }
    render(
      <GameProvider services={speaking({ ...services, account: accountOf(MEMBER).account, community: () => others }, 'en')}>
        <Counted into={renders}>
          <Home />
        </Counted>
        <Hand />
      </GameProvider>,
    );
    await screen.findByRole('link', { name: '1 friend request' });
    await screen.findByRole('link', { name: 'Your profile' });
    await screen.findByText('Played today');
    await steady(() => renders.count);
    const before = renders.count;
    await settled(() => network.set(false));
    await settled(() => network.set(true));
    await settled(() => leave!());
    // Shown again, it asks again: the same answers draw nothing.
    await settled(() => focus.again());
    expect(renders.count).toBe(before);
  });
});
