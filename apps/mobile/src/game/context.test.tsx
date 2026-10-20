// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { content, lives } from '@ratrace/content';
import type { RoundActions, RoundState } from '@ratrace/core/game/store';
import { LocalSessions } from '@ratrace/core/session/local';
import { MemoryStore } from '@ratrace/core/session/memory';
import { newProfile, SAVE_FORMAT } from '@ratrace/core/session/types';
import type { Order } from '@ratrace/engine';
import { device, heard, kv, memoryServices, renderGame } from '../testing/render';
import { phoneBasket } from './phoneBasket';
import { localeOf } from './locale';
import { GameProvider, phoneDeps, phoneServices, useClock, useGame, useSettings, useSound, useStill, useT, useWords } from './context';

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
  await waitFor(() => expect(seen.length).toBeGreaterThan(1));
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
