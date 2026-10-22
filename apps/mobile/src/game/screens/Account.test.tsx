// @vitest-environment jsdom
import { content, lives } from '@ratrace/content';
import { LocalSessions } from '@ratrace/core/session/local';
import { MemoryStore } from '@ratrace/core/session/memory';
import { cameBackTo, noticeIn, SupabaseAccount } from '@ratrace/online/supabase';
import type { Account, AccountSaves, AccountState, CloudSaving, Opener } from '@ratrace/online/types';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useEffect, useLayoutEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { onlineOver } from '../../online';
import { BACK_FROM_GOOGLE, openForGoogle } from '../../online/browser';
import { accountCloud, fromGoogle, heldBrowser } from '../../testing/accountCloud';
import { appState, authBrowser } from '../../testing/fakes';
import { kv, memoryServices, renderGame, router } from '../../testing/render';
import { servicesOver } from '../context';
import type { Counted, Services } from '../context';
import { Home } from './Home';
import { Preferences } from './Settings';

/*
 * The account in the settings: the web's cases (apps/web/src/game/screens/Account.test.tsx), on the phone, and the phone's own: Google is the
 * system's browser, opened over the app and coming back to it, once or (for a Google account that is already a player's) twice.
 */

afterEach(cleanup);

/** An account whose state the test sets, and which remembers what it was asked. A trip to Google answers `kept`, or waits for the test. */
function fakeAccount(initial: AccountState, kept: boolean | Promise<boolean> = true) {
  let state = initial;
  const listeners = new Set<() => void>();
  const asked: Array<{ what: string; to?: string; open?: Opener }> = [];
  const account: Account = {
    state: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start: async (language) => void asked.push({ what: `start ${language}` }),
    keepWithGoogle: async (to, open) => (asked.push({ what: 'keep', to, open }), kept),
    useExistingAccount: async (to, open) => (asked.push({ what: 'use', to, open }), kept),
    dismissNotice: () => {
      asked.push({ what: 'dismiss' });
      if (state.kind === 'guest') state = { ...state, notice: null };
      for (const listener of listeners) listener();
    },
    signOut: async () => (asked.push({ what: 'sign out' }), true),
  };
  return { account, asked, said: () => asked.map((one) => one.what) };
}
/** The account's copy, standing wherever the test says. */
const savesAt = (status: CloudSaving): AccountSaves => ({
  status: () => status,
  offer: () => null,
  subscribe: () => () => {},
  onDeviceChanged: () => () => {},
  takeOffer: async () => false,
  declineOffer: async () => {},
});
const show = (account?: Account, locale: 'en' | 'es' | 'ru' = 'en', saves?: AccountSaves) => renderGame(<Preferences />, { ...memoryServices(), account, saves }, locale);

const KEEP = { name: 'Sign in with Google' };
const keepButton = () => screen.getByRole('button', KEEP);
const disabled = (element: HTMLElement) => element.getAttribute('aria-disabled') === 'true';
/** The sheet with this title. */
const sheetTitled = (title: string) => screen.getByRole('heading', { name: title }).closest('[aria-modal="true"]') as HTMLElement;

describe('the account in the settings', () => {
  it('signs a member out once asked twice, taking the account\'s things off the phone, keeping the settings, and lands on the front door', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    const { account, said } = fakeAccount({ kind: 'member', userId: 'u', email: null });
    renderGame(<Preferences />, { ...services, account, saves: savesAt('saved') }, 'en');
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    const sheet = sheetTitled('Sign out?');
    expect(sheet.textContent).toContain('Your lives and progress stay in your account, but leave this device.');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/'));
    expect(said()).toContain('sign out');
    expect(await services.store.loadGame()).toBeNull();
  });

  it('shuts the sheets before the game starts again: none is open as the game is drawn anew, nor as the player lands on the front door', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    const { account } = fakeAccount({ kind: 'member', userId: 'u', email: null });
    const sheetOpen = () => document.querySelector('[aria-modal="true"]') !== null;
    // Whether a sheet was there when each start of the game was drawn, when it was taken away (drawn before the front door, so it is taken away
    // before the door's own sheets would be), and when the player was sent home.
    const drawnWithSheet: boolean[] = [];
    const takenWithSheet: boolean[] = [];
    function Start() {
      useEffect(() => void drawnWithSheet.push(sheetOpen()), []);
      useLayoutEffect(() => () => void takenWithSheet.push(sheetOpen()), []);
      return null;
    }
    const landedWithSheet: boolean[] = [];
    router.dismissTo.mockImplementation(() => void landedWithSheet.push(sheetOpen()));
    renderGame(
      <>
        <Start />
        <Home />
      </>,
      { ...services, account, saves: savesAt('saved') },
    );
    // The way out, from the front door's settings: the question over the settings sheet, two sheets open.
    fireEvent.click((await screen.findAllByRole('button', { name: 'Settings' }))[0]);
    fireEvent.click(within(sheetTitled('Settings')).getByRole('button', { name: 'Sign out' }));
    fireEvent.click(within(sheetTitled('Sign out?')).getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(landedWithSheet).toEqual([false]));
    expect(takenWithSheet).toEqual([false]);
    expect(drawnWithSheet).toEqual([false, false]);
    expect(screen.queryByRole('heading', { name: 'Sign out?' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Settings' })).toBeNull();
    // The sheets of the game drawn anew open as they always do.
    fireEvent.click((await screen.findAllByRole('button', { name: 'Settings' }))[0]);
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeTruthy();
  });

  it('keeps the member signed in when they answer no', async () => {
    const { account, said } = fakeAccount({ kind: 'member', userId: 'u', email: null });
    show(account, 'en', savesAt('saved'));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    fireEvent.click(within(sheetTitled('Sign out?')).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Sign out?' })).toBeNull());
    expect(said()).not.toContain('sign out');
    expect(screen.getByRole('region', { name: 'Account' }).textContent).toContain('Linked to Google');
  });

  it('does not sign out while changes are still on their way to the account, and says why', () => {
    for (const status of ['waiting', 'sending'] as const) {
      const { account } = fakeAccount({ kind: 'member', userId: 'u', email: null });
      show(account, 'en', savesAt(status));
      fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
      const sheet = sheetTitled('Sign out?');
      expect(disabled(within(sheet).getByRole('button', { name: 'Sign out' })), status).toBe(true);
      expect(sheet.textContent).toContain('Some changes are still on their way to your account.');
      cleanup();
    }
  });

  it('is not there at all in a game with no cloud behind it', () => {
    show();
    expect(screen.queryByRole('region', { name: 'Account' })).toBeNull();
    expect(screen.getByRole('switch', { name: /Tips from the guide/ })).toBeTruthy();
  });

  it('starts the account once, in the language of the game', async () => {
    const { account, said } = fakeAccount({ kind: 'offline' });
    show(account, 'es');
    await waitFor(() => expect(said()).toEqual(['start es']));
    expect(screen.queryByRole('region', { name: 'Cuenta' })).toBeNull();
  });

  it('tells a guest so, and opens Google over the app, back to the app\'s own address, when they ask to keep the account', async () => {
    const trip = heldBrowser();
    const { account, asked } = fakeAccount({ kind: 'guest', userId: 'u', notice: null }, trip.answer.then(() => false));
    show(account);
    const block = screen.getByRole('region', { name: 'Account' });
    expect(within(block).getByRole('button', KEEP)).toBeTruthy();
    expect(document.querySelector('[data-sprite="logo.google"]')).not.toBeNull();
    fireEvent.click(keepButton());
    expect(asked.find((one) => one.what === 'keep')).toEqual({ what: 'keep', to: BACK_FROM_GOOGLE, open: openForGoogle });
    // While the browser is open, a second press must not start a second trip.
    await waitFor(() => expect(disabled(keepButton())).toBe(true));
    fireEvent.click(keepButton());
    expect(asked.filter((one) => one.what === 'keep')).toHaveLength(1);
    // Back with nothing: the button is there to try again.
    await act(async () => trip.back(fromGoogle.closed));
    await waitFor(() => expect(disabled(keepButton())).toBe(false));
  });

  it('lets a guest try again when the trip came to nothing, or broke on the way', async () => {
    show(fakeAccount({ kind: 'guest', userId: 'u', notice: null }, false).account);
    fireEvent.click(keepButton());
    await waitFor(() => expect(disabled(keepButton())).toBe(false));
    cleanup();
    show(fakeAccount({ kind: 'guest', userId: 'u', notice: null }, Promise.reject(new Error('no browser'))).account);
    fireEvent.click(keepButton());
    await waitFor(() => expect(disabled(keepButton())).toBe(false));
  });

  it('says a player whose Google account already has one is being taken into it, and asks nothing', () => {
    show(fakeAccount({ kind: 'guest', userId: 'u', notice: 'joining' }).account);
    // Most often it is the same player on another device: the game takes them in on its own, with nothing to press.
    expect(screen.getByRole('status').textContent).toBe('You already have an account. Signing you in…');
    expect(screen.queryByRole('button', KEEP)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says where the player\'s things are only when the account is out of reach, and keeps quiet while they are on their way to it', () => {
    const member: AccountState = { kind: 'member', userId: 'u', email: null };
    show(fakeAccount(member).account, 'en', savesAt('saved'));
    expect(screen.queryByRole('status')).toBeNull();
    cleanup();
    show(fakeAccount(member).account, 'en', savesAt('sending'));
    expect(screen.queryByRole('status')).toBeNull();
    cleanup();
    show(fakeAccount({ kind: 'guest', userId: 'u', notice: null }).account, 'es', savesAt('waiting'));
    expect(screen.getByRole('status').textContent).toBe('Sin conexión: guardado solo aquí');
  });

  it('says nothing about saving to an account where nothing is being saved to one', () => {
    show(fakeAccount({ kind: 'member', userId: 'u', email: null }).account, 'en', savesAt('off'));
    expect(screen.queryByRole('status')).toBeNull();
    cleanup();
    show(fakeAccount({ kind: 'member', userId: 'u', email: null }).account);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('says plainly when nothing was linked, whatever the reason, until the player says OK', async () => {
    const { account, said } = fakeAccount({ kind: 'guest', userId: 'u', notice: 'failed' });
    show(account);
    expect(screen.getByRole('alert').textContent).toBe('Could not sign in. You are still a guest.');
    expect(screen.queryByRole('button', { name: 'Use that account on this device' })).toBeNull();
    // The way to try again is there beside it.
    expect(disabled(keepButton())).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(said()).toContain('dismiss');
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('shows a kept account as kept, with enough of the address to know it and not the whole of it', () => {
    show(fakeAccount({ kind: 'member', userId: 'u', email: 'ana.garcia@example.com' }).account);
    const block = screen.getByRole('region', { name: 'Account' });
    expect(block.textContent).toContain('Linked to Google');
    // The settings are also drawn on the front door, where anyone beside the player can read them.
    expect(block.textContent).toContain('an•••@example.com');
    expect(block.textContent).not.toContain('ana.garcia');
    expect(screen.queryByRole('button', KEEP)).toBeNull();
  });

  it('works over the real account, not only over a stand-in: a guest signs in, and is shown as one', async () => {
    const { cloud } = accountCloud();
    show(new SupabaseAccount(async () => cloud, () => null, () => undefined));
    expect(within(await screen.findByRole('region', { name: 'Account' })).getByRole('button', KEEP)).toBeTruthy();
  });

  it('speaks Spanish and Russian', () => {
    show(fakeAccount({ kind: 'guest', userId: 'u', notice: null }).account, 'es');
    expect(within(screen.getByRole('region', { name: 'Cuenta' })).getByRole('button', { name: 'Entrar con Google' })).toBeTruthy();
    cleanup();
    show(fakeAccount({ kind: 'member', userId: 'u', email: null }).account, 'ru');
    expect(screen.getByRole('region', { name: 'Аккаунт' })).toBeTruthy();
  });
});

describe('keeping the account with Google, on the phone', () => {
  /**
   * The phone over the project in memory (`accountCloud`): the real account, mirror and follower, its life `nurse` begun before anyone signed in.
   * Google's browser comes back as each trip is told (`authBrowser.queued`).
   */
  async function phone(existing: string | null = null) {
    const project = accountCloud({ existing });
    const device = new MemoryStore();
    const noted = () => {
      let ids: string[] = [];
      return { read: () => ids, write: (next: string[]) => void (ids = next) };
    };
    const online = onlineOver(device, {
      connect: async () => project.cloud,
      address: () => null,
      clean: () => undefined,
      page: { onOnline: () => () => {}, onShown: () => () => {}, now: () => 0 },
      remember: noted(),
      keepRefused: noted(),
      newId: () => 'phone-renamed',
    });
    let ids = 0;
    let clock = 1_000;
    const deps = { newId: () => `phone-${(ids += 1)}`, newSeed: () => `seed-phone-${ids}`, now: () => (clock += 1) };
    await new LocalSessions(device, content, lives, deps).start('nurse');
    const counted: Counted[] = [];
    const services: Services = { ...servicesOver(online, deps), tapGuardMs: 0, track: (event) => counted.push(event) };
    renderGame(<Preferences />, services);
    await waitFor(() => expect(keepButton()).toBeTruthy());
    return { project, device, online, counted };
  }
  const block = () => screen.getByRole('region', { name: 'Account' });

  it('keeps the guest\'s account: the button waits while the browser is open, and the account is shown kept when it comes back', async () => {
    const trip = heldBrowser();
    authBrowser.queued.push(trip.answer);
    const { counted, online } = await phone();
    fireEvent.click(keepButton());
    await waitFor(() => expect(authBrowser.opened).toHaveLength(1));
    expect(authBrowser.opened[0].redirect).toBe('theratrace://auth');
    expect(disabled(keepButton())).toBe(true);
    await act(async () => trip.back(fromGoogle.linked));
    await waitFor(() => expect(block().textContent).toContain('Linked to Google'));
    expect(online.account.state()).toEqual({ kind: 'member', userId: 'guest-1', email: 'ana.garcia@example.com' });
    expect(block().textContent).toContain('an•••@example.com');
    expect(counted).toContainEqual({ name: 'account_kept' });
    expect(kv.has('ratrace:keeping-account')).toBe(false);
  });

  it('takes a guest whose Google account is already a player\'s into it: the browser opens a second time, and the screen says what is happening on both trips', async () => {
    const first = heldBrowser();
    const second = heldBrowser();
    authBrowser.queued.push(first.answer, second.answer);
    const { counted, online } = await phone('member-1');
    fireEvent.click(keepButton());
    await waitFor(() => expect(authBrowser.opened).toHaveLength(1));
    // On the first trip: the button waits, and nothing is said yet.
    expect(disabled(keepButton())).toBe(true);
    expect(screen.queryByRole('status')).toBeNull();
    // Back from the first: the account is already a player's. The player is told they are being taken into it, and Google opens again, for them.
    await act(async () => first.back(fromGoogle.taken));
    await waitFor(() => expect(authBrowser.opened).toHaveLength(2));
    expect(screen.getByRole('status').textContent).toBe('You already have an account. Signing you in…');
    expect(screen.queryByRole('button', KEEP)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(online.account.state()).toEqual({ kind: 'guest', userId: 'guest-1', notice: 'joining' });
    // Back from the second: the player is the account's member, and nothing is left to say.
    await act(async () => second.back(fromGoogle.linked));
    await waitFor(() => expect(block().textContent).toContain('Linked to Google'));
    expect(online.account.state()).toEqual({ kind: 'member', userId: 'member-1', email: 'ana.garcia@example.com' });
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    // Signing in to an account that was already a player's is not keeping this one: nothing counted, and no note left for a later sign-in.
    expect(counted.filter((event) => event.name === 'account_kept')).toEqual([]);
    expect(kv.has('ratrace:keeping-account')).toBe(false);
  });

  for (const [how, answer] of [['closes', fromGoogle.closed], ['has it killed', fromGoogle.killed]] as const) {
    it(`leaves the guest a guest, with nothing said, when the player ${how} the second browser: the button is back to try again`, async () => {
      const second = heldBrowser();
      authBrowser.queued.push(fromGoogle.taken, second.answer);
      const { counted, online } = await phone('member-1');
      fireEvent.click(keepButton());
      await waitFor(() => expect(screen.getByRole('status').textContent).toBe('You already have an account. Signing you in…'));
      await act(async () => second.back(answer));
      await waitFor(() => expect(disabled(keepButton())).toBe(false));
      expect(online.account.state()).toEqual({ kind: 'guest', userId: 'guest-1', notice: null });
      expect(screen.queryByRole('status')).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(counted).toEqual([]);
      expect(kv.has('ratrace:keeping-account')).toBe(false);
    });

    it(`leaves the guest a guest, with nothing said, when the player ${how} the first browser`, async () => {
      authBrowser.queued.push(answer);
      const { online } = await phone();
      fireEvent.click(keepButton());
      await waitFor(() => expect(authBrowser.opened).toHaveLength(1));
      await waitFor(() => expect(disabled(keepButton())).toBe(false));
      expect(online.account.state()).toEqual({ kind: 'guest', userId: 'guest-1', notice: null });
      expect(screen.queryByRole('alert')).toBeNull();
      expect(kv.has('ratrace:keeping-account')).toBe(false);
    });
  }

  it('says plainly when Google said no, and the guest is still a guest who can try again', async () => {
    authBrowser.queued.push(fromGoogle.failed);
    const { online } = await phone();
    fireEvent.click(keepButton());
    expect((await screen.findByRole('alert')).textContent).toBe('Could not sign in. You are still a guest.');
    await waitFor(() => expect(disabled(keepButton())).toBe(false));
    expect(online.account.state()).toEqual({ kind: 'guest', userId: 'guest-1', notice: 'failed' });
    expect(authBrowser.opened).toHaveLength(1);
  });

  it('on Android, opens the second browser once the first has let go, and the player is in the existing account', async () => {
    authBrowser.android = true;
    authBrowser.queued.push(fromGoogle.taken, fromGoogle.linked);
    const { online } = await phone('member-1');
    fireEvent.click(keepButton());
    // The browser still holds the first trip (the app has not been told it is in front again): the second is refused once, and tried again.
    await waitFor(() => expect(authBrowser.refused).toBe(1));
    expect(screen.getByRole('status').textContent).toBe('You already have an account. Signing you in…');
    act(() => appState.set('active'));
    await waitFor(() => expect(block().textContent).toContain('Linked to Google'));
    expect(online.account.state()).toEqual({ kind: 'member', userId: 'member-1', email: 'ana.garcia@example.com' });
    expect(authBrowser.opened).toHaveLength(2);
  });

  it('on Android, says plainly that it could not sign in when the second browser is refused twice, and leaves a guest, never half signed in', async () => {
    authBrowser.android = true;
    authBrowser.stubborn = 5;
    authBrowser.queued.push(fromGoogle.taken);
    const { online, counted } = await phone('member-1');
    fireEvent.click(keepButton());
    await waitFor(() => expect(authBrowser.refused).toBe(1));
    act(() => appState.set('active'));
    expect((await screen.findByRole('alert')).textContent).toBe('Could not sign in. You are still a guest.');
    expect(screen.queryByRole('status')).toBeNull();
    await waitFor(() => expect(disabled(keepButton())).toBe(false));
    expect(online.account.state()).toEqual({ kind: 'guest', userId: 'guest-1', notice: 'failed' });
    // Refused twice, and never a third time.
    expect(authBrowser.refused).toBe(2);
    expect(authBrowser.opened).toHaveLength(1);
    expect(counted).toEqual([]);
    expect(kv.has('ratrace:keeping-account')).toBe(false);
  });

  it('says plainly when the second trip fails, and takes back the word that the player was being signed in', async () => {
    authBrowser.queued.push(fromGoogle.taken, fromGoogle.failed);
    const { online } = await phone('member-1');
    fireEvent.click(keepButton());
    expect((await screen.findByRole('alert')).textContent).toBe('Could not sign in. You are still a guest.');
    expect(screen.queryByRole('status')).toBeNull();
    await waitFor(() => expect(disabled(keepButton())).toBe(false));
    expect(online.account.state()).toEqual({ kind: 'guest', userId: 'guest-1', notice: 'failed' });
  });
});

describe('the project in memory these tests run on', () => {
  it('reads the address Google sends back as strictly as the real client: only a code, back to the app\'s own address, with no word of a failure', async () => {
    for (const [url, signedIn] of [
      ['theratrace://auth?code=c0de', true],
      ['theratrace://auth/?code=c0de', true],
      ['theratrace://auth#code=c0de', false],
      ['theratrace://authx?code=c0de', false],
      ['theratrace://auth?error=access_denied&code=c0de', false],
      ['theratrace://auth?code=c0de#error=server_error', false],
      ['https://example.com/?code=c0de', false],
    ] as const) {
      const project = accountCloud({ signedIn: { id: 'guest-1', is_anonymous: true, email: undefined } });
      expect(await project.cloud.linkGoogle(BACK_FROM_GOOGLE, async () => url), url).toBe(signedIn);
      // As the client decides it (connect.ts, `throughBrowser`): back to where it was sent, nothing said of a failure, a code in its query.
      expect(cameBackTo(url, BACK_FROM_GOOGLE) && noticeIn(url) === null && new URL(url).searchParams.has('code'), url).toBe(signedIn);
    }
  });
});
