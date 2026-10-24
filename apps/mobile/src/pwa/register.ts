import { useEffect } from 'react';

/*
 * The site's service worker, registered by the web (`register.web.ts`, which Metro picks for the web export). The phone has no worker: the app
 * is installed, and keeps its own files.
 */

/** Registers nothing on the phone, and gives back nothing to stop (the web's takes whether the build is a production one). */
export function registerWorker(): () => void {
  return () => undefined;
}

/** Called once by the root layout: nothing on the phone. */
export function useServiceWorker(): void {
  useEffect(() => registerWorker(), []);
}
