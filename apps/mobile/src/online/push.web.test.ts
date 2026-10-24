// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import type { Account, Community } from '@ratrace/online/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { phonePush } from './push.web';
import type { PushNoted } from './push.web';

/*
 * The game's notices on the web (push.web.ts): the browser's own push subscription, as the Next web's (apps/web/src/pwa/notifications.ts) takes it.
 * jsdom has no worker, no push manager and no permission to ask: each test builds the browser it needs (`browser`) and gives the account a stand-in.
 */

/** A file of the app, as written: its name passed loose, since Vite takes a literal `new URL('./x', import.meta.url)` for an asset. */
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

/** The public half of a VAPID key as the Next web's settings write it: 65 bytes in URL-safe base64. */
const KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const ENDPOINT = 'https://push.example/send/abc123';
const KEYS = { endpoint: ENDPOINT, p256dh: 'p256dh-key', auth: 'auth-secret' };

/** A subscription as the browser gives it: its address and keys, and giving it up. */
function subscription(keys: { endpoint: string; p256dh?: string; auth?: string } = KEYS) {
  return {
    endpoint: keys.endpoint,
    toJSON: () => ({ endpoint: keys.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } }),
    unsubscribe: vi.fn(async () => true),
  };
}

/** What the browser holds, and how it answers: the permission (and what the player answers when asked), the subscription, the worker's push manager. */
interface Browser {
  permission: NotificationPermission;
  answer: NotificationPermission;
  held: ReturnType<typeof subscription> | null;
  subscribed: Array<{ userVisibleOnly: boolean; applicationServerKey: Uint8Array }>;
  asked: number;
  /** What the browser makes of a new subscription. */
  made: ReturnType<typeof subscription>;
}

/** Gives the page the pieces of a browser that can be told (a worker, a push manager, notices), and says what they are doing. */
function browser(over: Partial<Browser> = {}, pieces: { worker?: boolean; manager?: boolean; notices?: boolean } = {}): Browser {
  const now: Browser = { permission: 'default', answer: 'granted', held: null, subscribed: [], asked: 0, made: subscription(), ...over };
  const registration = {
    pushManager: {
      getSubscription: vi.fn(async () => now.held),
      subscribe: vi.fn(async (options: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }) => {
        now.subscribed.push(options);
        now.held = now.made;
        return now.made;
      }),
    },
  };
  if (pieces.worker !== false) {
    Object.defineProperty(navigator, 'serviceWorker', { value: { getRegistration: async () => registration, ready: Promise.resolve(registration) }, configurable: true });
  }
  if (pieces.manager !== false) Object.defineProperty(window, 'PushManager', { value: class {}, configurable: true });
  if (pieces.notices !== false) {
    const notification = {
      get permission() {
        return now.permission;
      },
      requestPermission: vi.fn(async () => {
        now.asked += 1;
        if (now.permission === 'default') now.permission = now.answer;
        return now.permission;
      }),
    };
    Object.defineProperty(window, 'Notification', { value: notification, configurable: true });
    Object.defineProperty(globalThis, 'Notification', { value: notification, configurable: true });
  }
  return now;
}

beforeEach(() => {
  vi.stubEnv('EXPO_PUBLIC_VAPID_PUBLIC_KEY', KEY);
});
afterEach(() => {
  vi.unstubAllEnvs();
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
  delete (window as { PushManager?: unknown }).PushManager;
  delete (window as { Notification?: unknown }).Notification;
  delete (globalThis as { Notification?: unknown }).Notification;
});

/** The note the app keeps: the browser keeps the notices itself, so the web never reads or writes it. */
function noted() {
  const note = { read: vi.fn((): PushNoted | null => null), write: vi.fn() };
  return note;
}

function community(over: Partial<Community> = {}) {
  return { notifyMe: vi.fn(async () => true), stopNotifying: vi.fn(async () => true), marketNotice: vi.fn(async () => false), setMarketNotice: vi.fn(async () => true), ...over } as unknown as Community & {
    notifyMe: ReturnType<typeof vi.fn>;
    stopNotifying: ReturnType<typeof vi.fn>;
  };
}

describe('the notices on the web', () => {
  it('are offered where the browser can show one with the game closed, and the game has its key', () => {
    browser();
    const push = phonePush(noted());
    expect(push.available()).toBe(true);
    // No key: none (as the Next web).
    vi.stubEnv('EXPO_PUBLIC_VAPID_PUBLIC_KEY', '');
    expect(push.available()).toBe(false);
  });

  it.each([
    ['a worker', { worker: false }],
    ['a push manager', { manager: false }],
    ['notices', { notices: false }],
  ])('are not offered by a browser with no %s: nothing to switch on, nothing asked', async (_name, pieces) => {
    browser({}, pieces);
    const push = phonePush(noted());
    const account = community();
    expect(push.available()).toBe(false);
    await expect(push.isOn()).resolves.toBe(false);
    await expect(push.pushOn()).resolves.toBe('unavailable');
    await expect(push.register(account, 'en')).resolves.toBe(false);
    await expect(push.target()).resolves.toBeNull();
    expect(account.notifyMe).not.toHaveBeenCalled();
  });

  it('are on while the browser holds a subscription', async () => {
    const now = browser();
    const push = phonePush(noted());
    await expect(push.isOn()).resolves.toBe(false);
    now.held = subscription();
    await expect(push.isOn()).resolves.toBe(true);
  });

  it('turn on by asking the player, subscribing through the worker with the game\'s key, and telling the account the three strings in the page\'s language', async () => {
    const now = browser();
    const push = phonePush(noted());
    const account = community();
    await expect(push.pushOn()).resolves.toBe('on');
    expect(now.asked).toBe(1);
    expect(now.subscribed).toHaveLength(1);
    expect(now.subscribed[0].userVisibleOnly).toBe(true);
    expect([...now.subscribed[0].applicationServerKey]).toEqual([...Buffer.from(KEY.replace(/-/g, '+').replace(/_/g, '/') + '=', 'base64')]);
    // Nothing is told to the account until the screen says so, in its language.
    expect(account.notifyMe).not.toHaveBeenCalled();
    await expect(push.register(account, 'es')).resolves.toBe(true);
    expect(account.notifyMe).toHaveBeenCalledWith(KEYS, 'es');
    await expect(push.isOn()).resolves.toBe(true);
  });

  it('say whether the account kept them', async () => {
    browser();
    const push = phonePush(noted());
    await push.pushOn();
    await expect(push.register(community({ notifyMe: vi.fn(async () => false) }), 'en')).resolves.toBe(false);
  });

  it('keep the subscription the browser already has, and ask it for none other', async () => {
    const now = browser({ permission: 'granted', held: subscription({ endpoint: 'https://push.example/send/old', p256dh: 'old-p', auth: 'old-a' }) });
    const push = phonePush(noted());
    const account = community();
    await expect(push.pushOn()).resolves.toBe('on');
    expect(now.subscribed).toEqual([]);
    await push.register(account, 'ru');
    expect(account.notifyMe).toHaveBeenCalledWith({ endpoint: 'https://push.example/send/old', p256dh: 'old-p', auth: 'old-a' }, 'ru');
  });

  it('are refused where the player said no, now or before, and the account hears nothing', async () => {
    const now = browser({ answer: 'denied' });
    const push = phonePush(noted());
    const account = community();
    await expect(push.pushOn()).resolves.toBe('refused');
    expect(now.subscribed).toEqual([]);
    await expect(push.register(account, 'en')).resolves.toBe(false);
    expect(account.notifyMe).not.toHaveBeenCalled();
    // Blocked in the browser from before: it asks nothing of the player, and the answer is the same.
    now.asked = 0;
    await expect(push.pushOn()).resolves.toBe('refused');
    await expect(push.isOn()).resolves.toBe(false);
  });

  it('are neither refused nor on where the player only closed the question: nothing is held, so nothing is told', async () => {
    const now = browser({ answer: 'default' });
    const push = phonePush(noted());
    const account = community();
    // Not a refusal (the browser asks again next time), and no subscription made.
    await expect(push.pushOn()).resolves.toBe('on');
    expect(now.subscribed).toEqual([]);
    await expect(push.register(account, 'en')).resolves.toBe(false);
    expect(account.notifyMe).not.toHaveBeenCalled();
  });

  it('answer that they cannot be had where the browser fails to subscribe or gives a subscription without its keys', async () => {
    const now = browser({ permission: 'granted' });
    const push = phonePush(noted());
    now.made = subscription({ endpoint: ENDPOINT });
    await expect(push.pushOn()).resolves.toBe('unavailable');
    const failing = browser({ permission: 'granted' });
    const registration = await navigator.serviceWorker.getRegistration();
    (registration?.pushManager.subscribe as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('push service down'));
    await expect(phonePush(noted()).pushOn()).resolves.toBe('unavailable');
    expect(failing.held).toBeNull();
  });

  it('ask once however many presses come before the browser answers', async () => {
    const now = browser();
    const push = phonePush(noted());
    await Promise.all([push.pushOn(), push.pushOn()]);
    expect(now.asked).toBe(1);
    expect(now.subscribed).toHaveLength(1);
  });

  it('turn off by telling the account to forget the address, then giving the subscription up', async () => {
    const held = subscription();
    browser({ permission: 'granted', held });
    const push = phonePush(noted());
    const account = community();
    await expect(push.pushOff(account)).resolves.toBe(true);
    expect(account.stopNotifying).toHaveBeenCalledWith(ENDPOINT);
    expect(held.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('stay on while the account did not forget them: the subscription is kept, and the switch can try again', async () => {
    const held = subscription();
    browser({ permission: 'granted', held });
    const push = phonePush(noted());
    await expect(push.pushOff(community({ stopNotifying: vi.fn(async () => false) }))).resolves.toBe(false);
    expect(held.unsubscribe).not.toHaveBeenCalled();
    await expect(push.pushOff(community())).resolves.toBe(true);
    expect(held.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('are off already where the browser holds nothing: the account is asked nothing', async () => {
    browser({ permission: 'granted' });
    const account = community();
    await expect(phonePush(noted()).pushOff(account)).resolves.toBe(true);
    expect(account.stopNotifying).not.toHaveBeenCalled();
  });

  it('name the market\'s notice by the subscription\'s address, while they are on', async () => {
    const now = browser({ permission: 'granted' });
    const push = phonePush(noted());
    await expect(push.target()).resolves.toBeNull();
    now.held = subscription();
    await expect(push.target()).resolves.toBe(ENDPOINT);
  });

  it('keep nothing with the app, follow no account and open nothing on a tap (the worker\'s click opens the page)', async () => {
    browser({ permission: 'granted', held: subscription() });
    const note = noted();
    const push = phonePush(note);
    const account = community();
    const open = vi.fn();
    push.follow({} as Account, () => account, 'en')();
    push.onTap(open)();
    push.resume();
    await expect(push.release(account)).resolves.toBeUndefined();
    await push.pushOn();
    await push.register(account, 'en');
    expect(open).not.toHaveBeenCalled();
    expect(note.read).not.toHaveBeenCalled();
    expect(note.write).not.toHaveBeenCalled();
    // Signing out leaves the subscription with the browser: nothing was forgotten.
    expect(account.stopNotifying).not.toHaveBeenCalled();
  });

  it('read no browser where there is none (the page drawn on the build\'s machine): not offered, nothing raised', async () => {
    const push = phonePush(noted());
    vi.stubGlobal('window', undefined);
    try {
      expect(push.available()).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('never name Expo\'s library', () => {
    expect(read('./push.web.ts')).not.toMatch(/expo-notifications|expo-device|expo-constants/);
  });
});
