// @vitest-environment jsdom
import { CONTENT_VERSION } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import type { ErrorReport, Sent } from '@ratrace/online/errors';
import type { AccountState } from '@ratrace/online/types';
import { act, renderHook } from '@testing-library/react';
import { Platform } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { pathname } from '../testing/fakes';
import { appBrowser, appBuild, place, usePlace, watchErrors } from './errors';
import type { Rejections, Uncaught } from './errors';

/*
 * The phone's errors, as the web's page's (apps/web/src/online/index.ts, `watchErrors`): what nobody caught, what no promise handled, and what is
 * written as an error, sent cleaned as whoever is signed in. React Native has no page to hear them on: its uncaught errors reach the global handler
 * of `ErrorUtils`, and Hermes tells of a promise nobody handled through its rejection tracker. Both stand in here.
 */

type Handler = (error: unknown, isFatal?: boolean) => void;

/** React Native's `ErrorUtils`, with a handler of its own already in place (the one that shows or ends the app). */
function errorUtils() {
  const before = vi.fn<Handler>();
  let handler: Handler = before;
  const uncaught: Uncaught = { getGlobalHandler: () => handler, setGlobalHandler: (next) => void (handler = next) };
  return { uncaught, before, throwNow: (error: unknown, isFatal?: boolean) => handler(error, isFatal), handler: () => handler };
}

/** Hermes' tracker of promises nobody handled. */
function hermes() {
  let options: Parameters<NonNullable<Rejections['enablePromiseRejectionTracker']>>[0] | null = null;
  const rejections: Rejections = { enablePromiseRejectionTracker: (given) => void (options = given) };
  return { rejections, reject: (reason: unknown) => options?.onUnhandled(1, reason), options: () => options };
}

/** The account and its cloud as the watch sees them: signed in as a guest, or nobody; every batch it was handed kept. */
function online(signedIn = true) {
  const sent: ErrorReport[][] = [];
  const listeners = new Set<() => void>();
  let state: AccountState = signedIn ? { kind: 'guest', userId: 'user-1', notice: null } : { kind: 'offline' };
  const reportErrors = vi.fn(async (reports: ErrorReport[]): Promise<Sent> => {
    if (state.kind === 'offline') return 'later';
    sent.push(reports);
    return 'sent';
  });
  const account = {
    subscribe: (listener: () => void) => (listeners.add(listener), () => void listeners.delete(listener)),
    signIn: () => {
      state = { kind: 'guest', userId: 'user-1', notice: null };
      for (const listener of listeners) listener();
    },
  };
  return { online: { account: account as never, reportErrors }, sent, signIn: account.signIn };
}

/** The watch's clock: what it asked to run later, run when the test says. */
function clock() {
  const waiting: Array<() => void> = [];
  return { schedule: (run: () => void) => void waiting.push(run), run: async () => {
    for (const run of waiting.splice(0)) run();
    await new Promise((resolve) => setTimeout(resolve, 0));
  } };
}

function watched(signedIn = true) {
  const phone = errorUtils();
  const tracker = hermes();
  const logged = vi.fn();
  const log = { error: logged };
  const time = clock();
  const cloud = online(signedIn);
  const stop = watchErrors(cloud.online, { uncaught: phone.uncaught, rejections: tracker.rejections, log, schedule: time.schedule, place: () => '/play' });
  return { ...phone, ...tracker, ...cloud, log, logged, time, stop };
}

describe('the phone\'s errors', () => {
  it('sends an error nobody caught, cleaned of who the player is, from the screen it happened on', async () => {
    const { throwNow, before, time, sent } = watched();
    const error = new Error('no game 0b1e3f6a-1c2d-4e5f-8a9b-0c1d2e3f4a5b for ana@example.com at https://theratrace.app/play?token=secret');
    throwNow(error, false);
    // The app's own handler still hears it, as it did.
    expect(before).toHaveBeenCalledWith(error, false);
    await time.run();
    expect(sent).toHaveLength(1);
    const [report] = sent[0];
    expect(report.message).toBe('no game <id> for <email> at https://theratrace.app/play');
    expect(report.message).not.toContain('ana@example.com');
    expect(report.place).toBe('app:/play');
    expect(report.build).toBe(appBuild('1.0.0'));
    expect(report.browser).toBe(appBrowser(Platform.OS, Platform.Version));
    expect(report.stack).toContain('Error');
  });

  it('sends a promise nobody handled, as the web says it', async () => {
    const { reject, options, time, sent } = watched();
    expect(options()).toMatchObject({ allRejections: true });
    reject(new TypeError('cannot read the round'));
    await time.run();
    expect(sent[0][0].message).toBe('unhandled: TypeError: cannot read the round');
  });

  it('sends what is written as an error, and still writes it', async () => {
    const { log, logged, time, sent } = watched();
    log.error('the save failed', new Error('disk full'));
    expect(logged).toHaveBeenCalledWith('the save failed', expect.any(Error));
    await time.run();
    expect(sent[0][0].message).toBe('the save failed disk full');
  });

  it('keeps what nobody could be told until someone is signed in, then sends it', async () => {
    const { throwNow, time, sent, signIn } = watched(false);
    throwNow(new Error('boom'), false);
    await time.run();
    expect(sent).toEqual([]);
    signIn();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sent).toHaveLength(1);
  });

  it('sends an error that ends the app at once, not after the others that might come with it', async () => {
    const { throwNow, before, sent } = watched();
    throwNow(new Error('fatal'), true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sent).toHaveLength(1);
    expect(before).toHaveBeenCalledWith(expect.any(Error), true);
  });

  it('never lets a fault of its own keep the app\'s handler from the error', () => {
    const phone = errorUtils();
    const broken = { account: { subscribe: () => () => undefined } as never, reportErrors: () => { throw new Error('the watch is broken'); } };
    watchErrors(broken, { uncaught: phone.uncaught, rejections: undefined, log: { error: vi.fn() }, schedule: (run) => run(), place: () => { throw new Error('no place'); } });
    expect(() => phone.throwNow(new Error('boom'), true)).not.toThrow();
    expect(phone.before).toHaveBeenCalledTimes(1);
  });

  it('puts everything back as it was when it stops, and hears nothing more', async () => {
    const { handler, before, reject, log, logged, stop, time, sent, uncaught } = watched();
    stop();
    expect(handler()).toBe(before);
    expect(log.error).toBe(logged);
    reject(new Error('late'));
    uncaught.getGlobalHandler()(new Error('later'), false);
    await time.run();
    expect(sent).toEqual([]);
  });

  it('watches a phone whose JavaScript has no rejection tracker all the same', async () => {
    const phone = errorUtils();
    const cloud = online();
    const time = clock();
    watchErrors(cloud.online, { uncaught: phone.uncaught, rejections: undefined, log: { error: vi.fn() }, schedule: time.schedule, place: () => '/' });
    phone.throwNow(new Error('boom'), false);
    await time.run();
    expect(cloud.sent).toHaveLength(1);
  });
});

describe('what an error report says of the phone', () => {
  it('names the game\'s versions and the app\'s, and the system by its name and major version, nothing finer', () => {
    expect(appBuild('1.2.3')).toBe(`${ENGINE_VERSION}/${CONTENT_VERSION} app 1.2.3`);
    expect(appBuild(undefined)).toBe(`${ENGINE_VERSION}/${CONTENT_VERSION} app`);
    expect(appBrowser('ios', '18.2.1')).toBe('app iOS 18');
    expect(appBrowser('android', 35)).toBe('app Android 35');
    expect(appBrowser('web', undefined)).toBe('app web');
  });

  it('knows the screen it is on by the router\'s path (`usePlace`, in the layout)', () => {
    pathname.now = '/records';
    const { rerender, unmount } = renderHook(() => usePlace());
    expect(place()).toBe('/records');
    act(() => {
      pathname.now = '/play';
      rerender();
    });
    expect(place()).toBe('/play');
    unmount();
  });
});
