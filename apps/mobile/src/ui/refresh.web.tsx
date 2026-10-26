import type { ReactElement } from 'react';

/** The least time the spinner is shown once pulled (the phone's, `refresh.tsx`). */
export const REFRESH_AT_LEAST_MS = 450;

/** Nothing on the web: a browser has its own pull to reload, and a page is read again by being opened again (the phone's is `refresh.tsx`). */
export function usePullRefresh(): ReactElement | undefined {
  return undefined;
}
