// @vitest-environment jsdom
import { content, lives } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import type { OlderRules } from '@ratrace/core/session/legacy';
import { LocalSessions } from '@ratrace/core/session/local';
import { MemoryStore } from '@ratrace/core/session/memory';
import type { SavedGame } from '@ratrace/core/session/types';
import { expect, test, vi } from 'vitest';
import { BUNDLED } from '../rules';
import { OLDER, olderLife } from '../testing/olderLife';
import { loadBundledRules } from './olderRules';

// What the phone's context reaches for when it is read: the device, and the providers of the kit.
vi.mock('expo-localization', () => ({ getLocales: () => [], getCalendars: () => [] }));
vi.mock('expo-sqlite/kv-store', () => ({ default: {} }));
vi.mock('../ui/sound', () => ({ SoundProvider: ({ children }: { children: unknown }) => children }));
vi.mock('../ui/animations', () => ({ ReducedMotionProvider: ({ children }: { children: unknown }) => children }));
const { phoneDeps } = await import('./context');

const loaded = async (versions: { engine: string; content: string }) => (await loadBundledRules(versions)) as OlderRules;

test('a bundled version gives the rules it was shipped with: the engine and the content of that version', async () => {
  const rules = (await loadBundledRules({ engine: '0.37.0', content: '1.38.0' })) as unknown as Record<string, unknown>;
  expect(rules).toMatchObject({ ENGINE_VERSION: '0.37.0', CONTENT_VERSION: '1.38.0' });
  expect(typeof rules.stepLife).toBe('function');
  expect(typeof rules.viewOf).toBe('function');
  expect(typeof rules.replayLife).toBe('function');
  expect(Array.isArray(rules.lives)).toBe(true);
});

test('every bundle the app carries is the one its key names', async () => {
  expect(Object.keys(BUNDLED).length).toBeGreaterThan(10);
  for (const key of Object.keys(BUNDLED)) {
    const [engine, content] = key.split('-');
    const rules = (await loadBundledRules({ engine, content })) as unknown as Record<string, unknown>;
    expect(rules, key).toMatchObject({ ENGINE_VERSION: engine, CONTENT_VERSION: content });
  }
});

test('rules the app does not carry wait for an update, kept: unreachable, never gone', async () => {
  for (const versions of [
    { engine: '0.0.1', content: '0.0.1' },
    { engine: '0.37.0', content: '1.0.0' },
    { engine: '99.0.0', content: '99.0.0' },
    { engine: '__proto__', content: 'constructor' },
    { engine: '', content: '' },
  ]) {
    expect(await loadBundledRules(versions), JSON.stringify(versions)).toBe('unreachable');
  }
});

test('a bundle that cannot be run is unreachable too, so the life waits instead of being let go', async () => {
  const keep = BUNDLED['0.37.0-1.38.0'];
  BUNDLED['0.37.0-1.38.0'] = () => {
    throw new Error('this phone cannot run it');
  };
  try {
    expect(await loadBundledRules({ engine: '0.37.0', content: '1.38.0' })).toBe('unreachable');
  } finally {
    BUNDLED['0.37.0-1.38.0'] = keep;
  }
});

test('the fixture is a life of those rules one round in, and their log plays it back to the same game', async () => {
  const rules = await loaded(OLDER);
  const save = olderLife(rules, 5);
  expect(save).toMatchObject({ engineVersion: '0.37.0', contentVersion: '1.38.0', lifeId: 'nurse', updatedAt: 5 });
  expect(save.log).toHaveLength(1);
  expect(save.log[0].picks.length).toBeGreaterThan(0);
  expect(save.log[0].orders).toEqual([]);
  expect(save.state.round).toBe(1);
  const start = rules.lives.find((life) => life.id === 'nurse')?.start;
  expect(rules.replayLife(rules.content, start, save.seed, save.log).state).toEqual(save.state);
});

test('a life saved under older rules opens through the phone\'s deps and plays a round under them, and is saved as theirs', async () => {
  const store = new MemoryStore();
  await store.saveGame(olderLife(await loaded(OLDER), 5));
  let clock = 10;
  const sessions = new LocalSessions(store, content, lives, { ...phoneDeps(), now: () => (clock += 1) });
  const { session, lost } = await sessions.resume();
  expect(lost).toBeNull();
  expect(session?.rules).toBe('0.37.0');
  expect(session?.view().round).toBe(1);
  while (session?.view().phase === 'cards') await session.answerCard(0);
  await session?.playRound({ orders: [] });
  expect(session?.view().round).toBe(2);
  const saved = (await store.loadGame()) as SavedGame;
  expect(saved).toMatchObject({ engineVersion: '0.37.0', contentVersion: '1.38.0' });
  expect(saved.log).toHaveLength(2);
  expect(saved.state.round).toBe(2);
});

test('a life under rules newer than the app waits, kept and untouched, to be opened by the newer app that wrote it', async () => {
  const older = olderLife(await loaded(OLDER), 5);
  for (const newer of [
    { engineVersion: '99.0.0', contentVersion: '99.0.0' },
    { engineVersion: '99.0.0', contentVersion: older.contentVersion },
    { engineVersion: ENGINE_VERSION, contentVersion: '99.0.0' },
  ]) {
    const store = new MemoryStore();
    const saved = { ...older, ...newer };
    await store.saveGame(saved);
    const loadRules = vi.fn(loadBundledRules);
    const sessions = new LocalSessions(store, content, lives, { ...phoneDeps(), loadRules });
    expect(await sessions.resume(), JSON.stringify(newer)).toEqual({ session: null, lost: 'newer' });
    expect(await store.loadGame()).toEqual(saved);
    expect(loadRules).not.toHaveBeenCalled();
  }
});
