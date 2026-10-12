'use client';

import { useSyncExternalStore } from 'react';

/** The width from which the game sits in three columns. The same as the `desk` breakpoint of the stylesheet. */
const DESK = '(min-width: 64rem)';

const media = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(DESK) : null);

function subscribe(notify: () => void): () => void {
  const query = media();
  query?.addEventListener('change', notify);
  return () => query?.removeEventListener('change', notify);
}

/**
 * True on a screen wide enough for three columns. It is false while the page is first drawn, on
 * the server and in the browser alike, so the two never disagree; the game only draws after that.
 */
export function useIsDesk(): boolean {
  return useSyncExternalStore(subscribe, () => media()?.matches ?? false, () => false);
}
