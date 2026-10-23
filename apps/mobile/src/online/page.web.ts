import type { Page } from '@ratrace/online/follow';

/*
 * The web export's twin of `page.ts` (Metro picks it for the web): what the browser tells the account of the page, the Next web's `browserPage`
 * (apps/web/src/online/index.ts) word for word, after which `follow` has the account read again; and whether there is a connection, as the Next web
 * reads it (`navigator.onLine`, the window's `online` and `offline`).
 */

/** What the browser tells of the page. */
export const phonePage: Page = {
  onOnline: (listener) => {
    window.addEventListener('online', listener);
    return () => window.removeEventListener('online', listener);
  },
  onShown: (listener) => {
    const shown = () => {
      if (document.visibilityState === 'visible') listener();
    };
    document.addEventListener('visibilitychange', shown);
    return () => document.removeEventListener('visibilitychange', shown);
  },
  now: () => Date.now(),
};

/** Whether the browser has a connection now, and every change of it, as the Next web's `useRanking` reads them. */
export const phoneConnection = {
  connected: (): boolean => navigator.onLine,
  subscribe(listener: () => void): () => void {
    window.addEventListener('online', listener);
    window.addEventListener('offline', listener);
    return () => {
      window.removeEventListener('online', listener);
      window.removeEventListener('offline', listener);
    };
  },
};

/** For the tests' stand-ins only (`resetFakes`): the browser keeps nothing of its own here to forget. */
export function forgetConnection(): void {}

/** Tells `set` whether the page is in front (visible): at once, and again each time that changes. Returns how to stop. */
export function whileActive(set: (active: boolean) => void): () => void {
  let active = document.visibilityState === 'visible';
  set(active);
  const changed = () => {
    const now = document.visibilityState === 'visible';
    if (now === active) return;
    active = now;
    set(now);
  };
  document.addEventListener('visibilitychange', changed);
  return () => document.removeEventListener('visibilitychange', changed);
}
