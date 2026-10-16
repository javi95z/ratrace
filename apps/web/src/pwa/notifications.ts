/**
 * The weekly notice, on the device's side: whether this browser can be told at all, and asking the
 * player and the browser for a subscription, or giving it up. Where it is kept is the account's to
 * say; this only speaks to the browser.
 */

/** The public half of the game's VAPID keys, which push services check the notice against. Unset, there are no notices. */
export const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

/** A subscription as the server keeps it. */
export interface PushKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** True where this browser can show a notice sent while the game is closed, and the game has keys to send one. */
export function canNotify(): boolean {
  return VAPID_KEY !== '' && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** The bytes of a key written in URL-safe base64, as the browser wants it. */
export function keyBytes(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** A subscription in the three strings the server keeps. Null for one without its keys. */
export function keysOf(subscription: Pick<PushSubscription, 'toJSON'>): PushKeys | null {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  return json.endpoint && p256dh && auth ? { endpoint: json.endpoint, p256dh, auth } : null;
}

/** The subscription this browser holds now, or null. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!canNotify()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/**
 * Asks the player, then the browser, for a subscription. Null if either says no, or the browser
 * cannot: the player's no is final until they change it in the browser.
 */
export async function subscribe(): Promise<PushKeys | null> {
  if (!canNotify()) return null;
  if ((await Notification.requestPermission()) !== 'granted') return null;
  const registration = await navigator.serviceWorker.ready;
  const subscription = (await registration.pushManager.getSubscription()) ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_KEY) as BufferSource }));
  return keysOf(subscription);
}

/** Gives up the subscription of this browser, and says which it was so the server can forget it too. */
export async function unsubscribe(): Promise<string | null> {
  const subscription = await currentSubscription();
  if (!subscription) return null;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  return endpoint;
}
