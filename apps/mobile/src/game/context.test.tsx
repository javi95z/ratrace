// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { content, lives } from '@ratrace/content';
import { LocalSessions } from '@ratrace/core/session/local';
import { MemoryStore } from '@ratrace/core/session/memory';
import { newProfile, SAVE_FORMAT } from '@ratrace/core/session/types';
import { localeOf } from './locale';

const phone = vi.hoisted(() => ({ languages: ['en'] as string[], kept: new Map<string, string>(), sound: [] as boolean[], motion: [] as boolean[] }));
vi.mock('expo-localization', () => ({
  getLocales: () => phone.languages.map((languageCode) => ({ languageCode, languageTag: languageCode })),
  getCalendars: () => [{ timeZone: 'Europe/Madrid' }],
}));
vi.mock('expo-sqlite/kv-store', () => ({
  default: {
    getItemSync: (key: string) => phone.kept.get(key) ?? null,
    setItemSync: (key: string, value: string) => void phone.kept.set(key, value),
  },
}));
// What the providers of the kit are handed: the profile's settings.
vi.mock('../ui/sound', () => ({
  SoundProvider: ({ on, children }: { on: boolean; children: ReactNode }) => {
    phone.sound.push(on);
    return children;
  },
}));
vi.mock('../ui/animations', () => ({
  ReducedMotionProvider: ({ value, children }: { value: boolean; children: ReactNode }) => {
    phone.motion.push(value);
    return children;
  },
}));

const { GameProvider, phoneDeps, useGame, useSettings, useT, useWords } = await import('./context');

afterEach(() => {
  cleanup();
  phone.languages = ['en'];
  phone.kept.clear();
  phone.sound.length = 0;
  phone.motion.length = 0;
});

function services(store = new MemoryStore()) {
  let n = 0;
  const deps = { newId: () => `id-${(n += 1)}`, newSeed: () => 'a'.repeat(64), now: () => 0 };
  return { sessions: new LocalSessions(store, content, lives, deps), store };
}

type Seen = { title: string; money: string; status: string; locale: string; setLocale: (l: 'en' | 'es' | 'ru') => void };
function Probe({ onSeen }: { onSeen: (seen: Seen) => void }) {
  const t = useT('meta');
  const { fmt } = useWords();
  const status = useGame((s) => s.status);
  const { locale, setLocale } = useSettings();
  onSeen({ title: t('titles.new'), money: fmt.money(1234567), status, locale, setLocale });
  return null;
}
function mount(store?: MemoryStore) {
  const seen = {} as Seen;
  render(
    <GameProvider services={services(store)}>
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
  phone.languages = ['es'];
  const seen = mount();
  expect(seen.locale).toBe('es');
  expect(seen.title).toBe('Elige una vida');
  expect(seen.money).toBe('12.346 $');
});

test('a language the player chose is kept on the phone and used from then on', async () => {
  phone.languages = ['en'];
  const seen = mount();
  expect(seen.title).toBe('Choose a life');
  act(() => seen.setLocale('ru'));
  expect(seen.locale).toBe('ru');
  expect(seen.title).toBe('Выбери жизнь');
  expect(phone.kept.get('ratrace:locale')).toBe('ru');
  cleanup();
  const again = mount();
  expect(again.locale).toBe('ru');
});

test('the round store boots: with nothing saved there is no life', async () => {
  const seen = mount();
  await waitFor(() => expect(seen.status).toBe('none'));
});

test('sound and reduced motion follow the profile\'s settings', async () => {
  const store = new MemoryStore();
  await store.saveProfile({ ...newProfile(), settings: { sound: false, reducedMotion: true } });
  mount(store);
  await waitFor(() => {
    expect(phone.sound.at(-1)).toBe(false);
    expect(phone.motion.at(-1)).toBe(true);
  });
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
  render(<GameProvider services={services()}><Words /></GameProvider>);
  await waitFor(() => expect(seen.length).toBeGreaterThan(1));
  act(() => settings.setSound(!settings.sound));
  await waitFor(() => expect(settings.sound).toBe(false));
  expect(new Set(seen).size).toBe(1);
  act(() => settings.setLocale('es'));
  await waitFor(() => expect(settings.locale).toBe('es'));
  expect(new Set(seen).size).toBe(2);
});
