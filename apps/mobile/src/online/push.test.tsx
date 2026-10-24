// @vitest-environment jsdom
import type { Account, AccountState, Community } from '@ratrace/online/types';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { noticeOf } from '../../../../supabase/functions/_shared/notice.ts';
import type { NoticeAbout } from '../../../../supabase/functions/_shared/notice.ts';
import { Preferences } from '../game/screens/Settings';
import { notices, pathname, tapOn } from '../testing/fakes';
import { closeEverySheet, sheetOpened, sheetsShut } from '../ui/back';
import { Play } from '../game/screens/Play';
import { Sheet } from '../ui/overlay';
import { memoryServices, params, renderGame, router } from '../testing/render';
import { pageOf, phonePush } from './push';
import type { PushNote, PushNoted } from './push';

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

/** A note kept in memory, as the phone's store keeps it (`kvPush`): notices on are on with the phone's first token, as the account was given it. */
function memoryNote(state: 'on' | 'off' | 'refused' | null = null, token: string | null = state === 'on' ? 'ExponentPushToken[phone-1]' : null): PushNote & { now: PushNoted | null } {
  const note = { now: state === null ? null : { state, token }, read: () => note.now, write: (noted: PushNoted) => void (note.now = noted) };
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
    ['theratrace://room?code=K7Q2XM', { page: 'room', query: { code: 'K7Q2XM' } }],
    ['theratrace://room', { page: 'room', query: {} }],
    ['theratrace://challenge', { page: 'challenge', query: {} }],
    ['theratrace://play', { page: 'play', query: {} }],
    ['theratrace://rankings?tab=friends', { page: 'rankings', query: { tab: 'friends' } }],
    ['theratrace://rankings?tab=challenge', { page: 'rankings', query: { tab: 'challenge' } }],
    // What the screen does not read is left behind.
    ['theratrace://room?code=K7Q2XM&next=https://evil.example', { page: 'room', query: { code: 'K7Q2XM' } }],
    ['theratrace://room/?code=K7Q2XM', { page: 'room', query: { code: 'K7Q2XM' } }],
    // Each name once: the first as written.
    ['theratrace://room?code=K7Q2XM&code=AAAAAA', { page: 'room', query: { code: 'K7Q2XM' } }],
    ['theratrace://rankings?tab=friends&tab=week', { page: 'rankings', query: { tab: 'friends' } }],
    // A name the screen does not read is no way in, however it is spelled.
    ['theratrace://room?constructor=x', { page: 'room', query: {} }],
    ['theratrace://room?__proto__=x&hasOwnProperty=y', { page: 'room', query: {} }],
  ])('opens %s as %s', (url, path) => {
    expect(pageOf(url)).toEqual(path);
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
    // Pages that every object has: the list of pages is read for its own only.
    'theratrace://constructor',
    'theratrace://tostring',
    'theratrace://hasownproperty',
    // A room's code is six letters and digits.
    'theratrace://room?code=K7Q2',
    'theratrace://room?code=K7Q2XMAB',
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
    expect(pageOf(noticeOf('es', { kind: 'friendRequest', who: null }, 'app').url)).toEqual({ page: 'rankings', query: { tab: 'friends' } });
  });
});

describe('a tap on a notice', () => {
  it('opens the screen it names when it opened the app (a cold start), once', async () => {
    notices.last = tapOn('theratrace://room?code=K7Q2XM');
    const push = phonePush(memoryNote(), { platform: 'ios' });
    renderGame(<Preferences />, { ...memoryServices(), push });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/en/room?code=K7Q2XM'));
    // Had, it is cleared: a reload of the app does not open it again.
    expect(notices.cleared).toBe(1);
    expect(notices.last).toBeNull();
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
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/en/rankings?tab=friends'));
    act(() => notices.tap(tapOn('theratrace://challenge', 'notice-3')));
    await waitFor(() => expect(router.push).toHaveBeenLastCalledWith('/en/challenge'));
  });

  it('opens it in the language of the address the player is on: the screens in the stack are that language\'s pages', async () => {
    params.locale = 'es';
    pathname.now = '/es/records';
    const push = phonePush(memoryNote(), { platform: 'ios' });
    renderGame(<Preferences />, { ...memoryServices(), push }, 'ru');
    await waitFor(() => expect(notices.taps.size).toBe(1));
    act(() => notices.tap(tapOn('theratrace://rankings?tab=friends', 'notice-2')));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/es/rankings?tab=friends'));
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
    await screen.findByRole('switch', { name: /^Sound/ });
    await settle();
    expect(notices.taps.size).toBe(0);
    expect(notices.tokens.size).toBe(0);
    expect(notices.cleared).toBe(0);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('stops listening when the game is taken away', async () => {
    notices.status = 'granted';
    const { account } = accountAt({ kind: 'guest', userId: 'guest-1', notice: null });
    const { all } = community();
    renderGame(<Preferences />, { ...memoryServices(), account, community: () => all, push: phonePush(memoryNote('on'), { platform: 'ios' }) });
    await waitFor(() => expect(notices.taps.size).toBe(1));
    await waitFor(() => expect(notices.tokens.size).toBe(1));
    cleanup();
    expect(notices.taps.size).toBe(0);
    expect(notices.tokens.size).toBe(0);
  });

  it('closes the sheets that are open as the player would, and opens the screen once they are gone', async () => {
    const push = phonePush(memoryNote(), { platform: 'ios' });
    function Open() {
      const [open, setOpen] = useState(true);
      return (
        <Sheet open={open} onClose={() => setOpen(false)} title="Something open" closeLabel="Close">
          <></>
        </Sheet>
      );
    }
    renderGame(
      <>
        <Preferences />
        <Open />
      </>,
      { ...memoryServices(), push },
    );
    await screen.findByRole('heading', { name: 'Something open' });
    await waitFor(() => expect(notices.taps.size).toBe(1));
    let sheetWhenOpened: boolean | null = null;
    router.push.mockImplementation(() => void (sheetWhenOpened = screen.queryByRole('heading', { name: 'Something open' }) !== null));
    act(() => notices.tap(tapOn('theratrace://room', 'notice-2')));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/en/room'));
    expect(sheetWhenOpened).toBe(false);
    // Closed for good: nothing comes back after.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.queryByRole('heading', { name: 'Something open' })).toBeNull();
    expect(sheetsShut()).toBe(false);
  });

  it('closes the profile and its balance line for the screen it opens, and the profile is there again with nothing open over it', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    renderGame(<Play />, { ...services, push: phonePush(memoryNote(), { platform: 'ios' }) });
    await screen.findByRole('heading', { name: 'News' });
    fireEvent.click(screen.getByRole('button', { name: 'Open your profile' }));
    fireEvent.click(within(screen.getByLabelText('Balance sheet')).getByRole('button', { name: /^Cash/ }));
    await screen.findByRole('heading', { name: 'Cash' });
    await waitFor(() => expect(notices.taps.size).toBe(1));
    act(() => notices.tap(tapOn('theratrace://challenge', 'notice-2')));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/en/challenge'));
    expect(screen.queryByRole('heading', { name: 'Cash' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Your life' })).toBeNull();
    // Back on the life: nothing was left open to come back over it, and the profile opens as ever, its balance line closed.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(document.querySelector('[aria-modal="true"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open your profile' }));
    expect(await screen.findByRole('heading', { name: 'Your life' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Cash' })).toBeNull();
  });

  it('opens nothing where a sheet will not close in a while: never a Modal left over the new screen', async () => {
    const push = phonePush(memoryNote(), { platform: 'ios' });
    renderGame(
      <>
        <Preferences />
        <Sheet open onClose={() => undefined} title="Being answered" closeLabel="Close">
          <></>
        </Sheet>
      </>,
      { ...memoryServices(), push },
    );
    await screen.findByRole('heading', { name: 'Being answered' });
    await waitFor(() => expect(notices.taps.size).toBe(1));
    act(() => notices.tap(tapOn('theratrace://room', 'notice-2')));
    await new Promise((resolve) => setTimeout(resolve, 2_300));
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Being answered' })).toBeTruthy();
  });

  it('closes the question of signing out for good when it lands while the game starts again: it cannot come back', async () => {
    const signedIn = accountAt({ kind: 'member', userId: 'member-1', email: null });
    const push = phonePush(memoryNote(), { platform: 'ios' });
    renderGame(<Preferences />, { ...memoryServices(), account: signedIn.account, push });
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    await screen.findByRole('heading', { name: 'Sign out?' });
    await waitFor(() => expect(notices.taps.size).toBe(1));
    // The game starting again holds every sheet shut, as it does once the player has said yes.
    const forStart = closeEverySheet();
    act(() => notices.tap(tapOn('theratrace://challenge', 'notice-2')));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/en/challenge'));
    act(() => forStart());
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.queryByRole('heading', { name: 'Sign out?' })).toBeNull();
  });

  it('keeps the sheets shut while anyone holds them so', async () => {
    const forStart = closeEverySheet();
    const another = closeEverySheet();
    another();
    expect(sheetsShut()).toBe(true);
    forStart();
    expect(sheetsShut()).toBe(false);
  });

  it('waits for a sheet still leaving (an iOS Modal dismissing) before it opens the screen', async () => {
    const push = phonePush(memoryNote(), { platform: 'ios' });
    renderGame(<Preferences />, { ...memoryServices(), push });
    await waitFor(() => expect(notices.taps.size).toBe(1));
    // A sheet that has closed and whose Modal has not said it has gone yet.
    const gone = sheetOpened();
    act(() => notices.tap(tapOn('theratrace://challenge', 'notice-2')));
    await settle();
    await settle();
    expect(router.push).not.toHaveBeenCalled();
    act(() => gone());
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/en/challenge'));
  });

  it('opens the screen in front anew in its place, never a second copy over it', async () => {
    pathname.now = '/en/room';
    const push = phonePush(memoryNote(), { platform: 'ios' });
    renderGame(<Preferences />, { ...memoryServices(), push });
    await waitFor(() => expect(notices.taps.size).toBe(1));
    act(() => notices.tap(tapOn('theratrace://room?code=K7Q2XM', 'notice-2')));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/en/room?code=K7Q2XM'));
    expect(router.push).not.toHaveBeenCalled();
  });

  it('lives through a router that cannot go there: the next tap opens its screen', async () => {
    const push = phonePush(memoryNote(), { platform: 'ios' });
    renderGame(<Preferences />, { ...memoryServices(), push });
    await waitFor(() => expect(notices.taps.size).toBe(1));
    router.push.mockImplementationOnce(() => {
      throw new Error('no such route');
    });
    act(() => notices.tap(tapOn('theratrace://room', 'notice-2')));
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    act(() => notices.tap(tapOn('theratrace://challenge', 'notice-3')));
    await waitFor(() => expect(router.push).toHaveBeenLastCalledWith('/en/challenge'));
    expect(sheetsShut()).toBe(false);
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

  it('is kept once at each start, however often the account speaks, and once more for a new language only', async () => {
    notices.status = 'granted';
    const signedIn = accountAt({ kind: 'guest', userId: 'guest-1', notice: null });
    const { all, asked } = community();
    renderGame(<Preferences />, { ...memoryServices(), account: signedIn.account, community: () => all, push: phonePush(memoryNote('on'), { platform: 'ios' }) }, 'en');
    // The account speaks again and again as it settles: the same player, in the same language.
    act(() => signedIn.become({ kind: 'guest', userId: 'guest-1', notice: null }));
    act(() => signedIn.become({ kind: 'guest', userId: 'guest-1', notice: null }));
    // And iOS hands the token to its listener as the start asks Expo for it: the start's own, not a new one.
    act(() => notices.newToken({ type: 'ios', data: 'apns-1' }));
    await waitFor(() => expect(asked).toContain(`notify ${FIRST} ios en`));
    await settle();
    await settle();
    expect(asked.filter((line) => line.startsWith('notify'))).toEqual([`notify ${FIRST} ios en`]);
    fireEvent.click(screen.getByRole('radio', { name: 'Español' }));
    await waitFor(() => expect(asked).toContain(`notify ${FIRST} ios es`));
    await settle();
    expect(asked.filter((line) => line.startsWith('notify'))).toEqual([`notify ${FIRST} ios en`, `notify ${FIRST} ios es`]);
    // The listener of the language before is gone: one listens.
    await waitFor(() => expect(notices.tokens.size).toBe(1));
  });

  it('takes a token Expo changed while the app was closed: the market\'s choice goes with it, and the old one is forgotten', async () => {
    notices.status = 'granted';
    notices.token = SECOND;
    const { account } = accountAt({ kind: 'guest', userId: 'guest-1', notice: null });
    const note = memoryNote('on', FIRST);
    const { all, asked } = community();
    // No screen that reads the market's switch: only what the start does.
    renderGame(<></>, { ...memoryServices(), account, community: () => all, push: phonePush(note, { platform: 'ios' }) });
    await waitFor(() => expect(asked).toContain(`stop ${FIRST}`));
    expect(asked).toEqual([`notify ${SECOND} ios en`, `read ${FIRST}`, `set ${SECOND} true`, `stop ${FIRST}`]);
    expect(note.now).toEqual({ state: 'on', token: SECOND });
  });

  it('is taken from the account a player signs out of, before the session goes, and given to the next one', async () => {
    notices.status = 'granted';
    const signedIn = accountAt({ kind: 'member', userId: 'member-1', email: null });
    const { all, asked } = community();
    (signedIn.account as { signOut(): Promise<boolean> }).signOut = async () => {
      asked.push('signed out');
      return true;
    };
    renderGame(<Preferences />, { ...memoryServices(), account: signedIn.account, community: () => all, push: phonePush(memoryNote('on'), { platform: 'ios' }) });
    await waitFor(() => expect(asked).toContain(`notify ${FIRST} ios en`));
    asked.length = 0;
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    const sheet = (await screen.findByRole('heading', { name: 'Sign out?' })).closest('[aria-modal="true"]') as HTMLElement;
    fireEvent.click(within(sheet).getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(asked).toContain('signed out'));
    expect(asked.slice(0, 2)).toEqual([`stop ${FIRST}`, 'signed out']);
    // The next player on the phone is given it, the notices still on.
    act(() => signedIn.become({ kind: 'guest', userId: 'guest-2', notice: null }));
    await waitFor(() => expect(asked).toContain(`notify ${FIRST} ios en`));
  });

  it('signs out all the same where the account cannot forget the phone', async () => {
    notices.status = 'granted';
    const signedIn = accountAt({ kind: 'member', userId: 'member-1', email: null });
    const { all, asked } = community({ stopNotifying: async () => Promise.reject(new Error('offline')) });
    (signedIn.account as { signOut(): Promise<boolean> }).signOut = async () => {
      asked.push('signed out');
      return true;
    };
    renderGame(<Preferences />, { ...memoryServices(), account: signedIn.account, community: () => all, push: phonePush(memoryNote('on'), { platform: 'ios' }) });
    await waitFor(() => expect(asked).toContain(`notify ${FIRST} ios en`));
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    const sheet = (await screen.findByRole('heading', { name: 'Sign out?' })).closest('[aria-modal="true"]') as HTMLElement;
    fireEvent.click(within(sheet).getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(asked).toContain('signed out'));
  });

  it('is given back where the sign-out did not happen after all', async () => {
    notices.status = 'granted';
    const signedIn = accountAt({ kind: 'member', userId: 'member-1', email: null });
    const { all, asked } = community();
    (signedIn.account as { signOut(): Promise<boolean> }).signOut = async () => false;
    renderGame(<Preferences />, { ...memoryServices(), account: signedIn.account, community: () => all, push: phonePush(memoryNote('on'), { platform: 'ios' }) });
    await waitFor(() => expect(asked).toContain(`notify ${FIRST} ios en`));
    asked.length = 0;
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    const sheet = (await screen.findByRole('heading', { name: 'Sign out?' })).closest('[aria-modal="true"]') as HTMLElement;
    fireEvent.click(within(sheet).getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(asked).toEqual([`stop ${FIRST}`, `notify ${FIRST} ios en`]));
  });

  it('lets the player\'s last word win: a quick "off" while the start\'s claim is in flight waits for it, then has the account forget the phone', async () => {
    notices.status = 'granted';
    const { account } = accountAt({ kind: 'guest', userId: 'guest-1', notice: null });
    let land: (kept: boolean) => void = () => undefined;
    const { all, asked } = community({
      notifyMe: (keys: object) => {
        asked.push(`notify ${(keys as { expo: string }).expo}`);
        return new Promise<boolean>((resolve) => {
          land = (kept) => {
            asked.push('claimed');
            resolve(kept);
          };
        });
      },
    });
    const note = memoryNote('on');
    renderGame(<Preferences />, { ...memoryServices(), account, community: () => all, push: phonePush(note, { platform: 'ios' }) });
    await waitFor(() => expect(asked).toContain(`notify ${FIRST}`));
    const toggle = await screen.findByRole('switch', { name: /Turn on notifications/ });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(toggle);
    await settle();
    // The account is not told to forget the phone before the claim has landed (the market's switch reads what it is, beside).
    const told = () => asked.filter((line) => !line.startsWith('read'));
    expect(told()).toEqual([`notify ${FIRST}`]);
    act(() => land(true));
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('false'));
    expect(told()).toEqual([`notify ${FIRST}`, 'claimed', `stop ${FIRST}`]);
    expect(note.now?.state).toBe('off');
  });

  it('claims once when the player turns them on, for whoever is signed in: the account speaking again is nothing new', async () => {
    notices.status = 'granted';
    const signedIn = accountAt({ kind: 'guest', userId: 'guest-1', notice: null });
    const { all, asked } = community();
    renderGame(<Preferences />, { ...memoryServices(), account: signedIn.account, community: () => all, push: phonePush(memoryNote('off'), { platform: 'ios' }) });
    const toggle = await screen.findByRole('switch', { name: /Turn on notifications/ });
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
    act(() => signedIn.become({ kind: 'guest', userId: 'guest-1', notice: null }));
    await settle();
    await settle();
    expect(asked.filter((line) => line.startsWith('notify'))).toEqual([`notify ${FIRST} ios en`]);
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

  it('says it could not turn off where the account cannot be reached, and keeps them on', async () => {
    notices.status = 'granted';
    const note = memoryNote('on');
    const push = phonePush(note, { platform: 'ios' });
    const { all } = community({ stopNotifying: async () => Promise.reject(new Error('offline')) });
    await expect(push.pushOff(all)).resolves.toBe(false);
    expect(note.now).toEqual({ state: 'on', token: FIRST });
  });

  it('turns off once, however many times it is asked while it is under way: a second ask joins the first', async () => {
    notices.status = 'granted';
    const push = phonePush(memoryNote('on'), { platform: 'ios' });
    let answer: (done: boolean) => void = () => undefined;
    const { all, asked } = community({
      stopNotifying: (target: { expo: string } | string) => {
        asked.push(`stop ${typeof target === 'string' ? target : target.expo}`);
        return new Promise<boolean>((resolve) => (answer = resolve));
      },
    });
    const first = push.pushOff(all);
    const second = push.pushOff(all);
    expect(second).toBe(first);
    await settle();
    answer(true);
    await expect(first).resolves.toBe(true);
    expect(asked).toEqual([`stop ${FIRST}`]);
    // Done, the next is a new one.
    expect(push.pushOff(all)).not.toBe(first);
  });

  it('lets a sign-out go on where the account does not answer: it waits a while at most', async () => {
    notices.status = 'granted';
    const push = phonePush(memoryNote('on'), { platform: 'ios' });
    const { all } = community({ stopNotifying: () => new Promise<boolean>(() => undefined) });
    await expect(push.release(all, 20)).resolves.toBeUndefined();
  });
});
