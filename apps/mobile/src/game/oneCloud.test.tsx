// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { forgetThePhone } from '../online';
import { place } from '../online/errors';
import { servers } from '../testing/cloudServers';
import { appState, pathname } from '../testing/fakes';
import { GameProvider, useAccount } from './context';

/*
 * The game as the app starts it, with no services handed in: over the phone's own cloud (`phoneServices`, `phoneOnline`), in a build with a project
 * and its errors watched (a release build), the network a stand-in (`testing/cloudServers.ts`). The cloud is made once for the whole start of the
 * app: signing out starts the game again over it, and never makes a second one, with a second renewal of the session or a second watch of the errors.
 */

afterEach(() => {
  cleanup();
  forgetThePhone();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** React Native's handler of the errors nobody caught, counting who put one in its place. */
function errorUtils() {
  const handlers: Array<(error: unknown, isFatal?: boolean) => void> = [];
  let handler: (error: unknown, isFatal?: boolean) => void = () => undefined;
  return {
    handlers,
    utils: {
      getGlobalHandler: () => handler,
      setGlobalHandler: (next: typeof handler) => {
        handlers.push(next);
        handler = next;
      },
    },
  };
}

it('makes one cloud for the start of the app: signing out and drawing the game again leave one renewal of the session and one watch of the errors', async () => {
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://abcdefghijklmnop.supabase.co');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_x');
  vi.stubEnv('NODE_ENV', 'production');
  const cloud = servers();
  vi.stubGlobal('fetch', cloud.fetch);
  const errors = errorUtils();
  vi.stubGlobal('ErrorUtils', errors.utils);
  pathname.now = '/player';

  const seen: { account?: ReturnType<typeof useAccount> } = {};
  function Probe() {
    seen.account = useAccount();
    return null;
  }
  const first = render(
    <GameProvider>
      <Probe />
    </GameProvider>,
  );
  await waitFor(() => expect(seen.account?.state).toEqual({ kind: 'guest', userId: 'guest-1', notice: null }));
  // The reports of what goes wrong say the screen in front, heard by the provider round every screen.
  expect(place()).toBe('/player');
  const listening = appState.listeners.size;
  expect(errors.handlers).toHaveLength(1);

  // Signed out: the game starts again, a new guest with it, on the same cloud.
  await act(async () => expect(await seen.account!.signOut()).toBe(true));
  await waitFor(() => expect(seen.account?.state).toEqual({ kind: 'guest', userId: 'guest-2', notice: null }));
  expect(appState.listeners.size).toBe(listening);
  expect(errors.handlers).toHaveLength(1);

  // The game drawn again from the top (the layout above it, say): the same game, the same cloud.
  first.unmount();
  render(
    <GameProvider>
      <Probe />
    </GameProvider>,
  );
  await waitFor(() => expect(seen.account?.state.kind).toBe('guest'));
  expect(appState.listeners.size).toBe(listening);
  expect(errors.handlers).toHaveLength(1);
  expect(cloud.guests()).toBe(2);
});
