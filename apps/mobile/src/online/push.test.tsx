// @vitest-environment jsdom
import type { Account, AccountState, Community } from '@ratrace/online/types';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { noticeOf } from '../../../../supabase/functions/_shared/notice.ts';
import type { NoticeAbout } from '../../../../supabase/functions/_shared/notice.ts';
import { Preferences } from '../game/screens/Settings';
import { notices, tapOn } from '../testing/fakes';
import { memoryServices, renderGame, router } from '../testing/render';
import { pageOf, phonePush } from './push';
import type { PushNote } from './push';

/*
 * The phone's notices (online/push.ts): a tap opens the screen the notice names, at a cold start as while the app runs, and nothing but the app's own
 * screens; the token follows the phone (a new one from Expo), the account signed in and the language of the game.
 */

const PROJECT = 'b1c2d3e4-0000-4000-8000-000000000001';
const FIRST = 'ExponentPushToken[phone-1]';
const SECOND = 'ExponentPushToken[phone-2]';

beforeEach(() => {
  vi.stubEnv('EXPO_PUBLIC_EAS_PROJECT_ID', PROJECT);
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function memoryNote(start: ReturnType<PushNote['read']> = null): PushNote & { now: ReturnType<PushNote['read']> } {
  const note = { now: start, read: () => note.now, write: (state: 'on' | 'off' | 'refused') => void (note.now = state) };
  return note;
}

/** An account a test moves by hand: who is signed in, and everyone listening told of a change. */
function accountAt(start: AccountState) {
  let state = start;
  const listeners = new Set<() => void>();
  const account = {
    state: () => state,
    subscribe: (listener: () => void) => (listeners.add(listener), () => void listeners.delete(listener)),
    settled: () => true,
    start: async () => undefined,
    dismissNotice: () => undefined,
    keepWithGoogle: async () => false,
    useExistingAccount: async () => false,
    signOut: async () => true,
  } as unknown as Account;
  return {
    account,
    become(next: AccountState) {
      state = next;
      for (const listener of [...listeners]) listener();
    },
  };
}

function community(over: Partial<Community> = {}) {
  const asked: string[] = [];
  const all = {
    me: async () => null,
    notifyMe: async (keys: { expo: string; platform: string }, locale: string) => (asked.push(`notify ${keys.expo} ${keys.platform} ${locale}`), true),
    stopNotifying: async (target: { expo: string }) => (asked.push(`stop ${target.expo}`), true),
    marketNotice: async (target: { expo: string }) => (asked.push(`read ${target.expo}`), target.expo === FIRST),
    setMarketNotice: async (target: { expo: string }, on: boolean) => (asked.push(`set ${target.expo} ${on}`), true),
    ...over,
  } as unknown as Community;
  return { all, asked };
}

describe('the link a tap opens', () => {
  it.each([
    ['theratrace://room?code=K7Q2XM', '/room?code=K7Q2XM'],
    ['theratrace://room', '/room'],
    ['theratrace://challenge', '/challenge'],
    ['theratrace://play', '/play'],
    ['theratrace://rankings?tab=friends', '/rankings?tab=friends'],
    ['theratrace://rankings?tab=challenge', '/rankings?tab=challenge'],
    // What the screen does not read is left behind.
    ['theratrace://room?code=K7Q2XM&next=https://evil.example', '/room?code=K7Q2XM'],
    ['theratrace://room/?code=K7Q2XM', '/room?code=K7Q2XM'],
  ])('opens %s as %s', (url, path) => {
    expect(pageOf(url)).toBe(path);
  });

  it.each([
    'https://evil.example/room?code=K7Q2XM',
    'theratrace-evil://room',
    'javascript:alert(1)',
    'exp://room',
    '//room',
    '/room',
    'theratrace://',
    'theratrace://evil',
    'theratrace://auth?code=abc',
    'theratrace://scene?name=home',
    'theratrace://dev',
    'theratrace://kit',
    'theratrace://perf',
    'theratrace://room/../dev',
    'theratrace://room?code=K7Q2XM%26x',
    'theratrace://room?code=<script>',
    'theratrace://rankings?tab=nobody',
    ` theratrace://room`,
    `theratrace://room?code=${'A'.repeat(600)}`,
  ])('opens nothing for %s', (url) => {
    // A bad code or tab is a link the server never sends: nothing is opened for it, rather than the screen without it.
    expect(pageOf(url)).toBeNull();
  });

  it.each([undefined, null, 42, {}, ['theratrace://room']])('opens nothing for a link that is not one (%s)', (url) => {
    expect(pageOf(url)).toBeNull();
  });

  it('opens every screen the game\'s server names in a phone\'s notice', () => {
    const abouts: NoticeAbout[] = [
      { kind: 'weekly', place: 1, entrants: 2 },
      { kind: 'roomStarted', seconds: 60 },
      { kind: 'yourTurn', round: 1, rounds: 10, secondsLeft: 30 },
      { kind: 'newRound', round: 2, rounds: 10, seconds: 60 },
      { kind: 'rematch' },
      { kind: 'idle' },
      { kind: 'marketMoved', asset: 'gold', percent: 6 },
      { kind: 'loanOffer', who: null, lend: true, amount: 1000, rateBp: 500, rounds: 2 },
      { kind: 'shout', who: null, n: 0 },
      { kind: 'friendRequest', who: null },
      { kind: 'friendAccepted', who: null },
    ];
    for (const about of abouts) {
      const { url } = noticeOf('en', about, 'app');
      expect(pageOf(url), `${about.kind}: ${url}`).not.toBeNull();
    }
    expect(pageOf(noticeOf('es', { kind: 'friendRequest', who: null }, 'app').url)).toBe('/rankings?tab=friends');
  });
});

describe('a tap on a notice', () => {
  it('opens the screen it names when it opened the app (a cold start), once', async () => {
    notices.last = tapOn('theratrace://room?code=K7Q2XM');
    const push = phonePush(memoryNote(), { platform: 'ios' });
    renderGame(<Preferences />, { ...memoryServices(), push });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/room?code=K7Q2XM'));
    // Heard again (the listener that comes after the start hears the same tap on Android), it is not opened twice.
    act(() => notices.tap(tapOn('theratrace://room?code=K7Q2XM')));
    await settle();
    expect(router.push).toHaveBeenCalledTimes(1);
    // Nor by the next game drawn over the same push (a sign-out starts the game again).
    cleanup();
    renderGame(<Preferences />, { ...memoryServices(), push });
    await settle();
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it('opens the screen it names while the app is running', async () => {
    const push = phonePush(memoryNote(), { platform: 'android' });
    renderGame(<Preferences />, { ...memoryServices(), push });
    await settle();
    act(() => notices.tap(tapOn('theratrace://rankings?tab=friends', 'notice-2')));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/rankings?tab=friends'));
    act(() => notices.tap(tapOn('theratrace://challenge', 'notice-3')));
    await waitFor(() => expect(router.push).toHaveBeenLastCalledWith('/challenge'));
  });

  it('ignores a link that is not one of the app\'s screens, at a cold start as while it runs', async () => {
    notices.last = tapOn('https://evil.example/room?code=K7Q2XM');
    const push = phonePush(memoryNote(), { platform: 'ios' });
    renderGame(<Preferences />, { ...memoryServices(), push });
    await settle();
    act(() => notices.tap(tapOn('theratrace://auth?code=stolen', 'notice-2')));
    act(() => notices.tap(tapOn(42, 'notice-3')));
    act(() => notices.tap({ notification: { request: { identifier: 'notice-4', content: { data: {} } } }, actionIdentifier: 'x' }));
    act(() => notices.tap(null as never));
    await settle();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('listens to nothing where the phone cannot be told', async () => {
    vi.stubEnv('EXPO_PUBLIC_EAS_PROJECT_ID', '');
    notices.last = tapOn('theratrace://room');
    renderGame(<Preferences />, { ...memoryServices(), push: phonePush(memoryNote(), { platform: 'ios' }) });
    await settle();
    expect(notices.taps.size).toBe(0);
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('the token, kept up to date with the account', () => {
  it('is kept again at each start, with the language of the game, while the notices are on', async () => {
    notices.status = 'granted';
    const { account } = accountAt({ kind: 'guest', userId: 'guest-1', notice: null });
    const { all, asked } = community();
    renderGame(<Preferences />, { ...memoryServices(), account, community: () => all, push: phonePush(memoryNote('on'), { platform: 'android' }) }, 'es');
    await waitFor(() => expect(asked).toContain(`notify ${FIRST} android es`));
    // The channel the notices are shown in, named in the game's language (Android).
    expect(notices.channels).toEqual([{ id: 'default', name: 'Avisos del juego', importance: 5 }]);
  });

  it('is not kept while the notices are off', async () => {
    notices.status = 'granted';
    const { account } = accountAt({ kind: 'guest', userId: 'guest-1', notice: null });
    const { all, asked } = community();
    renderGame(<Preferences />, { ...memoryServices(), account, community: () => all, push: phonePush(memoryNote('off'), { platform: 'ios' }) });
    await settle();
    await settle();
    expect(asked.filter((line) => line.startsWith('notify'))).toEqual([]);
  });

  it('follows a change of the game\'s language, so the next notice speaks it', async () => {
    notices.status = 'granted';
    const { account } = accountAt({ kind: 'guest', userId: 'guest-1', notice: null });
    const { all, asked } = community();
    renderGame(<Preferences />, { ...memoryServices(), account, community: () => all, push: phonePush(memoryNote('on'), { platform: 'ios' }) }, 'en');
    await waitFor(() => expect(asked).toContain(`notify ${FIRST} ios en`));
    fireEvent.click(screen.getByRole('radio', { name: 'Русский' }));
    await waitFor(() => expect(asked).toContain(`notify ${FIRST} ios ru`));
  });

  it('follows whoever signs in on the phone', async () => {
    notices.status = 'granted';
    const moved = accountAt({ kind: 'offline' });
    const { all, asked } = community();
    renderGame(<Preferences />, { ...memoryServices(), account: moved.account, community: () => all, push: phonePush(memoryNote('on'), { platform: 'ios' }) });
    await settle();
    expect(asked).toEqual([]);
    act(() => moved.become({ kind: 'guest', userId: 'guest-1', notice: null }));
    await waitFor(() => expect(asked.filter((line) => line.startsWith('notify'))).toHaveLength(1));
    act(() => moved.become({ kind: 'member', userId: 'member-1', email: null }));
    await waitFor(() => expect(asked.filter((line) => line.startsWith('notify'))).toHaveLength(2));
    // The same player again (a guest kept as a member is the same id): nothing new to tell.
    act(() => moved.become({ kind: 'member', userId: 'member-1', email: 'a@b.c' }));
    await settle();
    expect(asked.filter((line) => line.startsWith('notify'))).toHaveLength(2);
  });

  it('is kept anew when Expo gives the phone a new one: the market\'s choice goes with it, and the old one is forgotten', async () => {
    notices.status = 'granted';
    const { account } = accountAt({ kind: 'guest', userId: 'guest-1', notice: null });
    const { all, asked } = community();
    renderGame(<Preferences />, { ...memoryServices(), account, community: () => all, push: phonePush(memoryNote('on'), { platform: 'ios' }) });
    await waitFor(() => expect(asked).toContain(`notify ${FIRST} ios en`));
    asked.length = 0;
    notices.token = SECOND;
    act(() => notices.newToken({ type: 'ios', data: 'apns-2' }));
    await waitFor(() => expect(asked).toContain(`stop ${FIRST}`));
    expect(asked).toEqual([`notify ${SECOND} ios en`, `read ${FIRST}`, `set ${SECOND} true`, `stop ${FIRST}`]);
    expect(notices.tokenAsks.at(-1)).toEqual({ projectId: PROJECT, devicePushToken: { type: 'ios', data: 'apns-2' } });
    // The same token again is nothing new.
    asked.length = 0;
    act(() => notices.newToken({ type: 'ios', data: 'apns-2' }));
    await settle();
    await settle();
    expect(asked).toEqual([]);
  });

  it('is left alone on a new token while the notices are off', async () => {
    notices.status = 'granted';
    const { account } = accountAt({ kind: 'guest', userId: 'guest-1', notice: null });
    const { all, asked } = community();
    renderGame(<Preferences />, { ...memoryServices(), account, community: () => all, push: phonePush(memoryNote('off'), { platform: 'ios' }) });
    await settle();
    notices.token = SECOND;
    act(() => notices.newToken({ type: 'ios', data: 'apns-2' }));
    await settle();
    await settle();
    expect(asked).toEqual([]);
  });
});

describe('never a crash', () => {
  it('answers `unavailable` where the phone\'s notices throw, and asks nothing', async () => {
    const { expoNotifications } = await import('../testing/fakes');
    const spy = vi.spyOn(expoNotifications, 'getPermissionsAsync').mockRejectedValue(new Error('no module'));
    try {
      expect(await phonePush(memoryNote(), { platform: 'ios' }).pushOn()).toBe('unavailable');
      expect(notices.asked).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });

  it('turns off quietly where the account cannot be reached', async () => {
    notices.status = 'granted';
    const note = memoryNote('on');
    const push = phonePush(note, { platform: 'ios' });
    const { all } = community({ stopNotifying: async () => Promise.reject(new Error('offline')) });
    await expect(push.pushOff(all)).resolves.toBeUndefined();
    expect(note.now).toBe('off');
  });
});
