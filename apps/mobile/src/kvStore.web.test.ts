import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newProfile } from '@ratrace/core/session/types';
import type { FinishedRun, SavedGame } from '@ratrace/core/session/types';
import { LocalStore } from '../../web/src/session/indexeddb';
import { kvBasket, kvForget, kvForgotten, kvKeeping, kvLanguage, kvLanguageChoice, kvLastAccount, KvStore, kvPush, kvSession, kvText } from './kvStore';

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

  it('notes the language chosen until it is sent, where the next document of the site can read it', () => {
    expect(kvLanguageChoice.read()).toBeNull();
    kvLanguageChoice.write('es');
    kvLanguageChoice.write('ru');
    expect(kvLanguageChoice.read()).toBe('ru');
    expect(localStorage.getItem('ratrace:language-choice')).toBe('ru');
    kvLanguageChoice.clear();
    expect(kvLanguageChoice.read()).toBeNull();
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

describe('a player who deleted their account', () => {
  it('leaves nothing of theirs beside the database: the session, the round planned, the lists for the account, whose it was, a trip to Google', async () => {
    for (const key of ['sb-ref-auth-token', 'sb-ref-auth-token-code-verifier', 'ratrace.basket', 'ratrace:given-up', 'ratrace:refused', 'ratrace.lastAccount', 'ratrace:language-choice', 'ratrace:push']) localStorage.setItem(key, 'x');
    sessionStorage.setItem('ratrace:keeping-account', '1');
    // The browser's own: the language chosen, the offer to install (its visits and a no), and what is not the game's.
    kvLanguage.write('es');
    localStorage.setItem('ratrace.installOffer', '{"visits":3}');
    sessionStorage.setItem('ratrace.installOffer', '1');
    localStorage.setItem('someone.else', 'y');
    await kvForget();
    expect(Object.keys(localStorage).sort()).toEqual(['ratrace.installOffer', 'someone.else']);
    expect(Object.keys(sessionStorage)).toEqual(['ratrace.installOffer']);
    expect(kvLanguage.read()).toBe('es');
  });

  it('leaves no finished life in the database, even one the list could not show', async () => {
    const next = new LocalStore();
    await next.addRun(run('a', 10));
    await next.addRun({ runId: 'unreadable' } as unknown as FinishedRun);
    await kvForget();
    const store = new KvStore();
    expect(await store.listRuns()).toEqual([]);
    // Read as the Next web reads its database: nothing left, not even what neither list would show.
    expect(await (await openDB('ratrace', 1)).count('runs')).toBe(0);
  });

  it('forgets in a browser that keeps nothing all the same, with nothing thrown', async () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('refused');
    });
    await expect(kvForget()).resolves.toBeUndefined();
    vi.restoreAllMocks();
  });
});

describe('another tab, or the installed game, of a player who deleted their account', () => {
  /** What another tab says, on the channel between tabs, as `tell` says it there. */
  const fromAnotherTab = () => {
    const channel = new BroadcastChannel('ratrace:forgotten');
    channel.postMessage({ from: 'another-tab' });
    channel.close();
  };

  it('hears of it from the tab that deleted it, and only once however it is told', async () => {
    const heard = vi.fn();
    const stop = kvForgotten.listen(heard);
    fromAnotherTab();
    await vi.waitFor(() => expect(heard).toHaveBeenCalledTimes(1));
    // The storage of the browser tells the other tabs too: the same news, heard once.
    window.dispatchEvent(new StorageEvent('storage', { key: 'ratrace:forgotten', newValue: 'another-tab 1' }));
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
  });

  it('is not heard by the tab that tells it: it starts again by itself', async () => {
    const heard = vi.fn();
    const stop = kvForgotten.listen(heard);
    // Heard on the channel by every other listener of this page's origin, this tab's own among them, were it not told apart.
    const other = vi.fn();
    const channel = new BroadcastChannel('ratrace:forgotten');
    channel.onmessage = other;
    kvForgotten.tell();
    await vi.waitFor(() => expect(other).toHaveBeenCalled());
    await new Promise((settled) => setTimeout(settled, 20));
    expect(heard).not.toHaveBeenCalled();
    expect(localStorage.getItem('ratrace:forgotten')).not.toBeNull();
    channel.close();
    stop();
  });

  it('hears of it through the storage of the browser where there is no channel between tabs', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const heard = vi.fn();
    const stop = kvForgotten.listen(heard);
    window.dispatchEvent(new StorageEvent('storage', { key: 'something.else', newValue: '1' }));
    expect(heard).not.toHaveBeenCalled();
    window.dispatchEvent(new StorageEvent('storage', { key: 'ratrace:forgotten', newValue: 'another-tab 1' }));
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
    // And the tab that tells writes the news there for them, with nothing thrown.
    expect(() => kvForgotten.tell()).not.toThrow();
    expect(localStorage.getItem('ratrace:forgotten')).not.toBeNull();
  });

  it('hears nothing once it has stopped listening', async () => {
    const heard = vi.fn();
    kvForgotten.listen(heard)();
    fromAnotherTab();
    window.dispatchEvent(new StorageEvent('storage', { key: 'ratrace:forgotten', newValue: 'another-tab 2' }));
    await new Promise((settled) => setTimeout(settled, 20));
    expect(heard).not.toHaveBeenCalled();
  });
});
