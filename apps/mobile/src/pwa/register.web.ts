import { useEffect } from 'react';

/**
 * The web export's twin of `register.ts` (Metro picks it for the web): the site's worker, `/sw.js` (written into the export by
 * `scripts/serviceWorker.ts`), registered as the Next web registers it (`apps/web/src/pwa/runtime.tsx`). A production build alone owns a worker:
 * caching a development build would make its own changes appear stale, and the tests run none. Once the page has loaded, for the whole site, with
 * `updateViaCache: 'none'` so every visit checks the small worker file itself; and back online, it looks for a new one. What it gives back stops
 * both waits.
 */
export function registerWorker(production = process.env.NODE_ENV === 'production'): () => void {
  if (!production || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => undefined;
  let registration: ServiceWorkerRegistration | null = null;
  const register = async () => {
    try {
      registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
    } catch {
      // Installation is an enhancement. A blocked worker must never keep the game from opening.
    }
  };
  if (document.readyState === 'complete') void register();
  else window.addEventListener('load', register, { once: true });

  const update = () => void registration?.update().catch(() => undefined);
  window.addEventListener('online', update);
  return () => {
    window.removeEventListener('load', register);
    window.removeEventListener('online', update);
  };
}

/** Called once by the root layout: the worker registered after the page is drawn in the browser (an effect: never while the build draws it). */
export function useServiceWorker(): void {
  useEffect(() => registerWorker(), []);
}
