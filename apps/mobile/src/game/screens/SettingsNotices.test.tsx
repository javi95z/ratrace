// @vitest-environment jsdom
import type { Community } from '@ratrace/online/types';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { kvPush } from '../../kvStore';
import { phonePush } from '../../online/push';
import type { PushNote } from '../../online/push';
import { expoConstants, expoDevice, notices } from '../../testing/fakes';
import { memoryServices, renderGame } from '../../testing/render';
import { Preferences } from './Settings';

/*
 * The web's SettingsNotices.test.tsx, on the phone: the notices of the game, turned on in the settings. The phone's own notices (expo-notifications)
 * are the stand-in's (`notices`); the push is the real one (`online/push.ts`), on an iPhone with the game's Expo project set.
 */

const PROJECT = 'b1c2d3e4-0000-4000-8000-000000000001';
const TOKEN = 'ExponentPushToken[phone-1]';

beforeEach(() => {
  vi.stubEnv('EXPO_PUBLIC_EAS_PROJECT_ID', PROJECT);
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

/** A note kept in memory, as the phone's store keeps it (`kvPush`). */
function memoryNote(start: ReturnType<PushNote['read']> = null): PushNote & { now: ReturnType<PushNote['read']> } {
  const note = { now: start, read: () => note.now, write: (state: 'on' | 'off' | 'refused') => void (note.now = state) };
  return note;
}

function community(over: Partial<Community> = {}) {
  const asked: string[] = [];
  const all = {
    me: async () => null,
    notifyMe: async (keys: { expo: string; platform: string }, locale: string) => (asked.push(`notify ${keys.expo} ${keys.platform} ${locale}`), true),
    stopNotifying: async (target: { expo: string }) => (asked.push(`stop ${target.expo}`), true),
    marketNotice: async (target: { expo: string }) => (asked.push(`read ${target.expo}`), false),
    setMarketNotice: async (target: { expo: string }, on: boolean) => (asked.push(`set ${target.expo} ${on}`), true),
    ...over,
  } as unknown as Community;
  return { all, asked };
}

function show(options: { note?: PushNote; over?: Partial<Community>; locale?: 'en' | 'es' | 'ru'; platform?: string } = {}) {
  const { all, asked } = community(options.over);
  // The note as the test reads it back (`now`): the phone's own store (`kvPush`) is read through the push instead.
  const note = (options.note ?? memoryNote()) as ReturnType<typeof memoryNote>;
  const push = phonePush(note, { platform: options.platform ?? 'ios' });
  renderGame(<Preferences />, { ...memoryServices(), community: () => all, push }, options.locale ?? 'en');
  return { asked, note, push };
}

/** The first drawing of a language's typeface takes its time in a test (Russian's most). */
const LONG = { timeout: 10_000 };
/** A sentence as the switch's name holds it: a name in Cyrillic is read by word (its own typeface), the words with whatever is between them. */
const inWords = (sentence: string) => new RegExp(sentence.split(' ').map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*'));
const weekly = () => screen.findByRole('switch', { name: /Turn on notifications/ }, LONG);
const market = () => screen.queryByRole('switch', { name: /Tell me when my market moves/ });
/** Lets the screen hear what it asked: a turn of promises for each step of the switch. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the notices in Settings, on the phone', () => {
  it('asks the phone once, and keeps the token with the account in the language of the game', async () => {
    const { asked, note } = show({ locale: 'es' });
    const toggle = await screen.findByRole('switch', { name: /Activar notificaciones/ });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    // Nothing is asked of the phone before the player turns the switch on.
    expect(notices.asked).toBe(0);
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
    expect(notices.asked).toBe(1);
    expect(notices.tokenAsks).toEqual([{ projectId: PROJECT }]);
    expect(asked[0]).toBe(`notify ${TOKEN} ios es`);
    expect(note.now).toBe('on');
    // The market's own switch is there now, as the server says it stands.
    expect(await screen.findByRole('switch', { name: /Avisarme si se mueve mi mercado/ })).toBeTruthy();
    expect(asked).toContain(`read ${TOKEN}`);
  });

  it('asks once only, even pressed twice before the phone answers', async () => {
    show();
    const toggle = await weekly();
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
    expect(notices.asked).toBe(1);
  });

  it('leaves the switch off on a refusal, says where to allow them, and never asks again', async () => {
    notices.answer = 'denied';
    const note = memoryNote();
    const { asked } = show({ note });
    const toggle = await weekly();
    fireEvent.click(toggle);
    expect(await screen.findByText('Notices are blocked for this app: allow them in your phone\'s settings.')).toBeTruthy();
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(note.now).toBe('refused');
    expect(asked).toEqual([]);
    // Pressed again, it is not asked again: it says so again.
    fireEvent.click(toggle);
    await settle();
    expect(notices.asked).toBe(1);
    cleanup();
    // Nor on another start of the app, even where the phone would let it ask (an Android that forgot): the refusal is the app's to remember.
    notices.canAskAgain = true;
    notices.status = 'undetermined';
    show({ note });
    fireEvent.click(await weekly());
    expect(await screen.findByText(/Notices are blocked for this app/)).toBeTruthy();
    expect(notices.asked).toBe(1);
  });

  it('remembers the refusal in the phone\'s store, through its own note', async () => {
    notices.answer = 'denied';
    show({ note: kvPush });
    fireEvent.click(await weekly());
    await screen.findByText(/Notices are blocked/);
    cleanup();
    notices.status = 'undetermined';
    notices.canAskAgain = true;
    show({ note: kvPush });
    fireEvent.click(await weekly());
    await screen.findByText(/Notices are blocked/);
    expect(notices.asked).toBe(1);
  });

  it('turns on with no question where the player allowed them in the phone\'s settings since', async () => {
    notices.status = 'granted';
    const { asked } = show({ note: memoryNote('refused') });
    const toggle = await weekly();
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
    expect(notices.asked).toBe(0);
    expect(asked[0]).toBe(`notify ${TOKEN} ios en`);
  });

  it('says the words of the refusal in each language', async () => {
    notices.status = 'denied';
    notices.canAskAgain = false;
    show({ locale: 'ru' });
    fireEvent.click(await screen.findByRole('switch', { name: inWords('Включить уведомления') }, LONG));
    // Said under the switch, as part of what it is.
    expect(await screen.findByRole('switch', { name: inWords('Уведомления для этого приложения заблокированы: разреши их в настройках телефона.') }, LONG)).toBeTruthy();
    expect(notices.asked).toBe(0);
  });

  it('leaves the switch off where the account could not keep the token', async () => {
    const { note } = show({ over: { notifyMe: async () => false } });
    const toggle = await weekly();
    fireEvent.click(toggle);
    await waitFor(() => expect(notices.asked).toBe(1));
    await settle();
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(note.now).not.toBe('on');
    expect(market()).toBeNull();
  });

  it('turns off: the account forgets the phone, and the market\'s switch goes', async () => {
    notices.status = 'granted';
    const note = memoryNote('on');
    const { asked } = show({ note });
    const toggle = await weekly();
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(await screen.findByRole('switch', { name: /Tell me when my market moves/ })).toBeTruthy();
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('false'));
    expect(asked).toContain(`stop ${TOKEN}`);
    expect(note.now).toBe('off');
    expect(market()).toBeNull();
    // Turned off, it is not shown as on at the next start.
    cleanup();
    show({ note });
    expect((await weekly()).getAttribute('aria-checked')).toBe('false');
  });

  it('shows the switch off where the phone no longer lets the app notify, whatever was noted', async () => {
    notices.status = 'denied';
    notices.canAskAgain = false;
    show({ note: memoryNote('on') });
    expect((await weekly()).getAttribute('aria-checked')).toBe('false');
    expect(market()).toBeNull();
  });

  it.each([
    ['en', 'Tell me when my market moves'],
    ['es', 'Avisarme si se mueve mi mercado'],
    ['ru', 'Сообщать, если мой рынок сдвинулся'],
  ] as const)('lets the player turn the market notice on and off on its own, in %s', async (locale, label) => {
    notices.status = 'granted';
    const { asked } = show({ note: memoryNote('on'), locale });
    const toggle = await screen.findByRole('switch', { name: inWords(label) }, LONG);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
    expect(asked).toEqual([`read ${TOKEN}`, `set ${TOKEN} true`]);
  });

  it('keeps the market\'s switch where it was if the change could not be kept, and shows none until the server says', async () => {
    notices.status = 'granted';
    show({ note: memoryNote('on'), over: { marketNotice: async () => true, setMarketNotice: async () => false } });
    const toggle = await screen.findByRole('switch', { name: /Tell me when my market moves/ });
    fireEvent.click(toggle);
    await settle();
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    cleanup();
    show({ note: memoryNote('on'), over: { marketNotice: async () => null } });
    await weekly();
    await settle();
    expect(market()).toBeNull();
  });

  describe('hides what cannot be used: no switch where the phone cannot be told', () => {
    it('with no Expo project in the build', async () => {
      vi.stubEnv('EXPO_PUBLIC_EAS_PROJECT_ID', '');
      const { push } = show();
      expect(await push.pushOn()).toBe('unavailable');
      await settle();
      expect(screen.queryByRole('switch', { name: /Turn on notifications/ })).toBeNull();
      expect(notices.asked).toBe(0);
    });

    it('on a simulator', async () => {
      expoDevice.isDevice = false;
      const { push } = show();
      expect(await push.pushOn()).toBe('unavailable');
      await settle();
      expect(screen.queryByRole('switch', { name: /Turn on notifications/ })).toBeNull();
    });

    it('in Expo Go, which has no remote notices', async () => {
      (expoConstants.default as { executionEnvironment?: string }).executionEnvironment = 'storeClient';
      show();
      await settle();
      expect(screen.queryByRole('switch', { name: /Turn on notifications/ })).toBeNull();
    });

    it('on anything but a phone', async () => {
      show({ platform: 'web' });
      await settle();
      expect(screen.queryByRole('switch', { name: /Turn on notifications/ })).toBeNull();
    });

    it('with nobody signed in', async () => {
      const push = phonePush(memoryNote(), { platform: 'ios' });
      renderGame(<Preferences />, { ...memoryServices(), push }, 'en');
      await settle();
      expect(screen.queryByRole('switch', { name: /Turn on notifications/ })).toBeNull();
    });

    it('where the phone gives no token after all: the switch goes, and nothing is kept', async () => {
      notices.tokenFails = true;
      const { asked, note } = show();
      fireEvent.click(await weekly());
      await waitFor(() => expect(screen.queryByRole('switch', { name: /Turn on notifications/ })).toBeNull());
      expect(asked).toEqual([]);
      expect(note.now).not.toBe('on');
    });
  });
});
