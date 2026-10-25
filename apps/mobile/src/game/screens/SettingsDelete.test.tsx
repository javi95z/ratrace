// @vitest-environment jsdom
import { content, lives } from '@ratrace/content';
import { LocalSessions } from '@ratrace/core/session/local';
import { MemoryStore } from '@ratrace/core/session/memory';
import { readRun } from '@ratrace/core/session/runs';
import { newProfile } from '@ratrace/core/session/types';
import { SupabaseAccount } from '@ratrace/online/supabase';
import type { Account, AccountSaves, AccountState } from '@ratrace/online/types';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onlineOver } from '../../online';
import { accountCloud } from '../../testing/accountCloud';
import { kv, memoryServices, renderGame, router } from '../../testing/render';
import { servicesOver } from '../context';
import { HomeSettingsSheet, Preferences } from './Settings';

/*
 * Deleting the account from the settings (a rule of Google Play's: a player can delete their account in the app, and on the site): last in the list
 * and quiet, asked first in a sheet that says what goes, and only then sent. Once the server says the account is gone, the device forgets the player
 * (the lives, the records, the profile, the session, the lists for the account, the notices) and keeps its own settings; the game starts again as on
 * a first visit, on the front door. A failure says so, and leaves everything as it was.
 */

afterEach(cleanup);

/** An account whose state the test sets, which deletes as told (true, false, or when the test says), and remembers what it was asked. */
function fakeAccount(initial: AccountState, deleted: boolean | Promise<boolean> = true, can = true) {
  let state = initial;
  const listeners = new Set<() => void>();
  const asked: string[] = [];
  const tell = () => {
    for (const listener of [...listeners]) listener();
  };
  const account: Account = {
    state: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start: async () => void asked.push('start'),
    keepWithGoogle: async () => false,
    useExistingAccount: async () => false,
    dismissNotice: () => undefined,
    signOut: async () => (asked.push('sign out'), true),
    ...(can
      ? {
          deleteAccount: async () => {
            asked.push('delete');
            const done = await deleted;
            if (done) {
              state = { kind: 'offline' };
              tell();
            }
            return done;
          },
        }
      : {}),
  };
  return { account, asked };
}

const GUEST: AccountState = { kind: 'guest', userId: 'guest-1', notice: null };
const MEMBER: AccountState = { kind: 'member', userId: 'member-1', email: 'ana@example.com' };
/** The sheet with this title. */
const sheetTitled = (title: string) => screen.getByRole('heading', { name: title }).closest('[aria-modal="true"]') as HTMLElement;
const disabled = (element: HTMLElement) => element.getAttribute('aria-disabled') === 'true';
const DELETE = { name: 'Delete account' };

/** A player with things on the device: a life in progress, a finished one, the sound off; and what the device keeps beside the store. */
async function playerWithThings() {
  const services = memoryServices();
  await services.sessions.start('nurse');
  const run = readRun({ runId: 'run-1', lifeId: 'nurse', finishedAt: 500, score: 321, history: [1, 2, 3] });
  if (run === null) throw new Error('no run');
  await services.store.addRun(run);
  const profile = await services.store.loadProfile();
  await services.store.saveProfile({ ...profile, settings: { ...profile.settings, sound: false }, guide: { ...profile.guide, off: true } });
  for (const [key, value] of [
    ['ratrace:session:sb-ref-auth-token', '{"access_token":"x"}'],
    ['ratrace:basket', '{"gameId":"id-1"}'],
    ['ratrace:given-up', '["old-1"]'],
    ['ratrace.lastAccount', 'guest-1'],
    ['ratrace:locale', 'en'],
    ['ratrace:push', '{"state":"on","token":"ExponentPushToken[phone-1]"}'],
  ]) kv.set(key, value);
  return services;
}

describe('deleting the account, in the settings', () => {
  it('is offered last, quietly, to a guest and to a member, and not at all where there is no account to delete', () => {
    for (const state of [GUEST, MEMBER]) {
      renderGame(<Preferences />, { ...memoryServices(), account: fakeAccount(state).account });
      const buttons = screen.getAllByRole('button');
      expect(buttons.at(-1)?.textContent, state.kind).toBe('Delete account');
      cleanup();
    }
    renderGame(<Preferences />, { ...memoryServices(), account: fakeAccount({ kind: 'offline' }).account });
    expect(screen.queryByRole('button', DELETE)).toBeNull();
    cleanup();
    // An account that cannot be deleted from here offers nothing to press.
    renderGame(<Preferences />, { ...memoryServices(), account: fakeAccount(GUEST, true, false).account });
    expect(screen.queryByRole('button', DELETE)).toBeNull();
    cleanup();
    // And none in a game with no cloud behind it.
    renderGame(<Preferences />, memoryServices());
    expect(screen.queryByRole('button', DELETE)).toBeNull();
  });

  it('is last in the settings of the front door too, after the switches, above the version', () => {
    renderGame(<HomeSettingsSheet open onClose={() => undefined} />, { ...memoryServices(), account: fakeAccount(GUEST).account });
    const sheet = sheetTitled('Settings');
    const button = within(sheet).getByRole('button', DELETE);
    const guide = within(sheet).getByRole('switch', { name: /Tips from the guide/ });
    expect(guide.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(sheet).getAllByRole('button').at(-1)).toBe(button);
  });

  it('asks first, in a sheet that says plainly what goes and that it cannot be undone; Cancel deletes nothing', async () => {
    const { account, asked } = fakeAccount(GUEST);
    renderGame(<Preferences />, { ...memoryServices(), account });
    fireEvent.click(screen.getByRole('button', DELETE));
    const sheet = sheetTitled('Delete your account?');
    for (const goes of ['every life and record', 'your name in the rankings', 'your friends', 'your games with others', 'your notices', 'cannot be undone']) expect(sheet.textContent).toContain(goes);
    // What another phone or browser holds is its own, until the account is deleted there too.
    expect(sheet.textContent).toContain('Another phone or browser where you played keeps its own copy until you delete the account there too.');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Delete your account?' })).toBeNull());
    expect(asked).not.toContain('delete');
  });

  it('deletes once asked twice, takes the player off the device and keeps the device\'s own settings, and lands on the front door as on a first visit', async () => {
    const services = await playerWithThings();
    const { account, asked } = fakeAccount(MEMBER);
    renderGame(<Preferences />, { ...services, account });
    fireEvent.click(screen.getByRole('button', DELETE));
    fireEvent.click(within(sheetTitled('Delete your account?')).getByRole('button', { name: 'Delete forever' }));
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/en'));
    expect(asked).toContain('delete');
    // Nothing of the player's is left on the device to go up to the next guest.
    expect(await services.store.loadGame()).toBeNull();
    expect(await services.store.listRuns()).toEqual([]);
    const profile = await services.store.loadProfile();
    expect(profile).toEqual({ ...newProfile(), settings: profile.settings });
    for (const key of ['ratrace:session:sb-ref-auth-token', 'ratrace:basket', 'ratrace:given-up', 'ratrace.lastAccount']) expect(kv.has(key), key).toBe(false);
    // What is the device's own stays: the sound off, the language; the notices are off, the server having forgotten the phone with the account.
    expect(profile.settings.sound).toBe(false);
    expect(kv.get('ratrace:locale')).toBe('en');
    expect(JSON.parse(kv.get('ratrace:push') ?? 'null')).toEqual({ state: 'off', token: null });
    // The game starts again, and the account with it: a new guest, for whoever plays next.
    await waitFor(() => expect(asked.filter((one) => one === 'start')).toHaveLength(2));
    expect(screen.queryByRole('heading', { name: 'Delete your account?' })).toBeNull();
  });

  it('says so in the sheet when the account could not be deleted, and leaves everything on the device as it was', async () => {
    const services = await playerWithThings();
    const { account } = fakeAccount(GUEST, false);
    renderGame(<Preferences />, { ...services, account });
    fireEvent.click(screen.getByRole('button', DELETE));
    const sheet = sheetTitled('Delete your account?');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete forever' }));
    // Not the connection's fault, necessarily (a server's no, one not there yet): what is true is said, and what to do.
    expect((await within(sheet).findByRole('alert')).textContent).toBe('Your account could not be deleted. Nothing has changed on this device. Try again later.');
    expect(await services.store.loadGame()).not.toBeNull();
    expect(await services.store.listRuns()).toHaveLength(1);
    expect(kv.has('ratrace:session:sb-ref-auth-token')).toBe(true);
    expect(router.dismissTo).not.toHaveBeenCalled();
    // It can be tried again.
    expect(disabled(within(sheet).getByRole('button', { name: 'Delete forever' }))).toBe(false);
  });

  it('sends once however often it is pressed: the button waits, and says so, while the server answers', async () => {
    let answer: (done: boolean) => void = () => undefined;
    const { account, asked } = fakeAccount(GUEST, new Promise<boolean>((resolve) => (answer = resolve)));
    renderGame(<Preferences />, { ...memoryServices(), account });
    fireEvent.click(screen.getByRole('button', DELETE));
    const sheet = sheetTitled('Delete your account?');
    const yes = within(sheet).getByRole('button', { name: 'Delete forever' });
    fireEvent.click(yes);
    fireEvent.click(yes);
    const waiting = await within(sheet).findByRole('button', { name: 'Deleting…' });
    expect(disabled(waiting)).toBe(true);
    fireEvent.click(waiting);
    expect(asked.filter((one) => one === 'delete')).toHaveLength(1);
    // Nor can it be left while the server answers: what it answers is said in it.
    expect(disabled(within(sheet).getByRole('button', { name: 'Cancel' }))).toBe(true);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    await new Promise((settled) => setTimeout(settled, 20));
    expect(screen.getByRole('heading', { name: 'Delete your account?' })).toBeTruthy();
    answer(true);
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/en'));
  });

  it('works over the real account: the project forgets the player, and the game starts again with a new guest', async () => {
    const project = accountCloud();
    const services = await playerWithThings();
    renderGame(<Preferences />, { ...services, account: new SupabaseAccount(async () => project.cloud, () => null, () => undefined) });
    fireEvent.click(await screen.findByRole('button', DELETE));
    fireEvent.click(within(sheetTitled('Delete your account?')).getByRole('button', { name: 'Delete forever' }));
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/en'));
    expect(project.state.deleted).toEqual(['guest-1']);
    await waitFor(() => expect(project.state.user?.id).toBe('guest-2'));
    expect(await services.store.listRuns()).toEqual([]);
  });

  it('lets the mirror forget the account gone, once the server said so, and never after a deletion that did not happen', async () => {
    for (const deleted of [false, true]) {
      const forget = vi.fn(async () => undefined);
      const saves: AccountSaves = { status: () => 'saved', offer: () => null, subscribe: () => () => {}, onDeviceChanged: () => () => {}, takeOffer: async () => false, declineOffer: async () => {}, forget };
      renderGame(<Preferences />, { ...memoryServices(), account: fakeAccount(GUEST, deleted).account, saves });
      fireEvent.click(screen.getByRole('button', DELETE));
      fireEvent.click(within(sheetTitled('Delete your account?')).getByRole('button', { name: 'Delete forever' }));
      if (deleted) await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/en'));
      else await within(sheetTitled('Delete your account?')).findByRole('alert');
      expect(forget.mock.calls.length > 0, String(deleted)).toBe(deleted);
      cleanup();
    }
  });

  it('lands on the front door once the server said so, whatever fails on the device after: the account is gone, never "could not delete"', async () => {
    const services = await playerWithThings();
    const broken = Object.assign(Object.create(Object.getPrototypeOf(services.store) as object) as MemoryStore, services.store, {
      clearGame: async () => {
        throw new Error('the device will not');
      },
    });
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    renderGame(<Preferences />, { ...services, store: broken, account: fakeAccount(GUEST).account });
    fireEvent.click(screen.getByRole('button', DELETE));
    fireEvent.click(within(sheetTitled('Delete your account?')).getByRole('button', { name: 'Delete forever' }));
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/en'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Delete your account?' })).toBeNull();
    // The rest is cleared all the same.
    expect(await services.store.listRuns()).toEqual([]);
    warned.mockRestore();
  });

  it('finishes a deletion whose answer was lost: asked again, the server answers deleted, and only then is the device cleared', async () => {
    const project = accountCloud();
    project.state.lostAnswers = 1;
    const services = await playerWithThings();
    renderGame(<Preferences />, { ...services, account: new SupabaseAccount(async () => project.cloud, () => null, () => undefined) });
    fireEvent.click(await screen.findByRole('button', DELETE));
    const sheet = sheetTitled('Delete your account?');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete forever' }));
    await within(sheet).findByRole('alert');
    // Gone on the server already, but the phone was not told: it keeps everything, and is asked again.
    expect(project.state.deleted).toEqual(['guest-1']);
    expect(await services.store.listRuns()).toHaveLength(1);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete forever' }));
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/en'));
    expect(project.state.deleted).toEqual(['guest-1']);
    expect(await services.store.listRuns()).toEqual([]);
    expect(await services.store.loadGame()).toBeNull();
  });

  it('over the real account and mirror: the next guest\'s account is sent nothing of the deleted player', async () => {
    const project = accountCloud();
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
    renderGame(<Preferences />, { ...servicesOver(online, deps), tapGuardMs: 0 });
    // The guest's life goes up to their account, as any does.
    await waitFor(() => expect(project.held('guest-1').games).toHaveLength(1));
    fireEvent.click(await screen.findByRole('button', DELETE));
    fireEvent.click(within(sheetTitled('Delete your account?')).getByRole('button', { name: 'Delete forever' }));
    await waitFor(() => expect(project.state.user?.id).toBe('guest-2'));
    await new Promise((settled) => setTimeout(settled, 50));
    expect(project.held('guest-2').games).toEqual([]);
    expect(project.held('guest-2').runs).toEqual([]);
    expect(await device.loadGame()).toBeNull();
  });

  it.each([
    ['es', 'Borrar la cuenta', '¿Borrar tu cuenta?', 'Borrar para siempre'],
    ['ru', 'Удалить аккаунт', 'Удалить аккаунт?', 'Удалить навсегда'],
  ] as const)('speaks %s', (locale, button, title, yes) => {
    renderGame(<Preferences />, { ...memoryServices(), account: fakeAccount(GUEST).account }, locale);
    // A text is cut into one piece for each typeface it needs (Russian's spaces are the pixel face's), so it is read whole from the page.
    const said = (role: string, words: string) => screen.getAllByRole(role).find((element) => element.textContent === words);
    fireEvent.click(said('button', button) as HTMLElement);
    const sheet = said('heading', title)?.closest('[aria-modal="true"]') as HTMLElement;
    expect(within(sheet).getAllByRole('button').some((element) => element.textContent === yes)).toBe(true);
  });
});
