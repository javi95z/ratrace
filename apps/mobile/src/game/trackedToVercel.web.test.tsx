// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { forgetTheGame, GameProvider, useTrack } from './context';

/*
 * The game as the web starts it (no services handed in): what a screen counts reaches the game's own sender (online/track.ts) and Vercel's `track`
 * (pwa/visits.web.tsx), once each, in a production build.
 */

const own = vi.hoisted(() => vi.fn());
const vercel = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('../online/track', () => ({ phoneTrack: () => own }));
vi.mock('@vercel/analytics/react', () => ({ Analytics: () => null, track: (...args: unknown[]) => vercel.track(...args) }));

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
});
afterEach(() => {
  cleanup();
  forgetTheGame();
  vi.unstubAllEnvs();
  own.mockReset();
  vercel.track.mockReset();
});

/** A screen that counts a life's end as soon as it is drawn. */
function Ends() {
  const track = useTrack();
  useEffect(() => track({ name: 'life_end', mode: 'solo', escaped: false }), [track]);
  return null;
}

it('an event counted by a screen reaches the game\'s own sender and Vercel, once each', () => {
  render(
    <GameProvider>
      <Ends />
    </GameProvider>,
  );
  expect(own).toHaveBeenCalledTimes(1);
  expect(own).toHaveBeenCalledWith({ name: 'life_end', mode: 'solo', escaped: false });
  expect(vercel.track).toHaveBeenCalledTimes(1);
  expect(vercel.track).toHaveBeenCalledWith('life_end', { mode: 'solo', escaped: false });
});
