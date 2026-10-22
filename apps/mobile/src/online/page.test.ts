import { follow } from '@ratrace/online/follow';
import type { AccountState } from '@ratrace/online/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appState, network } from '../testing/fakes';
import { phoneConnection, phonePage, whileActive } from './page';

/*
 * What the phone tells the account of itself, as a browser tells it of a page (apps/web/src/online/index.ts, `browserPage`): the connection come
 * back (expo-network), and the app come back to the front (AppState). Driven here through the stand-ins of `testing/fakes.ts`.
 */

const stops: Array<() => void> = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
});
const kept = (stop: () => void) => void stops.push(stop);
/** Lets the page read what the phone's connection is when it begins to listen. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the connection', () => {
  it('says it is back when it comes back, and only then', async () => {
    const back = vi.fn();
    network.connected = false;
    kept(phonePage.onOnline(back));
    await settled();
    network.set(false);
    expect(back).not.toHaveBeenCalled();
    network.set(true);
    expect(back).toHaveBeenCalledTimes(1);
    // Still there is not back again.
    network.set(true);
    expect(back).toHaveBeenCalledTimes(1);
    network.set(false);
    network.set(true);
    expect(back).toHaveBeenCalledTimes(2);
  });

  it('says nothing when the phone only says it is connected as the page begins to listen, as a browser says nothing', async () => {
    const back = vi.fn();
    kept(phonePage.onOnline(back));
    network.set(true);
    await settled();
    network.set(true);
    expect(back).not.toHaveBeenCalled();
  });

  it('hears it back even before it has read how the phone was: a change from away is a change', () => {
    const back = vi.fn();
    kept(phonePage.onOnline(back));
    network.set(false);
    network.set(true);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('takes a connection with no internet behind it for none', async () => {
    const back = vi.fn();
    network.connected = false;
    kept(phonePage.onOnline(back));
    await settled();
    for (const listener of network.listeners) listener({ isConnected: true, isInternetReachable: false });
    expect(back).not.toHaveBeenCalled();
    network.set(true);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('stops listening when asked', async () => {
    const back = vi.fn();
    network.connected = false;
    const stop = phonePage.onOnline(back);
    await settled();
    stop();
    network.set(true);
    expect(back).not.toHaveBeenCalled();
    expect(network.listeners.size).toBe(0);
  });
});

describe('the app in front', () => {
  it('says it is shown when it comes back to the front, not while it stays there or goes away', () => {
    const shown = vi.fn();
    kept(phonePage.onShown(shown));
    appState.set('inactive');
    appState.set('background');
    expect(shown).not.toHaveBeenCalled();
    appState.set('active');
    expect(shown).toHaveBeenCalledTimes(1);
    appState.set('active');
    expect(shown).toHaveBeenCalledTimes(1);
  });

  it('tells the time as the phone does', () => {
    const now = Date.now();
    expect(Math.abs(phonePage.now() - now)).toBeLessThan(1000);
  });
});

describe('the account following the phone', () => {
  /** An account signed in as a guest, and a mirror that counts its reads; the clock is the test's. */
  function followed() {
    const state: AccountState = { kind: 'guest', userId: 'user-1', notice: null };
    const account = { state: () => state, subscribe: () => () => undefined, again: vi.fn(async () => undefined) };
    const mirror = { sync: vi.fn(async () => undefined), accountChanged: vi.fn(async () => undefined) };
    let clock = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => clock);
    kept(follow(account, mirror, phonePage));
    return { mirror, pass: (ms: number) => void (clock += ms) };
  }
  afterEach(() => vi.restoreAllMocks());

  it('reads the account again when the app comes back to the front after a minute away, and not sooner', () => {
    const { mirror, pass } = followed();
    expect(mirror.accountChanged).toHaveBeenCalledTimes(1);
    appState.set('background');
    pass(30_000);
    appState.set('active');
    expect(mirror.sync).not.toHaveBeenCalled();
    appState.set('background');
    pass(61_000);
    appState.set('active');
    expect(mirror.sync).toHaveBeenCalledTimes(1);
  });

  it('reads the account again when the connection comes back', async () => {
    network.connected = false;
    const { mirror } = followed();
    await settled();
    network.set(true);
    expect(mirror.sync).toHaveBeenCalledTimes(1);
  });
});

describe('the session renewed while the app is in front', () => {
  it('is renewed from the start if the app is in front, stopped when it goes away, and renewed again when it comes back', () => {
    const told: boolean[] = [];
    kept(whileActive((on) => told.push(on)));
    expect(told).toEqual([true]);
    appState.set('inactive');
    appState.set('background');
    appState.set('active');
    expect(told).toEqual([true, false, true]);
  });

  it('is not renewed from the start by an app opened behind (a push, say), until it comes to the front', () => {
    appState.currentState = 'background';
    const told: boolean[] = [];
    const stop = whileActive((on) => told.push(on));
    expect(told).toEqual([false]);
    appState.set('active');
    expect(told).toEqual([false, true]);
    stop();
    appState.set('background');
    expect(told).toEqual([false, true]);
  });
});

describe('whether there is a connection now', () => {
  it('is read as the phone says it, and every change of it is told, as a browser tells `online` and `offline`', async () => {
    network.connected = false;
    const told = vi.fn();
    // Not yet known is not "no".
    const stop = phoneConnection.subscribe(told);
    await settled();
    expect(phoneConnection.connected()).toBe(false);
    expect(told).toHaveBeenCalledTimes(1);
    network.set(true);
    expect(phoneConnection.connected()).toBe(true);
    network.set(true);
    expect(told).toHaveBeenCalledTimes(2);
    network.set(false);
    expect(phoneConnection.connected()).toBe(false);
    expect(told).toHaveBeenCalledTimes(3);
    // The phone is listened to only while someone listens here.
    stop();
    expect(network.listeners.size).toBe(0);
    network.set(true);
    expect(told).toHaveBeenCalledTimes(3);
    // Listened to again, it is asked again.
    kept(phoneConnection.subscribe(() => undefined));
    await settled();
    expect(phoneConnection.connected()).toBe(true);
  });
});
