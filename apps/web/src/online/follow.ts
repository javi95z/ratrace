import type { Account } from './types';

/** What the page tells of itself. The browser's own in the game; a test's in a test. */
export interface Page {
  /** Calls `listener` when the connection comes back. Returns how to stop. */
  onOnline(listener: () => void): () => void;
  /** Calls `listener` when the page comes back to the front. Returns how to stop. */
  onShown(listener: () => void): () => void;
  now(): number;
}

/** How long the account is not read again just because the page came back to the front. */
const NOT_AGAIN_FOR = 60_000;

/**
 * Has the account's copy read at the moments it may have changed without this page knowing:
 * someone is signed in, or someone else is; the connection is back; the page is looked at again
 * after a while, perhaps after playing on another device. At those last two, if nobody is signed
 * in, it is the signing in that is tried again. Returns how to stop.
 */
export function follow(
  account: Pick<Account, 'state' | 'subscribe'> & { again(): Promise<void> },
  mirror: { sync(): Promise<void>; accountChanged(): Promise<void> },
  page: Page,
): () => void {
  const who = (): string | null => {
    const state = account.state();
    return state.kind === 'offline' ? null : state.userId;
  };
  let player: string | null = null;
  let last = Number.NEGATIVE_INFINITY;
  const read = (how: () => Promise<void>) => {
    last = page.now();
    void how();
  };
  const look = () => {
    const now = who();
    if (now === player) return;
    player = now;
    read(mirror.accountChanged);
  };

  // With nobody signed in there is no account to read: the thing to try again is signing in. A page
  // opened with no connection is signed out, and would stay so until it was opened anew.
  const again = () => read(who() === null ? account.again : mirror.sync);

  look();
  const stops = [
    account.subscribe(look),
    page.onOnline(again),
    page.onShown(() => {
      if (page.now() - last >= NOT_AGAIN_FOR) again();
    }),
  ];
  return () => {
    for (const stop of stops) stop();
  };
}
