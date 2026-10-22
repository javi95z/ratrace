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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameProvider, useGame } from '../context';
import { rankedServer } from '../../../../web/src/testing/rankedServer';
import { network } from '../../testing/fakes';
import { memoryServices, renderGame, router, spriteRenders } from '../../testing/render';
import { speaking } from '../../testing/memoryServices';
import { Counted, settled, steady } from '../../testing/renders';
import type { Renders } from '../../testing/renders';
import { AccessibilityInfo } from 'react-native';
import { StrictMode } from 'react';
import { act } from '@testing-library/react';
import { LOCKED_FIRST, LOCKED_STEP, NewLife } from './NewLife';

afterEach(cleanup);

// Whether the sheets are gone is the test's to say where it needs to (./back is the kit's; its own tests hold it to the Modals).
const sheets = vi.hoisted(() => ({ gone: Promise.resolve() as Promise<void> }));
vi.mock('../../ui/back', async (actual) => ({ ...(await actual<typeof import('../../ui/back')>()), sheetsGone: () => sheets.gone }));
afterEach(() => {
  sheets.gone = Promise.resolve();
});

const en = messagesFor('en');
const saved = async (services: ReturnType<typeof memoryServices>) => (await services.store.loadGame()) as SavedGame | null;
/** The life that is chosen: the radio that is on. */
const chosen = () => screen.getAllByRole('radio').find((radio) => radio.getAttribute('aria-checked') === 'true');
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

describe('choosing a life', () => {
  it('chooses one of the other open lives at random, and starts nothing by itself', async () => {
    const services = memoryServices();
    renderGame(<NewLife />, services);
    await screen.findAllByRole('radio');
    for (let i = 0; i < 5; i++) {
      const was = chosen()?.textContent;
      fireEvent.click(screen.getByRole('button', { name: /At random/ }));
      const now = chosen()?.textContent;
      expect(now).toBeTruthy();
      expect(now).not.toBe(was);
    }
    expect(await saved(services)).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('lets the random number choose which, and never the life already chosen', async () => {
    renderGame(<NewLife />, memoryServices());
    await screen.findAllByRole('radio');
    // The others, in the order they stand: the engineer and the civil servant.
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    fireEvent.click(screen.getByRole('button', { name: /At random/ }));
    expect(chosen()?.textContent).toMatch(/^Civil servant/);
    random.mockReturnValue(0);
    fireEvent.click(screen.getByRole('button', { name: /At random/ }));
    expect(chosen()?.textContent).toMatch(/^Nurse/);
    random.mockRestore();
  });

  it('offers the three starting lives, and shows what unlocks the others', async () => {
    renderGame(<NewLife />, memoryServices());
    expect(screen.queryByText('Weekly challenge')).toBeNull();
    // The lives that can be lived are the ones to choose from, each with how hard it is.
    const open = screen.getAllByRole('radio');
    expect(open.map((life) => within(life).getByText(/^(Nurse|Software engineer|Civil servant)\b/).textContent?.split(' · ')[0])).toEqual(['Nurse', 'Software engineer', 'Civil servant']);
    // The one chosen says who lives it.
    expect(open[0].textContent).toContain('Nurse · Lucía');
    expect(within(open[1]).getByRole('img', { name: 'Difficulty: normal' })).toBeTruthy();
    // The others wait at the foot, folded, with what unlocks each.
    expect(screen.queryByText(/To unlock/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '17 lives to unlock' }));
    await waitFor(() => expect(screen.getAllByText(/To unlock/)).toHaveLength(17));
  });

  it('draws the locked lives a few to a frame, not all seventeen in the frame that opens the list, and all of them in the end', async () => {
    renderGame(<NewLife />, memoryServices());
    fireEvent.click(await screen.findByRole('button', { name: '17 lives to unlock' }));
    // The frame that opens it has the first of them, and the button has already turned.
    expect(screen.getAllByText(/To unlock/)).toHaveLength(LOCKED_FIRST);
    expect(screen.getByRole('button', { name: '17 lives to unlock' }).getAttribute('aria-expanded')).toBe('true');
    // Then a few more to each frame, in the order they are in, until there are no more.
    await waitFor(() => expect(screen.getAllByText(/To unlock/)).toHaveLength(LOCKED_FIRST + LOCKED_STEP));
    await waitFor(() => expect(screen.getAllByText(/To unlock/)).toHaveLength(17));
    const names = screen.getAllByText(/To unlock/).map((line) => line.parentElement?.parentElement?.firstElementChild?.textContent);
    expect(names.slice(0, 3)).toEqual(['Delivery rider', 'Heir', 'Newcomer abroad']);
    // Shut and opened again, it begins again from the first few.
    fireEvent.click(screen.getByRole('button', { name: '17 lives to unlock' }));
    expect(screen.queryByText(/To unlock/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '17 lives to unlock' }));
    expect(screen.getAllByText(/To unlock/)).toHaveLength(LOCKED_FIRST);
  });

  it('says the locked lives are a list, and each a list item', async () => {
    renderGame(<NewLife />, memoryServices());
    fireEvent.click(await screen.findByRole('button', { name: '17 lives to unlock' }));
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(LOCKED_FIRST);
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(17));
    expect(within(within(list).getAllByRole('listitem')[0]).getByText('Delivery rider')).toBeTruthy();
  });

  it('has a tile for every life the player has unlocked, twenty at most, and says nothing of the locked when none is left', async () => {
    const services = memoryServices();
    const all = lives.filter((life) => life.unlock !== 'default').map((life) => life.id);
    await services.store.saveProfile({ ...newProfile(), unlocked: Object.fromEntries(all.map((id, at) => [id, { at, gameId: `g${at}` }])) });
    renderGame(<NewLife />, services);
    await waitFor(() => expect(screen.getAllByRole('radio')).toHaveLength(20));
    // Nothing is left to unlock, and nothing says so.
    expect(screen.queryByText(/to unlock/)).toBeNull();
  });

  it('says in a group of its own which life is chosen, and of how many', async () => {
    renderGame(<NewLife />, memoryServices());
    const group = await screen.findByRole('radiogroup', { name: 'Choose a life' });
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
    expect(within(group).getAllByRole('radio').map((radio) => radio.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
  });

  it('opens the chosen life across the row, with where it starts, what it is good at and what holds it back; the others only as a brief', async () => {
    renderGame(<NewLife />, memoryServices());
    const [nurse, engineer] = await screen.findAllByRole('radio');
    expect(nurse.textContent).toContain('Starts in Madrid with');
    expect(nurse.textContent).toMatch(/＋ .+/);
    expect(nurse.textContent).toMatch(/− .+/);
    // The word of the difficulty, on the chosen life; the others have the dots.
    expect(within(nurse).getByText('easy')).toBeTruthy();
    expect(within(engineer).queryByText('normal')).toBeNull();
    expect(engineer.textContent).not.toContain('Starts in');
    expect(engineer.textContent).not.toContain('＋');
    expect(engineer.textContent).toContain('Tokyo');
    fireEvent.click(engineer);
    expect(chosen()).toBe(screen.getByRole('radio', { name: /^Software engineer/ }));
    expect(within(chosen()!).getByText('normal')).toBeTruthy();
    expect(within(screen.getByRole('radio', { name: /^Nurse/ })).queryByText('easy')).toBeNull();
  });

  it('draws each life with the portrait that is its own, and a life that is not open yet only as a shape', async () => {
    renderGame(<NewLife />, memoryServices());
    await screen.findAllByRole('radio');
    expect(document.querySelector('[data-sprite="portrait.nurse.22"]')).not.toBeNull();
    expect(document.querySelector('[data-sprite="portrait.rider.22"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '17 lives to unlock' }));
    const shape = document.querySelector('[data-sprite="portrait.rider.22"]');
    expect(shape?.getAttribute('data-silhouette')).toBe('true');
    expect(document.querySelector('[data-sprite="portrait.nurse.22"]')?.getAttribute('data-silhouette')).toBeNull();
  });

  it('centres every portrait against what is written beside it, as the rows of the web do', async () => {
    renderGame(<NewLife />, memoryServices());
    await screen.findAllByRole('radio');
    fireEvent.click(screen.getByRole('button', { name: '17 lives to unlock' }));
    for (const id of ['nurse', 'engineer', 'rider', 'heir']) {
      const well = document.querySelector(`[data-sprite="portrait.${id}.22"]`)?.parentElement as HTMLElement;
      expect([id, well.style.alignSelf]).toEqual([id, 'center']);
      expect([well.style.width, well.style.height]).toEqual(['68px', '68px']);
    }
  });

  it('gives each locked life a hint, and counts the lives finished only where that is the goal', async () => {
    renderGame(<NewLife />, memoryServices());
    fireEvent.click(await screen.findByRole('button', { name: '17 lives to unlock' }));
    expect(screen.getByText('A head start nobody earned. What does it do to a person?')).toBeTruthy();
    // Finishing one life is counted; a goal the device does not record has only its requirement.
    expect(await screen.findAllByText('Lives finished: 0 of 1')).toHaveLength(1);
  });

  it('opens the delivery rider for someone who has finished a life: what finishing one earns is on the profile the page reads', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    while (!session.view().finished) {
      while (session.view().phase === 'cards') await session.answerCard(0);
      await session.playRound({ orders: [] });
    }
    renderGame(<NewLife />, services);
    expect(await screen.findByRole('radio', { name: /^Delivery rider/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '16 lives to unlock' }));
    // The goal is reached: there is nothing left of it to count.
    expect(screen.queryByText(/Lives finished/)).toBeNull();
  });

  it('says what unlocks each locked life, folded under a button that says how many there are, and shuts again', async () => {
    renderGame(<NewLife />, memoryServices());
    const toggle = await screen.findByRole('button', { name: '17 lives to unlock' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.textContent).toBe('17 lives to unlock▾');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.textContent).toBe('17 lives to unlock▴');
    expect(document.querySelector('[data-sprite="icon.locked"]')).not.toBeNull();
    // Each says its name, how hard it is, and what unlocks it.
    const text = document.body.textContent ?? '';
    expect(text).toContain('Delivery rider');
    expect(text).toContain('To unlock: ');
    await waitFor(() => expect(screen.getAllByRole('img', { name: /^Difficulty: / })).toHaveLength(2 + 17));
    fireEvent.click(toggle);
    expect(screen.queryByText(/To unlock/)).toBeNull();
  });

  it('opens a life the player has unlocked, and marks it', async () => {
    const services = memoryServices();
    await services.store.saveProfile({ ...newProfile(), unlocked: { rider: { at: 5, gameId: 'g' } } });
    renderGame(<NewLife />, services);
    const rider = await screen.findByRole('radio', { name: /^Delivery rider/ });
    expect(screen.getByRole('button', { name: '16 lives to unlock' })).toBeTruthy();
    fireEvent.click(rider);
    expect(chosen()).toBe(rider);
    fireEvent.click(screen.getByRole('button', START));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
    expect((await saved(services))?.lifeId).toBe('rider');
  });

  it('lays out the open lives in the order of the web\'s grid: the chosen one across a row, the next fills the gap above it', async () => {
    const services = memoryServices();
    await services.store.saveProfile({ ...newProfile(), unlocked: { rider: { at: 5, gameId: 'g' } } });
    renderGame(<NewLife />, services);
    await screen.findByRole('radio', { name: /^Delivery rider/ });
    const names = () => screen.getAllByRole('radio').map((radio) => /^(Nurse|Software engineer|Civil servant|Delivery rider)/.exec(radio.textContent ?? '')?.[1]);
    // The nurse is chosen and has a row of her own; the rest follow in order.
    expect(names()).toEqual(['Nurse', 'Software engineer', 'Civil servant', 'Delivery rider']);
    // The second of four chosen: the first and the third stand together above it.
    fireEvent.click(screen.getByRole('radio', { name: /^Software engineer/ }));
    expect(names()).toEqual(['Nurse', 'Civil servant', 'Software engineer', 'Delivery rider']);
  });

  it('starts the life chosen and goes to it, leaving no way back onto this screen', async () => {
    const services = memoryServices();
    renderGame(<NewLife />, services);
    fireEvent.click(await screen.findByRole('radio', { name: /^Software engineer/ }));
    fireEvent.click(screen.getByRole('button', START));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
    // Pushed, the Back button of a phone would land here again, one tap away from ending the life.
    expect(router.push).not.toHaveBeenCalled();
    expect((await saved(services))?.lifeId).toBe('engineer');
    expect(screen.queryByRole('heading', { name: en.newLife.confirmTitle })).toBeNull();
  });

  it('does not warn of a life in progress for the life it is beginning, while the page is on its way out', async () => {
    // Found by hand in the release build: between the life begun and the page replaced, the bar said the new life would be ended.
    renderGame(<NewLife />, memoryServices());
    fireEvent.click(await screen.findByRole('button', START));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
    await settled();
    expect(screen.queryByText(en.newLife.replace)).toBeNull();
    // Nor is a second press, now that a life is in progress, the question that would end it.
    fireEvent.click(screen.getByRole('button', START));
    expect(screen.queryByRole('heading', { name: en.newLife.confirmTitle })).toBeNull();
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
    const button = await screen.findByRole('button', START);
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
    expect(begun).toEqual(['nurse']);
  });

  it('asks before it ends a life in progress, and ends nothing unless told to', async () => {
    const services = await livingNurse();
    renderGame(<NewLife />, services);
    fireEvent.click(await screen.findByRole('radio', { name: /^Civil servant/ }));
    // The page says what starting does, before it is asked.
    expect(screen.getByText('This ends the life you have in progress.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', START));
    const sheet = await ask();
    expect(within(sheet).getByText('Nurse, age 24. It ends here and is not recorded.')).toBeTruthy();
    expect((await saved(services))?.lifeId).toBe('nurse');
    expect(router.replace).not.toHaveBeenCalled();

    fireEvent.click(within(sheet).getByRole('button', { name: 'Keep my life' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: en.newLife.confirmTitle })).toBeNull());
    expect((await saved(services))?.lifeId).toBe('nurse');
    expect(router.replace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', START));
    fireEvent.click(within(await ask()).getByRole('button', { name: 'End it and start this one' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
    expect(await saved(services)).toMatchObject({ lifeId: 'civil_servant', log: [] });
  });

  it('moves on to the new life only once the question\'s sheet is gone, as the other pages that ask do', async () => {
    let gone: () => void = () => undefined;
    const services = await livingNurse();
    renderGame(<NewLife />, services);
    fireEvent.click(await screen.findByRole('button', START));
    sheets.gone = new Promise<void>((done) => (gone = done));
    fireEvent.click(within(await ask()).getByRole('button', { name: 'End it and start this one' }));
    await waitFor(async () => expect((await saved(services))?.log).toEqual([]));
    await new Promise((done) => setTimeout(done, 30));
    expect(router.replace).not.toHaveBeenCalled();
    gone();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
  });

  it('does not wait for a sheet when the start came from the button, whatever is said of sheets', async () => {
    sheets.gone = new Promise<void>(() => undefined);
    renderGame(<NewLife />, memoryServices());
    fireEvent.click(await screen.findByRole('button', START));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
  });

  it('does not ask when the last life is already over', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    while (!session.view().finished) {
      while (session.view().phase === 'cards') await session.answerCard(0);
      await session.playRound({ orders: [] });
    }
    renderGame(<NewLife />, services);
    await screen.findAllByRole('radio');
    await waitFor(async () => expect((await saved(services))?.state.finished).toBe(true));
    expect(screen.queryByText('This ends the life you have in progress.')).toBeNull();
    fireEvent.click(screen.getByRole('button', START));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
    expect(screen.queryByRole('heading', { name: en.newLife.confirmTitle })).toBeNull();
    expect((await saved(services))?.state.finished).toBe(false);
  });

  it('leads back to the front door', async () => {
    renderGame(<NewLife />, memoryServices());
    fireEvent.click(await screen.findByRole('link', { name: 'Back' }));
    expect(router.dismissTo).toHaveBeenCalledWith('/');
  });

  it('says nothing of the ranking, an account or the connection: nobody is signed in to ask', async () => {
    renderGame(<NewLife />, memoryServices());
    await screen.findAllByRole('radio');
    expect(screen.queryByRole('radiogroup', { name: 'How to play' })).toBeNull();
    expect(screen.queryByText(/will not be ranked/)).toBeNull();
    expect(screen.queryByText(/ranking/i)).toBeNull();
  });
});

describe('a life that cannot be started', () => {
  it('says so, starts nothing, and can be tried again', async () => {
    const services = memoryServices();
    let refuse = true;
    const start = services.sessions.start.bind(services.sessions);
    services.sessions.start = (lifeId: string) => (refuse ? Promise.reject(new Error('the device would not')) : start(lifeId));
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderGame(<NewLife />, services);
    fireEvent.click(await screen.findByRole('button', START));
    expect((await screen.findByRole('alert')).textContent).toBe('The life could not be started. Try again.');
    expect(router.replace).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', START).getAttribute('aria-disabled')).not.toBe('true'));
    refuse = false;
    fireEvent.click(screen.getByRole('button', START));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
    expect(screen.queryByRole('alert')).toBeNull();
    quiet.mockRestore();
  });

  it('keeps the button shut while the life is being begun', async () => {
    const services = memoryServices();
    let finish: () => void = () => undefined;
    const start = services.sessions.start.bind(services.sessions);
    services.sessions.start = (lifeId: string) => new Promise((done) => (finish = () => done(start(lifeId))));
    renderGame(<NewLife />, services);
    fireEvent.click(await screen.findByRole('button', START));
    await waitFor(() => expect(screen.getByRole('button', START).getAttribute('aria-disabled')).toBe('true'));
    finish();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
  });
});

describe('the page in other languages', () => {
  it('speaks Spanish, and tells who lives the life', async () => {
    renderGame(<NewLife />, memoryServices(), 'es');
    expect(await screen.findByRole('radiogroup', { name: 'Elige una vida' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Empezar esta vida' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '17 vidas por desbloquear' })).toBeTruthy();
    expect(screen.getAllByRole('radio')[0].textContent).toContain('Lucía');
  });

  it('speaks Russian, with the names of those who live the lives in Cyrillic and nothing of another language left', async () => {
    renderGame(<NewLife />, memoryServices(), 'ru');
    const radios = await screen.findAllByRole('radio');
    expect(radios[0].textContent).toContain('Люсия');
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
    await screen.findByText('This ends the life you have in progress.');
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

  it('draws again only the two tiles that change when another life is chosen, the one let go and the one chosen: the others are memoised', async () => {
    const services = memoryServices();
    await services.store.saveProfile({ ...newProfile(), unlocked: { rider: { at: 5, gameId: 'g' } } });
    renderGame(<NewLife />, services);
    await screen.findByRole('radio', { name: /^Delivery rider/ });
    await settled();
    // A tile's portrait is drawn each time the tile is: the sprite stand-in counts them.
    const drawn = (id: string) => spriteRenders.get(`portrait.${id}.22`) ?? 0;
    const before = ['nurse', 'engineer', 'civil_servant', 'rider'].map(drawn);
    expect(before.every((count) => count > 0)).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: /^Software engineer/ }));
    await settled();
    const after = ['nurse', 'engineer', 'civil_servant', 'rider'].map(drawn);
    // The nurse is let go and the engineer chosen: each is drawn once more. The civil servant and the rider are not drawn again, though the grid moved them.
    expect(after.map((count, i) => count - before[i])).toEqual([1, 1, 0, 0]);
  });

  it('keeps the tiles it has when another life is chosen: none is made again, a life that moves in the grid is the same life, moved', async () => {
    const services = memoryServices();
    await services.store.saveProfile({ ...newProfile(), unlocked: { rider: { at: 5, gameId: 'g' } } });
    renderGame(<NewLife />, services);
    await screen.findByRole('radio', { name: /^Delivery rider/ });
    const portraits = () => Array.from(document.querySelectorAll('[data-sprite^="portrait."]'));
    const before = portraits();
    expect(before).toHaveLength(4);
    fireEvent.click(screen.getByRole('radio', { name: /^Software engineer/ }));
    const after = portraits();
    expect(before.map((sprite) => after.includes(sprite))).toEqual([true, true, true, true]);
  });
});

describe('the dice shows the life it picked', () => {
  type Laid = HTMLElement & { __reactLayoutHandler?: (event: unknown) => void; scrollTo?: unknown };
  /** What the phone tells a view once it has laid it out: react-native-web keeps the handler on the node, and calling it is what its observer does after it measures. */
  const layOut = (node: Element, layout: { x?: number; y: number; width?: number; height: number }) =>
    act(() => (node as Laid).__reactLayoutHandler!({ nativeEvent: { layout: { x: 0, width: 100, ...layout } } }));
  /** The page's scroll: the one box that scrolls and has been given a layout handler (the screen follows its height when it has a scroller). */
  const scrollBox = () => Array.from(document.querySelectorAll<Laid>('*')).find((node) => typeof node.__reactLayoutHandler === 'function' && typeof node.scrollTo === 'function')!;
  const tileOf = (name: RegExp) => screen.getByRole('radio', { name }).parentElement as HTMLElement;
  const dice = () => screen.getByRole('button', { name: /At random/ });
  const focus = vi.fn();
  const scrollTo = vi.fn();

  /** Four open lives, a page 600 tall that the group of tiles stands 100 down, and what the screen reader and the scroll are asked. */
  async function laidOut(options: { reducedMotion?: boolean } = {}) {
    const services = memoryServices();
    await services.store.saveProfile({ ...newProfile(), settings: { sound: true, reducedMotion: options.reducedMotion === true }, unlocked: { rider: { at: 5, gameId: 'g' } } });
    const rendered = renderGame(<StrictMode><NewLife /></StrictMode>, services);
    await screen.findByRole('radio', { name: /^Delivery rider/ });
    await settled();
    scrollBox().scrollTo = scrollTo;
    layOut(scrollBox(), { y: 0, height: 600 });
    layOut(screen.getByRole('radiogroup'), { y: 100, height: 400 });
    return rendered;
  }
  const original = (AccessibilityInfo as unknown as { sendAccessibilityEvent?: unknown }).sendAccessibilityEvent;
  beforeEach(() => {
    focus.mockClear();
    scrollTo.mockClear();
    (AccessibilityInfo as unknown as { sendAccessibilityEvent: unknown }).sendAccessibilityEvent = focus;
  });
  afterEach(() => {
    (AccessibilityInfo as unknown as { sendAccessibilityEvent: unknown }).sendAccessibilityEvent = original;
    vi.restoreAllMocks();
  });

  it('scrolls to the life it picked once that tile has moved to where it stands, and puts the screen reader on it', async () => {
    await laidOut();
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    fireEvent.click(dice());
    const rider = screen.getByRole('radio', { name: /^Delivery rider/ });
    expect(rider.getAttribute('aria-checked')).toBe('true');
    // The tile opens across a row and the others move: it is not known where it stands until the page says so.
    expect(scrollTo).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
    layOut(tileOf(/^Delivery rider/), { y: 800, height: 100 });
    // Its foot at the foot of the page, and the 12 of room: 100 for the group, 800 down it, 100 tall.
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ y: 100 + 800 + 100 + 12 - 600, animated: true });
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith(rider, 'focus');
  });

  it('does not scroll to a life that is in view, but still puts the screen reader on it', async () => {
    await laidOut();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    fireEvent.click(dice());
    expect(screen.getByRole('radio', { name: /^Software engineer/ }).getAttribute('aria-checked')).toBe('true');
    layOut(tileOf(/^Software engineer/), { y: 80, height: 100 });
    expect(scrollTo).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalledWith(screen.getByRole('radio', { name: /^Software engineer/ }), 'focus');
  });

  it('jumps where the player has asked for no motion', async () => {
    await laidOut({ reducedMotion: true });
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    fireEvent.click(dice());
    layOut(tileOf(/^Delivery rider/), { y: 800, height: 100 });
    expect(scrollTo).toHaveBeenCalledWith({ y: 412, animated: false });
  });

  it('does it once for each roll, and for no other change of the tile: a life chosen by a tap stays where it is, and a tile laid out again does not scroll the page', async () => {
    await laidOut();
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    fireEvent.click(dice());
    layOut(tileOf(/^Delivery rider/), { y: 800, height: 100 });
    layOut(tileOf(/^Delivery rider/), { y: 805, height: 100 });
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('radio', { name: /^Civil servant/ }));
    layOut(tileOf(/^Civil servant/), { y: 900, height: 100 });
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('picks its life outside the update of the state: one random number for one press, even where the page is drawn twice to find impure work', async () => {
    await laidOut();
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    random.mockClear();
    fireEvent.click(dice());
    expect(random).toHaveBeenCalledTimes(1);
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
    fireEvent.click(await screen.findByRole('radio', { name: /^Offline/ }));
    fireEvent.click(screen.getByRole('button', START));
    await waitFor(() => expect(asked).toEqual([{ ranked: false, replace: undefined }]));
  });

  it('offers no ranked life where nobody is signed in, and asks for none', async () => {
    const { services, asked } = signedIn({ kind: 'offline' });
    renderGame(<NewLife />, services);
    await screen.findAllByRole('radio');
    expect(screen.queryByRole('radiogroup', { name: 'How to play' })).toBeNull();
    expect(screen.queryByText(/will not be ranked/)).toBeNull();
    fireEvent.click(screen.getByRole('button', START));
    await waitFor(() => expect(asked).toEqual([{ ranked: false, replace: undefined }]));
  });

  it('says so, before the life begins, when there is an account and no connection', async () => {
    network.connected = false;
    const { services, asked } = signedIn();
    renderGame(<NewLife />, services, 'es');
    expect((await screen.findByRole('status')).textContent).toBe('Sin conexión: esta vida no será clasificatoria.');
    expect(screen.queryByRole('radiogroup', { name: 'Cómo jugar' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Empezar esta vida' }));
    await waitFor(() => expect(asked).toEqual([{ ranked: false, replace: undefined }]));
  });

  it('turns the ranked choice into the note as the connection goes, and back as it returns', async () => {
    const { services } = signedIn();
    renderGame(<NewLife />, services);
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
    await screen.findAllByRole('radio');
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
    fireEvent.click(await screen.findByRole('button', START));
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
    fireEvent.click(await screen.findByRole('button', START));
    const sheet = await elsewhere();
    sheets.gone = new Promise<void>((done) => (gone = done));
    fireEvent.click(await ready(sheet, 'Continue that life'));
    await waitFor(async () => expect(((await phone.store.loadGame()) as RankedGame | null)?.gameId).toBe(there.gameId));
    await new Promise((done) => setTimeout(done, 30));
    expect(router.replace).not.toHaveBeenCalled();
    gone();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
    expect(server.games.get(there.gameId)?.status).toBe('playing');
    expect(server.games.size).toBe(1);
  });

  it('is ended, and the new life begun, only when the player says so, once the sheet has gone', async () => {
    const { server, there, phone } = await twoDevices();
    let gone: () => void = () => undefined;
    renderGame(<NewLife />, phone);
    fireEvent.click(await screen.findByRole('radio', { name: /Software engineer/ }));
    fireEvent.click(screen.getByRole('button', START));
    const sheet = await elsewhere();
    sheets.gone = new Promise<void>((done) => (gone = done));
    fireEvent.click(await ready(sheet, 'End it and start this one'));
    await waitFor(() => expect(server.games.get(there.gameId)?.status).toBe('abandoned'));
    await waitFor(async () => expect((await phone.store.loadGame()) as RankedGame).toMatchObject({ ranked: true, lifeId: 'engineer' }));
    await new Promise((done) => setTimeout(done, 30));
    expect(router.replace).not.toHaveBeenCalled();
    gone();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
  });

  it('cannot be taken up here when it was begun under older rules, and the sheet says so', async () => {
    const { server, there, phone } = await twoDevices();
    (server.games.get(there.gameId) as { engine_version: string }).engine_version = '0.0.1';
    renderGame(<NewLife />, phone, 'es');
    fireEvent.click(await screen.findByRole('button', { name: 'Empezar esta vida' }));
    const sheet = await elsewhere('Una vida clasificatoria en curso');
    expect(sheet.textContent).toContain('Empezó con otras reglas y no se puede seguir en este dispositivo.');
    expect(within(sheet).queryByRole('button', { name: 'Seguir con esa vida' })).toBeNull();
    expect(within(sheet).getByRole('button', { name: 'Terminarla y empezar esta' })).toBeTruthy();
  });

  it('says so when that life cannot be taken up just now, and keeps the question open', async () => {
    const { server, phone } = await twoDevices();
    renderGame(<NewLife />, phone);
    fireEvent.click(await screen.findByRole('button', START));
    const sheet = await elsewhere();
    server.state.down = true;
    fireEvent.click(await ready(sheet, 'Continue that life'));
    expect((await within(sheet).findByRole('alert')).textContent).toBe('The server did not answer. Try again.');
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'A ranked life in progress' })).toBeTruthy();
  });
});
