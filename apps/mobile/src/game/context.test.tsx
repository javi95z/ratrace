// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { content, lives } from '@ratrace/content';
import type { RoundActions, RoundState } from '@ratrace/core/game/store';
import { LocalSessions } from '@ratrace/core/session/local';
import { MemoryStore } from '@ratrace/core/session/memory';
import { newProfile, SAVE_FORMAT } from '@ratrace/core/session/types';
import type { Order } from '@ratrace/engine';
import { device, heard, kv, memoryServices, renderGame } from '../testing/render';
import { phoneBasket } from './phoneBasket';
import { localeOf } from './locale';
import { GameProvider, phoneDeps, phoneServices, useClock, useGame, useGuide, useProfile, useRuns, useSettings, useSound, useStill, useT, useWords } from './context';
import { settled } from '../testing/renders';

afterEach(cleanup);

type Seen = { title: string; money: string; status: string; locale: string; setLocale: (l: 'en' | 'es' | 'ru') => void };
function Probe({ onSeen }: { onSeen: (seen: Seen) => void }) {
  const t = useT('meta');
  const { fmt } = useWords();
  const status = useGame((s) => s.status);
  const { locale, setLocale } = useSettings();
  onSeen({ title: t('titles.new'), money: fmt.money(1234567), status, locale, setLocale });
  return null;
}
/** The game as the phone would start it: the language is the phone's own, or the one kept on it. */
function mount(store?: MemoryStore) {
  const seen = {} as Seen;
  render(
    <GameProvider services={memoryServices(store)}>
      <Probe onSeen={(s) => Object.assign(seen, s)} />
    </GameProvider>,
  );
  return seen;
}

test('the language is the first of the phone\'s the game speaks, else English; a kept choice wins', () => {
  expect(localeOf(null, ['es', 'en'])).toBe('es');
  expect(localeOf(null, ['de', 'ru', 'es'])).toBe('ru');
  expect(localeOf(null, ['de', 'fr'])).toBe('en');
  expect(localeOf(null, [])).toBe('en');
  expect(localeOf('ru', ['es'])).toBe('ru');
  expect(localeOf('xx', ['es'])).toBe('es');
});

test('a Spanish phone gets the web\'s Spanish words and numbers', () => {
  device.languages = ['es'];
  const seen = mount();
  expect(seen.locale).toBe('es');
  expect(seen.title).toBe('Elige una vida');
  expect(seen.money).toBe('12.346\u00a0$');
});

test('a language the player chose is kept on the phone and used from then on', async () => {
  device.languages = ['en'];
  const seen = mount();
  expect(seen.title).toBe('Choose a life');
  act(() => seen.setLocale('ru'));
  expect(seen.locale).toBe('ru');
  expect(seen.title).toBe('Выбери жизнь');
  expect(kv.get('ratrace:locale')).toBe('ru');
  cleanup();
  const again = mount();
  expect(again.locale).toBe('ru');
});

test('the round store boots: with nothing saved there is no life', async () => {
  const seen = mount();
  await waitFor(() => expect(seen.status).toBe('none'));
});

/** The sound and the stillness a screen is given, and what it asks of the game. */
function Settled({ onSeen }: { onSeen: (seen: { play: ReturnType<typeof useSound>; still: boolean; settings: ReturnType<typeof useSettings> }) => void }) {
  onSeen({ play: useSound(), still: useStill(), settings: useSettings() });
  return null;
}
function settle(store: MemoryStore) {
  const seen = {} as Parameters<Parameters<typeof Settled>[0]['onSeen']>[0];
  renderGame(<Settled onSeen={(s) => Object.assign(seen, s)} />, memoryServices(store));
  return seen;
}

test('sound and reduced motion follow the profile\'s settings', async () => {
  const store = new MemoryStore();
  await store.saveProfile({ ...newProfile(), settings: { sound: false, reducedMotion: true } });
  const seen = settle(store);
  await waitFor(() => {
    expect(seen.still).toBe(true);
    expect(seen.settings.sound).toBe(false);
  });
  seen.play('coin');
  expect(heard).toEqual([]);
  act(() => seen.settings.setSound(true));
  await waitFor(() => expect(seen.settings.sound).toBe(true));
  seen.play('coin');
  expect(heard).toEqual(['coin']);
  act(() => seen.settings.setReducedMotion(false));
  await waitFor(() => expect(seen.still).toBe(false));
});

test('motion is left in by default: still is the same as reduced motion', () => {
  const seen = settle(new MemoryStore());
  expect(seen.still).toBe(false);
  expect(seen.settings.reducedMotion).toBe(false);
  expect(seen.settings.sound).toBe(true);
});

/** The round on screen, to drive from a test the way a screen would. */
function Round({ onSeen }: { onSeen: (state: RoundState & RoundActions) => void }) {
  onSeen(useGame((s) => s));
  return null;
}
function round(services: Parameters<typeof renderGame>[1]) {
  const seen = { state: {} as RoundState & RoundActions };
  renderGame(<Round onSeen={(state) => (seen.state = state)} />, services);
  return seen;
}

test('the round on screen is heard: a card dealt, a choice made, as the web plays them', async () => {
  const seen = round(memoryServices());
  await waitFor(() => expect(seen.state.status).toBe('none'));
  await act(() => seen.state.start('nurse'));
  expect(heard).toEqual([]);
  act(() => seen.state.leaveNews());
  expect(heard).toEqual(['card']);
  await act(() => seen.state.pick(0));
  expect(heard).toEqual(['card', 'pick']);
});

test('a round heard with the sound off makes no sound', async () => {
  const store = new MemoryStore();
  await store.saveProfile({ ...newProfile(), settings: { sound: false, reducedMotion: false } });
  const seen = round(memoryServices(store));
  await waitFor(() => expect(seen.state.status).toBe('none'));
  await act(() => seen.state.start('nurse'));
  act(() => seen.state.leaveNews());
  expect(seen.state.stage).toBe('cards');
  expect(heard).toEqual([]);
});

test('a life saved under rules the app does not carry waits on the phone, kept, and is never deleted', async () => {
  const store = new MemoryStore();
  const older = { format: SAVE_FORMAT, gameId: 'older-life', engineVersion: '0.0.1', contentVersion: '0.0.1', lifeId: 'nurse', seed: 'older-seed', log: [], updatedAt: 1 };
  await store.saveGame(older as never);
  const sessions = new LocalSessions(store, content, lives, phoneDeps());
  expect(await sessions.resume()).toEqual({ session: null, lost: 'waiting' });
  expect(await store.loadGame()).toEqual(older);
});

test('the words are made once for a language: a change of the profile hands every screen the same ones', async () => {
  const seen: unknown[] = [];
  let settings = {} as ReturnType<typeof useSettings>;
  function Words() {
    seen.push(useWords());
    settings = useSettings();
    return null;
  }
  render(<GameProvider services={memoryServices()}><Words /></GameProvider>);
  // Whatever the game does as it opens, once it has settled.
  await settled();
  act(() => settings.setSound(!settings.sound));
  await waitFor(() => expect(settings.sound).toBe(false));
  expect(new Set(seen).size).toBe(1);
  act(() => settings.setLocale('es'));
  await waitFor(() => expect(settings.locale).toBe('es'));
  expect(new Set(seen).size).toBe(2);
});

test('the orders in the basket survive the app being closed in the middle of a round, on the same key-value store', async () => {
  const study: Order = { type: 'focus', action: 'studyCareer' };
  expect(phoneServices().basket).toBe(phoneBasket);

  // The first start of the app: a life is begun, its cards answered, and an order put in the basket in the finances.
  const first = round({ ...phoneServices(), tapGuardMs: 0 });
  await waitFor(() => expect(first.state.status).toBe('none'));
  await act(() => first.state.start('nurse'));
  act(() => first.state.leaveNews());
  while (first.state.stage === 'cards') {
    await act(() => first.state.pick(0));
    act(() => first.state.afterCard());
  }
  expect(first.state.stage).toBe('finance');
  act(() => void first.state.addOrder(study));
  expect(first.state.orders).toEqual([study]);
  const where = { round: first.state.view?.round, gameId: first.state.gameId };
  expect(JSON.parse(kv.get('ratrace:basket') as string)).toEqual({ gameId: where.gameId, round: where.round, orders: [study] });

  // The app is killed. The next start knows nothing of the first but what the phone kept.
  cleanup();
  const second = round({ ...phoneServices(), tapGuardMs: 0 });
  await waitFor(() => expect(second.state.status).toBe('playing'));
  expect(second.state).toMatchObject({ gameId: where.gameId, stage: 'finance', orders: [study] });
  expect(second.state.view?.round).toBe(where.round);
});

test('the phone\'s store hands on the finished lives the device makes anew, without copying them again, and counts them by their ids', async () => {
  const { store } = phoneServices();
  const run = { format: SAVE_FORMAT, runId: 'r1', lifeId: 'nurse', finishedAt: 5, log: [{ picks: [0], orders: [] }] } as never;
  await store.addRun(run);
  expect(await store.runIds!()).toEqual(['r1']);
  const cloned = vi.spyOn(globalThis, 'structuredClone');
  try {
    const [one] = await store.listRuns();
    const [two] = await store.listRuns();
    // No copy on the way (`freshReads`): each list is the device's own, made anew from its text.
    expect(cloned).not.toHaveBeenCalled();
    expect(one).toEqual(two);
    expect(one).not.toBe(two);
    expect(one.log).not.toBe(two.log);
  } finally {
    cloned.mockRestore();
  }
});

test('the date a screen reads is the services\' own clock, and the phone\'s where they have none', () => {
  let clock = () => -1;
  function Clock() {
    clock = useClock();
    return null;
  }
  render(<GameProvider services={memoryServices()}><Clock /></GameProvider>);
  expect(Math.abs(clock() - Date.now())).toBeLessThan(1_000);
  cleanup();
  render(<GameProvider services={{ ...memoryServices(), now: () => 1_792_670_400_000 }}><Clock /></GameProvider>);
  expect(clock()).toBe(1_792_670_400_000);
  expect(clock()).toBe(1_792_670_400_000);
});

/** The device as the context reads it, counted: the services' store is a window on the same memory the game's own session writes to. */
function counting(store: MemoryStore) {
  const calls = { profile: 0, runs: 0 };
  const seen = new Proxy(store, {
    get(target, name) {
      if (name === 'loadProfile') return () => (calls.profile += 1, target.loadProfile());
      if (name === 'listRuns') return () => (calls.runs += 1, target.listRuns());
      const value = Reflect.get(target, name);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { calls, services: { ...memoryServices(store), store: seen } };
}

/** A screen that takes the round's actions and keeps the state the game is in, for a test to play it. */
function player() {
  const hold = { state: null as (RoundState & RoundActions) | null };
  function Hand() {
    useGame((s) => ((hold.state = s), s.status));
    return null;
  }
  return { hold, Hand };
}

test('the device is read as little as the game needs: the profile when the game opens and with each step, the finished lives only when it opens and when a life ends or is let go', async () => {
  const store = new MemoryStore();
  await memoryServices(store).sessions.start('nurse');
  const { calls, services } = counting(store);
  const { hold, Hand } = player();
  render(<GameProvider services={services}><Hand /></GameProvider>);
  await settled();
  // Opening: the lives are read once, and the check of the ranks uses what was read; the profile twice, as the provider mounts and as the life opens (which tells it what the life has earned).
  expect(calls).toEqual({ profile: 2, runs: 1 });

  // A step that changes the round on screen: the profile is read again (what was earned), the lives are not.
  await settled(async () => {
    hold.state!.leaveNews();
    await hold.state!.pick(0);
  });
  expect(calls.runs).toBe(1);
  expect(calls.profile).toBeGreaterThan(1);
  const afterStep = calls.profile;

  // A step that changes nothing of the round (the result left for the next card) reads nothing.
  await settled(() => hold.state!.afterCard());
  expect(calls).toEqual({ profile: afterStep, runs: 1 });

  // The life let go: the status changes, and the lives are read again.
  await settled(() => hold.state!.abandon());
  expect(calls.runs).toBe(2);
});

test('a life lived to its end reads the finished lives again, once: the one that has just finished is among them', async () => {
  const store = new MemoryStore();
  await memoryServices(store).sessions.start('nurse');
  const { calls, services } = counting(store);
  const { hold, Hand } = player();
  const read = renderGame(<Hand />, services);
  await settled();
  // Every round: the news, the cards, the finances with an empty basket, the ledger.
  for (let guard = 0; guard < 400 && hold.state!.stage !== 'end'; guard++) {
    const state = hold.state!;
    if (state.stage === 'news') await settled(() => state.leaveNews(), 0);
    else if (state.stage === 'cards') await settled(() => state.pick(0), 0);
    else if (state.stage === 'outcome') await settled(() => state.afterCard(), 0);
    else if (state.stage === 'finance') await settled(() => state.play(), 0);
    else if (state.stage === 'resolve') await settled(() => state.next(), 0);
  }
  await settled();
  expect(hold.state!.stage).toBe('end');
  expect(hold.state!.view?.finished).toBe(true);
  // Opening, and the end of the life: no round of it read the lives.
  expect(calls.runs).toBe(2);
  expect((await store.listRuns()).length).toBe(1);
  read.unmount();
}, 120_000);

test('a life that ends with a badge of the gallery is held among the finished lives with that badge: the run written again with it is the one read', async () => {
  // `sameRuns` keeps the list held when one read again has as many lives and the same latest: right only if the lives are read once the run
  // is written for the last time. The step that ends a life writes its run, then again with the badges of the gallery the profile counts as its
  // own (core's session); the round store tells the screens of the end only after that step, and the lives are read then.
  const store = new MemoryStore();
  const owned = content.items.filter((item) => item.id !== 'watch_casio').slice(0, 19).map((item) => item.id);
  await store.saveProfile({ ...(await store.loadProfile()), gallery: owned });
  const session = await memoryServices(store).sessions.start('nurse');
  while (session.view().round < content.rounds - 1) {
    while (session.view().phase === 'cards') await session.answerCard(0);
    await session.playRound({ orders: [] });
  }
  const { hold, Hand } = player();
  const held = { runs: null as ReturnType<typeof useRuns> };
  function Runs() {
    held.runs = useRuns();
    return null;
  }
  const read = renderGame(<><Hand /><Runs /></>, memoryServices(store));
  await settled();
  expect(held.runs).toEqual([]);
  for (let guard = 0; guard < 40 && hold.state!.stage !== 'finance'; guard++) {
    const state = hold.state!;
    if (state.stage === 'news') await settled(() => state.leaveNews(), 0);
    else if (state.stage === 'cards') await settled(() => state.pick(0), 0);
    else if (state.stage === 'outcome') await settled(() => state.afterCard(), 0);
  }
  // The twentieth thing, bought on the last round: the gallery's badge is earned by the step that ends the life.
  await settled(() => void hold.state!.addOrder({ type: 'buyItem', itemId: 'watch_casio' }), 0);
  await settled(() => hold.state!.play());
  await waitFor(() => expect(held.runs).toHaveLength(1));
  await settled();
  expect(hold.state!.view?.finished).toBe(true);
  expect(held.runs![0].badges).toContain('twenty_items');
  expect((await store.listRuns())[0].badges).toContain('twenty_items');
  read.unmount();
}, 120_000);

/** Counts how often each kind of screen is drawn: the game's own (what is played), the words, the date, the settings, the lives, the profile. */
function drawings() {
  const count = { game: 0, words: 0, clock: 0, text: 0, settings: 0, runs: 0, profile: 0, guide: 0 };
  let settings = {} as ReturnType<typeof useSettings>;
  function Game() {
    useGame((s) => s.status);
    count.game += 1;
    return null;
  }
  function Words() {
    useWords();
    count.words += 1;
    return null;
  }
  function Clock() {
    useClock();
    count.clock += 1;
    return null;
  }
  function Text() {
    useT('meta');
    count.text += 1;
    return null;
  }
  function Settings() {
    settings = useSettings();
    count.settings += 1;
    return null;
  }
  function Runs() {
    useRuns();
    count.runs += 1;
    return null;
  }
  function Profile() {
    useProfile();
    count.profile += 1;
    return null;
  }
  function Guide() {
    useGuide();
    count.guide += 1;
    return null;
  }
  return {
    count,
    settings: () => settings,
    screens: (
      <>
        <Game />
        <Words />
        <Clock />
        <Text />
        <Settings />
        <Runs />
        <Profile />
        <Guide />
      </>
    ),
  };
}

test('a change of the profile draws again only what reads the profile: not what plays the game, the words or the date', async () => {
  const seen = drawings();
  renderGame(seen.screens, memoryServices());
  await settled();
  const before = { ...seen.count };
  await settled(() => seen.settings().setSound(!seen.settings().sound));
  expect(seen.count.settings).toBeGreaterThan(before.settings);
  expect(seen.count.profile).toBeGreaterThan(before.profile);
  expect(seen.count.guide).toBeGreaterThan(before.guide);
  // The game, the words, the date, the text and the finished lives have nothing to do with it.
  for (const unmoved of ['game', 'words', 'clock', 'text', 'runs'] as const) expect(seen.count[unmoved], unmoved).toBe(before[unmoved]);
});

test('a step of the game that earns nothing draws nothing again that the game itself does not draw: not the settings, the lives, the profile, the words', async () => {
  const store = new MemoryStore();
  await memoryServices(store).sessions.start('nurse');
  const seen = drawings();
  const { hold, Hand } = player();
  renderGame(<>{seen.screens}<Hand /></>, memoryServices(store));
  await settled();
  const before = { ...seen.count };
  await settled(async () => {
    hold.state!.leaveNews();
    await hold.state!.pick(0);
  });
  // The profile is read again after the step and says what it said: nothing that reads it is drawn again.
  for (const unmoved of ['words', 'clock', 'text', 'settings', 'runs', 'guide'] as const) expect(seen.count[unmoved], unmoved).toBe(before[unmoved]);
});

test('a language chosen draws everything that has words again, and the settings and lives it does not touch only as often as they changed', async () => {
  const seen = drawings();
  renderGame(seen.screens, memoryServices());
  await settled();
  const before = { ...seen.count };
  await settled(() => seen.settings().setLocale('es'));
  expect(seen.count.words).toBeGreaterThan(before.words);
  expect(seen.count.text).toBeGreaterThan(before.text);
  // The lives and the profile are the same ones.
  expect(seen.count.runs).toBe(before.runs);
  expect(seen.count.profile).toBe(before.profile);
});
