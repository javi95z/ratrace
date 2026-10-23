import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newProfile } from '@ratrace/core/session/types';
import type { FinishedRun, SavedGame } from '@ratrace/core/session/types';
import { LocalStore } from '../../web/src/session/indexeddb';
import { kvBasket, kvKeeping, kvLanguage, kvLastAccount, KvStore, kvPush, kvSession, kvText } from './kvStore';

/*
 * On the web the app keeps the player's things where the Next web keeps them: the same IndexedDB (`ratrace`, its three stores), the same
 * localStorage and sessionStorage keys, the same cookie. A player who opens the app where the Next web was finds their lives as they left them.
 * The Next web's own store is the witness here: what it wrote, this reads, and what this writes, it reads.
 */

const game = (over: Partial<SavedGame> = {}): SavedGame =>
  ({ format: 1, gameId: 'g', engineVersion: 'e', contentVersion: 'c', lifeId: 'nurse', seed: 's', log: [], history: [1], bankruptcies: 0, state: { round: 0 }, updatedAt: 1, ...over }) as SavedGame;
const run = (runId: string, finishedAt: number): FinishedRun =>
  ({ format: 1, runId, engineVersion: 'e', contentVersion: 'c', lifeId: 'nurse', seed: 's', log: [], finishedAt, score: 300, netWorth: 5, status: 1, escapedAtRound: null, bankruptcies: 0, history: [1, 5], badges: [], cities: ['madrid'], verified: false });

// Each test opens the database `ratrace`, as the app does, in a browser of its own.
beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
  document.cookie = 'NEXT_LOCALE=; path=/; max-age=0';
});

describe('the IndexedDB the Next web keeps', () => {
  it('reads back a game, two finished lives and a profile that the Next web wrote', async () => {
    const next = new LocalStore();
    const profile = { ...newProfile(), seenGuide: true } as ReturnType<typeof newProfile>;
    await next.saveGame(game());
    await next.addRun(run('a', 10));
    await next.addRun(run('b', 30));
    await next.saveProfile(profile);

    const store = new KvStore();
    expect(await store.loadGame()).toEqual(game());
    expect((await store.listRuns()).map((one) => one.runId)).toEqual(['b', 'a']);
    expect(await store.listRuns()).toEqual(await next.listRuns());
    expect(await store.loadProfile()).toEqual(await next.loadProfile());
  });

  it('writes what the Next web reads', async () => {
    const store = new KvStore();
    const profile = { ...newProfile(), seenGuide: true } as ReturnType<typeof newProfile>;
    await store.saveGame(game({ gameId: 'mine' }));
    await store.addRun(run('x', 5));
    await store.addRun(run('y', 7));
    await store.removeRun('x');
    await store.saveProfile(profile);

    const next = new LocalStore();
    expect(await next.loadGame()).toEqual(game({ gameId: 'mine' }));
    expect((await next.listRuns()).map((one) => one.runId)).toEqual(['y']);
    expect(await next.loadProfile()).toEqual(await store.loadProfile());
    await store.clearGame();
    expect(await next.loadGame()).toBeNull();
  });

  it('keeps the game in the page when the browser has no IndexedDB', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const store = new KvStore();
    expect(await store.loadGame()).toBeNull();
    await store.saveGame(game({ gameId: 'in-memory' }));
    expect(await store.loadGame()).toEqual(game({ gameId: 'in-memory' }));
    await store.addRun(run('m', 1));
    expect((await store.listRuns()).map((one) => one.runId)).toEqual(['m']);
  });
});

describe('the keys of the browser', () => {
  it('keeps the basket in localStorage under ratrace.basket, and takes it away for null', () => {
    kvBasket.write('x');
    expect(localStorage.getItem('ratrace.basket')).toBe('x');
    expect(kvBasket.read()).toBe('x');
    kvBasket.write(null);
    expect(localStorage.getItem('ratrace.basket')).toBeNull();
    expect(kvBasket.read()).toBeNull();
  });

  it('keeps the language in the NEXT_LOCALE cookie', () => {
    expect(kvLanguage.read()).toBeNull();
    kvLanguage.write('es');
    expect(document.cookie).toContain('NEXT_LOCALE=es');
    expect(kvLanguage.read()).toBe('es');
    kvLanguage.write('ru');
    expect(kvLanguage.read()).toBe('ru');
  });

  it('writes the cookie as the Next web does: the whole site, a year, SameSite lax', () => {
    const set = vi.spyOn(document, 'cookie', 'set');
    kvLanguage.write('es');
    expect(set).toHaveBeenCalledWith('NEXT_LOCALE=es; path=/; max-age=31536000; samesite=lax');
  });

  it('notes a guest gone to keep their account once, in sessionStorage', () => {
    expect(kvKeeping.take()).toBe(false);
    kvKeeping.set();
    expect(sessionStorage.getItem('ratrace:keeping-account')).toBe('1');
    expect(kvKeeping.take()).toBe(true);
    expect(kvKeeping.take()).toBe(false);
    expect(sessionStorage.getItem('ratrace:keeping-account')).toBeNull();
  });

  it('notes the last account in localStorage under ratrace.lastAccount', () => {
    expect(kvLastAccount.read()).toBeNull();
    kvLastAccount.write('user-1');
    expect(localStorage.getItem('ratrace.lastAccount')).toBe('user-1');
    expect(kvLastAccount.read()).toBe('user-1');
  });

  it('notes the notices under ratrace:push, as the phone does', () => {
    expect(kvPush.read()).toBeNull();
    kvPush.write({ state: 'on', token: 't' });
    expect(JSON.parse(localStorage.getItem('ratrace:push') ?? 'null')).toEqual({ state: 'on', token: 't' });
    expect(kvPush.read()).toEqual({ state: 'on', token: 't' });
    localStorage.setItem('ratrace:push', '{"state":"maybe"}');
    expect(kvPush.read()).toBeNull();
  });

  it('reads and writes short texts in localStorage', () => {
    kvText.setItem('ratrace:given-up', '["a"]');
    expect(localStorage.getItem('ratrace:given-up')).toBe('["a"]');
    expect(kvText.getItem('ratrace:given-up')).toBe('["a"]');
    expect(kvText.getItem('nothing')).toBeNull();
  });

  it('keeps the account\'s session in localStorage with no prefix', async () => {
    await kvSession.setItem('sb-x-auth-token', 'v');
    expect(localStorage.getItem('sb-x-auth-token')).toBe('v');
    expect(await kvSession.getItem('sb-x-auth-token')).toBe('v');
    await kvSession.removeItem('sb-x-auth-token');
    expect(await kvSession.getItem('sb-x-auth-token')).toBeNull();
  });

  it('swallows what the browser refuses to write', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('full');
    });
    expect(() => kvBasket.write('x')).not.toThrow();
    expect(() => kvBasket.write(null)).not.toThrow();
    expect(() => kvKeeping.set()).not.toThrow();
    expect(() => kvLastAccount.write('u')).not.toThrow();
    expect(() => kvPush.write({ state: 'off', token: null })).not.toThrow();
    expect(() => kvText.setItem('k', 'v')).not.toThrow();
    await expect(kvSession.setItem('k', 'v')).resolves.toBeUndefined();
    vi.restoreAllMocks();
  });
});
