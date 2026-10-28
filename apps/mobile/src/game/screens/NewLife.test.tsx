// @vitest-environment jsdom
import { content, CONTENT_VERSION, lives } from '@ratrace/content';
import { messagesFor } from '@ratrace/i18n';
import { LocalSessions } from '@ratrace/core/session/local';
import { MemoryStore } from '@ratrace/core/session/memory';
import { RankedSessions } from '@ratrace/core/session/ranked';
import { GameSessions } from '@ratrace/core/session/sessions';
import { newProfile } from '@ratrace/core/session/types';
import type { RankedGame, SavedGame } from '@ratrace/core/session/types';
import { ENGINE_VERSION } from '@ratrace/engine';
import type { Account, AccountState } from '@ratrace/online/types';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameProvider, useGame } from '../context';
import { rankedServer } from '../../../../web/src/testing/rankedServer';
import { network } from '../../testing/fakes';
import { memoryServices, renderGame, router, spriteRenders } from '../../testing/render';
import { speaking } from '../../testing/memoryServices';
import { Counted, settled, steady } from '../../testing/renders';
import type { Renders } from '../../testing/renders';
import { act } from '@testing-library/react';
import { COLUMNS, NewLife, portraitSize } from './NewLife';
import { HapticProvider } from '../../ui/haptic';
import type { Haptic } from '../../ui/haptic';

afterEach(cleanup);

// Whether the sheets are gone is the test's to say where it needs to (./back is the kit's; its own tests hold it to the Modals).
const sheets = vi.hoisted(() => ({ gone: Promise.resolve() as Promise<void> }));
vi.mock('../../ui/back', async (actual) => ({ ...(await actual<typeof import('../../ui/back')>()), sheetsGone: () => sheets.gone }));
afterEach(() => {
  sheets.gone = Promise.resolve();
});

const en = messagesFor('en');
const saved = async (services: ReturnType<typeof memoryServices>) => (await services.store.loadGame()) as SavedGame | null;
/** The tiles of the grid, in their order: every button that names a life (its job, its city and how hard it is, or that it is locked). */
const tiles = () => Array.from(document.querySelectorAll<HTMLElement>('[data-life]'));
/** The sheet of a life, once it is open: titled by its job and who lives it. */
const sheetOf = async (title: string | RegExp) => (await screen.findByRole('heading', { name: title })).closest('[aria-modal="true"]') as HTMLElement;
/** The Start of a life's sheet (the nurse's, the first, unless another is named), the sheet opened by its tile. */
async function startButton(life: RegExp = /^Nurse, /, start = START) {
  fireEvent.click(await screen.findByRole('button', { name: life }));
  const heading = await screen.findByRole('heading', { name: / · / });
  return within(heading.closest('[aria-modal="true"]') as HTMLElement).getByRole('button', start);
}
/** The sheet that asks whether to end the life in progress, once it is open. */
const ask = async () => (await screen.findByRole('heading', { name: en.newLife.confirmTitle })).closest('[aria-modal="true"]') as HTMLElement;
const START = { name: 'Start this life' };

/** A device with a nurse's life played one round in, as the web's tests have it. */
async function livingNurse() {
  const services = memoryServices();
  const session = await services.sessions.start('nurse');
  while (session.view().phase === 'cards') await session.answerCard(0);
  await session.playRound({ orders: [] });
  return services;
}

describe('the grid of lives', () => {
  it('has a tile for every life, the seven open ones first and the seventeen locked after them, each named for a screen reader', async () => {
    renderGame(<NewLife />, memoryServices());
    await screen.findByRole('button', { name: /^Nurse, / });
    expect(screen.queryByText('Weekly challenge')).toBeNull();
    const names = tiles().map((tile) => tile.getAttribute('aria-label'));
    expect(names.slice(0, 7)).toEqual([
      'Nurse, Madrid, easy',
      'Software engineer, Tokyo, normal',
      expect.stringMatching(/^Civil servant, .+, (easy|normal|hard)$/),
      expect.stringMatching(/^Delivery rider, /),
      expect.stringMatching(/^Newcomer abroad, /),
      expect.stringMatching(/^Teacher, /),
      expect.stringMatching(/^Recruit, /),
    ]);
    expect(names.slice(7)).toHaveLength(17);
    expect(names.slice(7).every((name) => / locked$/.test(name ?? ''))).toBe(true);
    expect(names[7]).toBe('Heir, locked');
    // The folded list of the locked lives is gone, and so is the button at the foot.
    expect(screen.queryByText(/lives to unlock/)).toBeNull();
    expect(screen.queryByRole('button', START)).toBeNull();
  });

  it('shows on each open tile its job, the city\'s icon and how hard it is; a locked one only its shape and a lock', async () => {
    renderGame(<NewLife />, memoryServices());
    const nurse = await screen.findByRole('button', { name: /^Nurse, / });
    expect(nurse.textContent).toContain('Nurse');
    expect(within(nurse).getByText('easy')).toBeTruthy();
    expect(nurse.querySelector('[data-sprite="icon.city_madrid"]')).not.toBeNull();
    expect(nurse.querySelector('[data-sprite="portrait.nurse.22"]')).not.toBeNull();
    const heir = screen.getByRole('button', { name: 'Heir, locked' });
    expect(heir.querySelector('[data-sprite="portrait.heir.22"]')?.getAttribute('data-silhouette')).toBe('true');
    expect(heir.querySelector('[data-sprite="icon.locked"]')).not.toBeNull();
    expect(heir.textContent).not.toMatch(/easy|normal|hard/);
  });

  it('opens a life the player has unlocked among the open ones, and starts it', async () => {
    const services = memoryServices();
    await services.store.saveProfile({ ...newProfile(), unlocked: { heir: { at: 5, gameId: 'g' } } });
    renderGame(<NewLife />, services);
    const heir = await screen.findByRole('button', { name: /^Heir, (?!locked)/ });
    expect(tiles().indexOf(heir)).toBeLessThan(7);
    expect(tiles().filter((tile) => / locked$/.test(tile.getAttribute('aria-label') ?? ''))).toHaveLength(13);
    fireEvent.click(heir);
    fireEvent.click(within(await sheetOf(/^Heir/)).getByRole('button', START));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/en/play'));
    expect((await saved(services))?.lifeId).toBe('heir');
  });

  it('has twenty open tiles and no locked one for a player who has unlocked every life', async () => {
    const services = memoryServices();
    const all = lives.filter((life) => life.unlock !== 'default').map((life) => life.id);
    await services.store.saveProfile({ ...newProfile(), unlocked: Object.fromEntries(all.map((id, at) => [id, { at, gameId: `g${at}` }])) });
    renderGame(<NewLife />, services);
    await waitFor(() => expect(tiles().filter((tile) => !/ locked$/.test(tile.getAttribute('aria-label') ?? ''))).toHaveLength(20));
    expect(screen.queryByRole('button', { name: / locked$/ })).toBeNull();
  });

  it('feels a choice when a tile is pressed', async () => {
    const felt: Haptic[] = [];
    renderGame(
      <HapticProvider value={(kind) => void felt.push(kind)}>
        <NewLife />
      </HapticProvider>,
      memoryServices(),
    );
    fireEvent.click(await screen.findByRole('button', { name: /^Nurse, / }));
    expect(felt).toEqual(['select']);
  });

  it('leads back to the front door', async () => {
    renderGame(<NewLife />, memoryServices());
    fireEvent.click(await screen.findByRole('link', { name: 'Back' }));
    expect(router.dismissTo).toHaveBeenCalledWith('/en');
  });
});

describe('the sheet of a life', () => {
  it('opens on a tap with the life\'s portrait, who lives it, where and with how much it starts, how hard it is, and what it is good and bad at', async () => {
    renderGame(<NewLife />, memoryServices());
    fireEvent.click(await screen.findByRole('button', { name: /^Software engineer, / }));
    const sheet = await sheetOf('Software engineer · Haruto');
    expect(sheet.querySelector('[data-sprite="portrait.engineer.22"]')).not.toBeNull();
    expect(sheet.textContent).toContain('Starts in Tokyo with');
    expect(sheet.textContent).toContain('Tokyo');
    expect(within(sheet).getByText('normal')).toBeTruthy();
    expect(sheet.textContent).toMatch(/＋ .+/);
    expect(sheet.textContent).toMatch(/− .+/);
    expect(within(sheet).getByRole('button', START)).toBeTruthy();
    // Nothing begins until Start is pressed.
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('starts the life of the sheet and goes to it once the sheet is gone, leaving no way back onto this screen', async () => {
    const services = memoryServices();
    let gone: () => void = () => undefined;
    renderGame(<NewLife />, services);
    fireEvent.click(await screen.findByRole('button', { name: /^Software engineer, / }));
    const sheet = await sheetOf(/^Software engineer/);
    sheets.gone = new Promise<void>((done) => (gone = done));
    fireEvent.click(within(sheet).getByRole('button', START));
    await waitFor(async () => expect((await saved(services))?.lifeId).toBe('engineer'));
    await new Promise((done) => setTimeout(done, 30));
    expect(router.replace).not.toHaveBeenCalled();
    gone();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/en/play'));
    // Pushed, the Back button of a phone would land here again, one tap away from ending the life.
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: en.newLife.confirmTitle })).toBeNull();
  });

  it('shows what unlocks a locked life, how far the player is and a hint, and no way to start it', async () => {
    renderGame(<NewLife />, memoryServices());
    fireEvent.click(await screen.findByRole('button', { name: 'Heir, locked' }));
    const sheet = await sheetOf('Heir');
    expect(sheet.textContent).toContain('To unlock: ');
    expect(within(sheet).getByText('A head start nobody earned. What does it do to a person?')).toBeTruthy();
    expect(sheet.querySelector('[data-sprite="portrait.heir.22"]')?.getAttribute('data-silhouette')).toBe('true');
    // No goal left counts lives finished (unlockProgress's own test holds that one).
    expect(sheet.textContent).not.toContain('Lives finished');
    expect(within(sheet).queryByRole('button', START)).toBeNull();
  });

  it('opens the sheet of an open life at random from the header, and starts nothing by itself', async () => {
    const services = memoryServices();
    renderGame(<NewLife />, services);
    await screen.findByRole('button', { name: /^Nurse, / });
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    fireEvent.click(screen.getByRole('button', { name: /At random/ }));
    // The others than the first, in their order: the teacher is the last.
    expect(await sheetOf(/^Teacher/)).toBeTruthy();
    random.mockRestore();
    expect(await saved(services)).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('opens, for a scene, the sheet of the first locked life, or the question of ending the life in progress', async () => {
    renderGame(<NewLife opened="locked" />, memoryServices());
    expect(await sheetOf('Heir')).toBeTruthy();
    cleanup();
    renderGame(<NewLife opened="replace" />, await livingNurse());
    expect(await ask()).toBeTruthy();
  });

  it('starts one life, not two, for a double tap', async () => {
    const services = memoryServices();
    const begun: string[] = [];
    const start = services.sessions.start.bind(services.sessions);
    services.sessions.start = (lifeId: string, options?: Parameters<typeof start>[1]) => {
      begun.push(lifeId);
      return start(lifeId, options);
    };
    renderGame(<NewLife />, services);
    const button = await startButton();
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
    expect(begun).toEqual(['nurse']);
  });

  it('warns of the life in progress, asks before it ends it, and ends nothing unless told to', async () => {
    const services = await livingNurse();
    renderGame(<NewLife />, services);
    fireEvent.click(await screen.findByRole('button', { name: /^Civil servant, / }));
    // The sheet says what starting does, before it is asked.
    const sheet = await sheetOf(/^Civil servant/);
    expect(within(sheet).getByText('This ends the life you have in progress.')).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', START));
    const question = await ask();
    expect(within(question).getByText('Nurse, age 24. It ends here and is not recorded.')).toBeTruthy();
    expect((await saved(services))?.lifeId).toBe('nurse');
    expect(router.replace).not.toHaveBeenCalled();

    fireEvent.click(within(question).getByRole('button', { name: 'Keep my life' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: en.newLife.confirmTitle })).toBeNull());
    expect((await saved(services))?.lifeId).toBe('nurse');
    expect(router.replace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^Civil servant, / }));
    fireEvent.click(within(await sheetOf(/^Civil servant/)).getByRole('button', START));
    fireEvent.click(within(await ask()).getByRole('button', { name: 'End it and start this one' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/en/play'));
    expect(await saved(services)).toMatchObject({ lifeId: 'civil_servant', log: [] });
  });

  it('does not warn of a life in progress where none is', async () => {
    renderGame(<NewLife />, memoryServices());
    fireEvent.click(await screen.findByRole('button', { name: /^Nurse, / }));
    expect(within(await sheetOf(/^Nurse/)).queryByText(en.newLife.replace)).toBeNull();
  });

  it('moves on to the new life only once the question\'s sheet is gone, as the other pages that ask do', async () => {
    let gone: () => void = () => undefined;
    const services = await livingNurse();
    renderGame(<NewLife />, services);
    fireEvent.click(await startButton());
    sheets.gone = new Promise<void>((done) => (gone = done));
    fireEvent.click(within(await ask()).getByRole('button', { name: 'End it and start this one' }));
    await waitFor(async () => expect((await saved(services))?.log).toEqual([]));
    await new Promise((done) => setTimeout(done, 30));
    expect(router.replace).not.toHaveBeenCalled();
    gone();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/en/play'));
  });

  it('does not ask when the last life is already over', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    while (!session.view().finished) {
      while (session.view().phase === 'cards') await session.answerCard(0);
      await session.playRound({ orders: [] });
    }
    renderGame(<NewLife />, services);
    await waitFor(async () => expect((await saved(services))?.state.finished).toBe(true));
    const button = await startButton();
    expect(screen.queryByText('This ends the life you have in progress.')).toBeNull();
    fireEvent.click(button);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/en/play'));
    expect(screen.queryByRole('heading', { name: en.newLife.confirmTitle })).toBeNull();
    expect((await saved(services))?.state.finished).toBe(false);
  });

  it('says nothing of the ranking, an account or the connection: nobody is signed in to ask', async () => {
    renderGame(<NewLife />, memoryServices());
    await startButton();
    expect(screen.queryByRole('radiogroup', { name: 'How to play' })).toBeNull();
    expect(screen.queryByText(/will not be ranked/)).toBeNull();
    expect(screen.queryByText(/ranking/i)).toBeNull();
  });
});

describe('a life that cannot be started', () => {
  it('says so in its sheet, starts nothing, and can be tried again', async () => {
    const services = memoryServices();
    let refuse = true;
    const start = services.sessions.start.bind(services.sessions);
    services.sessions.start = (lifeId: string) => (refuse ? Promise.reject(new Error('the device would not')) : start(lifeId));
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderGame(<NewLife />, services);
    fireEvent.click(await startButton());
    expect((await screen.findByRole('alert')).textContent).toBe('The life could not be started. Try again.');
    expect(router.replace).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', START).getAttribute('aria-disabled')).not.toBe('true'));
    refuse = false;
    fireEvent.click(screen.getByRole('button', START));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/en/play'));
    expect(screen.queryByRole('alert')).toBeNull();
    quiet.mockRestore();
  });

  it('keeps the button shut while the life is being begun', async () => {
    const services = memoryServices();
    let finish: () => void = () => undefined;
    const start = services.sessions.start.bind(services.sessions);
    services.sessions.start = (lifeId: string) => new Promise((done) => (finish = () => done(start(lifeId))));
    renderGame(<NewLife />, services);
    fireEvent.click(await startButton());
    await waitFor(() => expect(screen.getByRole('button', START).getAttribute('aria-disabled')).toBe('true'));
    finish();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/en/play'));
  });
});

describe('the page in other languages', () => {
  it('speaks Spanish, and tells who lives the life', async () => {
    renderGame(<NewLife />, memoryServices(), 'es');
    expect(await screen.findByRole('heading', { name: 'Elige una vida' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Heredero, por desbloquear' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Enfermera, Madrid, fácil$/ }));
    const sheet = await sheetOf('Enfermera · Lucía');
    expect(within(sheet).getByRole('button', { name: 'Empezar esta vida' })).toBeTruthy();
  });

  it('speaks Russian, with the names of those who live the lives in Cyrillic and nothing of another language left', async () => {
    renderGame(<NewLife />, memoryServices(), 'ru');
    const [nurse] = await screen.findAllByRole('button', { name: /, (легко|средне|сложно)$/ });
    fireEvent.click(nurse);
    await screen.findByRole('heading', { name: /Люсия/ });
    expect(document.body.textContent?.replace(/\+/g, '')).not.toMatch(/[A-Za-z]{3,}/);
  });
});

describe('what the page is drawn again for', () => {
  it('is not drawn again by a change of the game it does not show: the news left, a card answered, with the device read again after each step', async () => {
    const services = await livingNurse();
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
          <NewLife />
        </Counted>
        <Hand />
      </GameProvider>,
    );
    await screen.findByRole('button', { name: /^Nurse, / });
    // Let everything the opening of the game does settle (the profile, the finished lives).
    await settled();
    const before = renders.count;
    // The news are left and a card answered: the stage, the view and the round's figures change, and the device is read again.
    await settled(async () => {
      play!.leaveNews();
      await play!.pick(0);
    });
    expect(renders.count).toBe(before);
    await settled(() => play!.leaveNews());
    expect(renders.count).toBe(before);
  });

  it('draws no tile again when a sheet opens: the tiles are memoised', async () => {
    renderGame(<NewLife />, memoryServices());
    await screen.findByRole('button', { name: /^Nurse, / });
    await settled();
    // A tile's portrait is drawn each time the tile is: the sprite stand-in counts them.
    const drawn = (id: string) => spriteRenders.get(`portrait.${id}.22`) ?? 0;
    const ids = ['engineer', 'civil_servant', 'heir'];
    const before = ids.map(drawn);
    fireEvent.click(screen.getByRole('button', { name: /^Nurse, / }));
    await sheetOf(/^Nurse/);
    await settled();
    expect(ids.map(drawn)).toEqual(before);
  });
});

describe('the size of a tile\'s portrait', () => {
  it('is as large as a third of a phone lets it be, never more than one and a half points to an art pixel, in even steps', () => {
    expect(portraitSize(393, 448, COLUMNS.phone)).toBe(96);
    expect(portraitSize(320, 448, COLUMNS.phone)).toBe(80);
    expect(portraitSize(1280, 672, COLUMNS.wide)).toBe(96);
    // Drawn with no window (the build's machine), the column's width.
    expect(portraitSize(0, 448, COLUMNS.phone)).toBe(96);
  });
});

describe('choosing between a ranked life and a casual one', () => {
  const GUEST: AccountState = { kind: 'guest', userId: 'u', notice: null };
  const accountAs = (state: AccountState): Account => ({ state: () => state, subscribe: () => () => {}, start: async () => {}, keepWithGoogle: async () => true, useExistingAccount: async () => true, dismissNotice: () => {}, signOut: async () => false });
  /** Someone is signed in, and the services remember how each life was asked for. */
  function signedIn(state: AccountState = GUEST) {
    const services = memoryServices();
    const asked: Array<{ ranked?: boolean } | undefined> = [];
    const start = services.sessions.start.bind(services.sessions);
    services.sessions.start = (lifeId: string, options?: { ranked?: boolean }) => {
      asked.push(options);
      return start(lifeId);
    };
    return { services: { ...services, account: accountAs(state) }, asked };
  }

  it('offers a ranked life to a player who is signed in, on by default, and says what it means', async () => {
    const { services, asked } = signedIn();
    renderGame(<NewLife />, services);
    fireEvent.click(await screen.findByRole('button', { name: /^Nurse, / }));
    // Two ways to play, side by side: ranked is chosen, and each says in a few words what it is.
    const mode = await screen.findByRole('radiogroup', { name: 'How to play' });
    const ranked = within(mode).getByRole('radio', { name: /^Ranked/ });
    expect(ranked.getAttribute('aria-checked')).toBe('true');
    expect(ranked.textContent).toContain('For the ranking');
    expect(within(mode).getByRole('radio', { name: /^Offline/ }).textContent).toContain('Just for you');
    fireEvent.click(screen.getByRole('button', START));
    await waitFor(() => expect(asked).toEqual([{ ranked: true, replace: undefined }]));
  });

  it('starts a casual life when the player turns it off', async () => {
    const { services, asked } = signedIn();
    renderGame(<NewLife />, services);
    fireEvent.click(await screen.findByRole('button', { name: /^Nurse, / }));
    fireEvent.click(await screen.findByRole('radio', { name: /^Offline/ }));
    fireEvent.click(screen.getByRole('button', START));
    await waitFor(() => expect(asked).toEqual([{ ranked: false, replace: undefined }]));
  });

  it('offers no ranked life where nobody is signed in, and asks for none', async () => {
    const { services, asked } = signedIn({ kind: 'offline' });
    renderGame(<NewLife />, services);
    fireEvent.click(await screen.findByRole('button', { name: /^Nurse, / }));
    await screen.findByRole('heading', { name: /^Nurse/ });
    expect(screen.queryByRole('radiogroup', { name: 'How to play' })).toBeNull();
    expect(screen.queryByText(/will not be ranked/)).toBeNull();
    fireEvent.click(screen.getByRole('button', START));
    await waitFor(() => expect(asked).toEqual([{ ranked: false, replace: undefined }]));
  });

  it('says so, before the life begins, when there is an account and no connection', async () => {
    network.connected = false;
    const { services, asked } = signedIn();
    renderGame(<NewLife />, services, 'es');
    fireEvent.click(await screen.findByRole('button', { name: /^Enfermera, / }));
    expect((await screen.findByRole('status')).textContent).toBe('Sin conexión: esta vida no será clasificatoria.');
    expect(screen.queryByRole('radiogroup', { name: 'Cómo jugar' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Empezar esta vida' }));
    await waitFor(() => expect(asked).toEqual([{ ranked: false, replace: undefined }]));
  });

  it('turns the ranked choice into the note as the connection goes, and back as it returns', async () => {
    const { services } = signedIn();
    renderGame(<NewLife />, services);
    fireEvent.click(await screen.findByRole('button', { name: /^Nurse, / }));
    await screen.findByRole('radiogroup', { name: 'How to play' });
    act(() => network.set(false));
    expect(await screen.findByText('No connection: this life will not be ranked.')).toBeTruthy();
    expect(screen.queryByRole('radiogroup', { name: 'How to play' })).toBeNull();
    act(() => network.set(true));
    expect(await screen.findByRole('radiogroup', { name: 'How to play' })).toBeTruthy();
  });

  it('is not drawn again for the connection where nobody is signed in to rank a life', async () => {
    const services = memoryServices();
    const renders: Renders = { count: 0 };
    render(
      <GameProvider services={speaking(services, 'en')}>
        <Counted into={renders}>
          <NewLife />
        </Counted>
      </GameProvider>,
    );
    await screen.findByRole('button', { name: /^Nurse, / });
    await steady(() => renders.count);
    const before = renders.count;
    await settled(() => network.set(false));
    await settled(() => network.set(true));
    expect(renders.count).toBe(before);
  });
});

describe('a ranked life in progress on another device', { timeout: 60_000 }, () => {
  const guest: AccountState = { kind: 'guest', userId: 'u', notice: null };
  const account: Account = { state: () => guest, subscribe: () => () => {}, start: async () => {}, keepWithGoogle: async () => true, useExistingAccount: async () => true, dismissNotice: () => {}, signOut: async () => false };
  /** A device of the player, over a server of ranked lives several devices can share. */
  function deviceOf(server: ReturnType<typeof rankedServer>, versions = { engine: ENGINE_VERSION, content: CONTENT_VERSION }) {
    const store = new MemoryStore();
    let ids = 0;
    let clock = 0;
    const deps = { newId: () => `local-${(ids += 1)}`, newSeed: () => `seed-${ids}`, now: () => (clock += 1) };
    const sessions = new GameSessions(store, new LocalSessions(store, content, lives, deps), new RankedSessions(() => server.api, store, content, lives, versions, deps), versions);
    return { sessions, store, account, tapGuardMs: 0 };
  }
  /** The desk is a round into a ranked life as a nurse. The phone, which this test draws, knows nothing of it. */
  async function twoDevices() {
    const server = rankedServer();
    const desk = deviceOf(server);
    const there = await desk.sessions.start('nurse', { ranked: true });
    while (there.view().phase === 'cards') await there.answerCard(0);
    await there.playRound({ orders: [] });
    return { server, there, phone: deviceOf(server) };
  }
  /** The sheet that asks about it, once it is open, and one of its buttons once it can be pressed (the sheet opens as the start that asked it ends). */
  const elsewhere = async (title = 'A ranked life in progress') => (await screen.findByRole('heading', { name: title })).closest('[aria-modal="true"]') as HTMLElement;
  async function ready(sheet: HTMLElement, name: string) {
    const button = within(sheet).getByRole('button', { name });
    await waitFor(() => expect(button.getAttribute('aria-disabled')).not.toBe('true'));
    return button;
  }

  it('is not ended by starting another: the player is asked, and nothing begins meanwhile', async () => {
    const { server, there, phone } = await twoDevices();
    renderGame(<NewLife />, phone);
    fireEvent.click(await startButton());
    const sheet = await elsewhere();
    expect(sheet.textContent).toContain('Nurse, round 2 of 20. You have it in progress on another device, and you can have only one.');
    expect(router.replace).not.toHaveBeenCalled();
    expect(server.games.get(there.gameId)?.status).toBe('playing');
    expect(await phone.store.loadGame()).toBeNull();
    // Left as it is.
    fireEvent.click(await ready(sheet, 'Cancel'));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'A ranked life in progress' })).toBeNull());
    expect(server.games.get(there.gameId)?.status).toBe('playing');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('is taken up on this phone when the player would rather go on with it, once the sheet has gone', async () => {
    const { server, there, phone } = await twoDevices();
    let gone: () => void = () => undefined;
    renderGame(<NewLife />, phone);
    fireEvent.click(await startButton());
    const sheet = await elsewhere();
    sheets.gone = new Promise<void>((done) => (gone = done));
    fireEvent.click(await ready(sheet, 'Continue that life'));
    await waitFor(async () => expect(((await phone.store.loadGame()) as RankedGame | null)?.gameId).toBe(there.gameId));
    await new Promise((done) => setTimeout(done, 30));
    expect(router.replace).not.toHaveBeenCalled();
    gone();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/en/play'));
    expect(server.games.get(there.gameId)?.status).toBe('playing');
    expect(server.games.size).toBe(1);
  });

  it('is ended, and the new life begun, only when the player says so, once the sheet has gone', async () => {
    const { server, there, phone } = await twoDevices();
    let gone: () => void = () => undefined;
    renderGame(<NewLife />, phone);
    fireEvent.click(await startButton(/^Software engineer, /));
    const sheet = await elsewhere();
    sheets.gone = new Promise<void>((done) => (gone = done));
    fireEvent.click(await ready(sheet, 'End it and start this one'));
    await waitFor(() => expect(server.games.get(there.gameId)?.status).toBe('abandoned'));
    await waitFor(async () => expect((await phone.store.loadGame()) as RankedGame).toMatchObject({ ranked: true, lifeId: 'engineer' }));
    await new Promise((done) => setTimeout(done, 30));
    expect(router.replace).not.toHaveBeenCalled();
    gone();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/en/play'));
  });

  it('says nothing of ending the life it has just taken up, while it waits for the sheet to go', async () => {
    const { there, phone } = await twoDevices();
    let gone: () => void = () => undefined;
    renderGame(<NewLife />, phone);
    fireEvent.click(await startButton());
    const sheet = await elsewhere();
    sheets.gone = new Promise<void>((done) => (gone = done));
    fireEvent.click(await ready(sheet, 'Continue that life'));
    await waitFor(async () => expect(((await phone.store.loadGame()) as RankedGame | null)?.gameId).toBe(there.gameId));
    await settled();
    // The life on the phone now is the one taken up: no warning that starting would end it, while the page waits and while it is on its way out.
    expect(screen.queryByText(en.newLife.replace)).toBeNull();
    gone();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/en/play'));
    await settled();
    expect(screen.queryByText(en.newLife.replace)).toBeNull();
  });

  it('takes it up once for two quick presses', async () => {
    const { phone } = await twoDevices();
    let takenUp = 0;
    const takeUp = phone.sessions.takeUp.bind(phone.sessions);
    phone.sessions.takeUp = (life: Parameters<typeof takeUp>[0]) => ((takenUp += 1), takeUp(life));
    renderGame(<NewLife />, phone);
    fireEvent.click(await startButton());
    const button = await ready(await elsewhere(), 'Continue that life');
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/en/play'));
    expect(takenUp).toBe(1);
  });

  it('cannot be taken up here when it was begun under older rules, and the sheet says so', async () => {
    const { server, there, phone } = await twoDevices();
    (server.games.get(there.gameId) as { engine_version: string }).engine_version = '0.0.1';
    renderGame(<NewLife />, phone, 'es');
    fireEvent.click(await startButton(/^Enfermera, /, { name: 'Empezar esta vida' }));
    const sheet = await elsewhere('Una vida clasificatoria en curso');
    expect(sheet.textContent).toContain('Empezó con otras reglas y no se puede seguir en este dispositivo.');
    expect(within(sheet).queryByRole('button', { name: 'Seguir con esa vida' })).toBeNull();
    expect(within(sheet).getByRole('button', { name: 'Terminarla y empezar esta' })).toBeTruthy();
  });

  it('says so when that life cannot be taken up just now, and keeps the question open', async () => {
    const { server, phone } = await twoDevices();
    renderGame(<NewLife />, phone);
    fireEvent.click(await startButton());
    const sheet = await elsewhere();
    server.state.down = true;
    fireEvent.click(await ready(sheet, 'Continue that life'));
    expect((await within(sheet).findByRole('alert')).textContent).toBe('The server did not answer. Try again.');
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'A ranked life in progress' })).toBeTruthy();
  });
});
