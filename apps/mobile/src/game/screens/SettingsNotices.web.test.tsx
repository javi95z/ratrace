// @vitest-environment jsdom
import type { Community } from '@ratrace/online/types';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { phonePush } from '../../online/push';
import { memoryServices, renderGame } from '../../testing/render';
import { Preferences } from './Settings';

/*
 * The notices in Settings, on the web export: the same screen, through the same `Push`, over the browser's own push subscription (online/push.web.ts),
 * in the Next web's words. The browser is a stand-in: a worker whose push manager holds the subscription, and a permission the player answers.
 */

const KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const ENDPOINT = 'https://push.example/send/abc123';

const browser = { permission: 'default' as NotificationPermission, answer: 'granted' as NotificationPermission, held: null as null | { endpoint: string; toJSON: () => object; unsubscribe: () => Promise<boolean> } };

beforeEach(() => {
  vi.stubEnv('EXPO_PUBLIC_VAPID_PUBLIC_KEY', KEY);
  browser.permission = 'default';
  browser.answer = 'granted';
  browser.held = null;
  const made = { endpoint: ENDPOINT, toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: 'p', auth: 'a' } }), unsubscribe: vi.fn(async () => {
      browser.held = null;
      return true;
    }) };
  const registration = {
    pushManager: { getSubscription: async () => browser.held, subscribe: async () => (browser.held = made) },
  };
  Object.defineProperty(navigator, 'serviceWorker', { value: { getRegistration: async () => registration, ready: Promise.resolve(registration) }, configurable: true });
  Object.defineProperty(window, 'PushManager', { value: class {}, configurable: true });
  Object.defineProperty(window, 'Notification', {
    value: {
      get permission() {
        return browser.permission;
      },
      requestPermission: async () => (browser.permission === 'default' ? (browser.permission = browser.answer) : browser.permission),
    },
    configurable: true,
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
  delete (window as { PushManager?: unknown }).PushManager;
  delete (window as { Notification?: unknown }).Notification;
});

function community() {
  const asked: string[] = [];
  const all = {
    me: async () => null,
    notifyMe: async (keys: { endpoint: string; p256dh: string; auth: string }, locale: string) => (asked.push(`notify ${keys.endpoint} ${keys.p256dh} ${keys.auth} ${locale}`), true),
    stopNotifying: async (target: string) => (asked.push(`stop ${target}`), true),
    marketNotice: async (target: string) => (asked.push(`read ${target}`), false),
    setMarketNotice: async (target: string, on: boolean) => (asked.push(`set ${target} ${on}`), true),
  } as unknown as Community;
  return { all, asked };
}

function show(locale: 'en' | 'es' | 'ru' = 'en') {
  const { all, asked } = community();
  renderGame(<Preferences />, { ...memoryServices(), community: () => all, push: phonePush({ read: () => null, write: () => undefined }) }, locale);
  return asked;
}

const LONG = { timeout: 10_000 };
const weekly = () => screen.findByRole('switch', { name: /Turn on notifications/ }, LONG);

describe('the notices in Settings, on the web', () => {
  it('offers the switch only where the browser can be told and the game has its key', async () => {
    vi.stubEnv('EXPO_PUBLIC_VAPID_PUBLIC_KEY', '');
    show();
    await screen.findByRole('switch', { name: /Sound/ }, LONG);
    await new Promise((done) => setTimeout(done, 50));
    expect(screen.queryByRole('switch', { name: /Turn on notifications/ })).toBeNull();
  });

  it('turns them on with the browser\'s subscription in the page\'s language, offers the market\'s own switch by its address, and turns them off', async () => {
    const asked = show('es');
    const toggle = await screen.findByRole('switch', { name: /Activar notificaciones/ }, LONG);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
    expect(asked[0]).toBe(`notify ${ENDPOINT} p a es`);
    const market = await screen.findByRole('switch', { name: /Avisarme si se mueve mi mercado/ });
    expect(asked).toContain(`read ${ENDPOINT}`);
    fireEvent.click(market);
    await waitFor(() => expect(asked).toContain(`set ${ENDPOINT} true`));
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('false'));
    expect(asked).toContain(`stop ${ENDPOINT}`);
    expect(browser.held).toBeNull();
    expect(screen.queryByRole('switch', { name: /Avisarme si se mueve mi mercado/ })).toBeNull();
  });

  it('starts on where the browser already holds the subscription (a player who turned them on in the Next web)', async () => {
    browser.permission = 'granted';
    browser.held = { endpoint: ENDPOINT, toJSON: () => ({}), unsubscribe: async () => true };
    const asked = show();
    const toggle = await weekly();
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    await screen.findByRole('switch', { name: /Tell me when my market moves/ });
    expect(asked).toEqual([`read ${ENDPOINT}`]);
  });

  it('says in the Next web\'s words that the browser blocks them, and leaves the switch off', async () => {
    browser.answer = 'denied';
    const asked = show();
    const toggle = await weekly();
    fireEvent.click(toggle);
    expect(await screen.findByText('Notices are blocked for this site: allow them in your browser\'s settings.')).toBeTruthy();
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(asked).toEqual([]);
  });

  it('leaves the switch off, and says nothing, where the player only closed the question', async () => {
    browser.answer = 'default';
    const asked = show();
    const toggle = await weekly();
    fireEvent.click(toggle);
    await new Promise((done) => setTimeout(done, 50));
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByText(/blocked/)).toBeNull();
    expect(asked).toEqual([]);
  });
});
