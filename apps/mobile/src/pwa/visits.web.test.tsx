// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Counted, Track } from '../game/events';

/*
 * The web export's counting of visits and events by Vercel Web Analytics (visits.web.tsx), the Next web's (`apps/web/src/pwa/Visits.tsx`,
 * `events.ts`'s `toVercel`): the address without its query, so an invitation's code is never counted; the eight events through Vercel's `track`,
 * in production only, and never in the way of the game.
 */

const analytics = vi.hoisted(() => ({ props: null as null | { beforeSend: (event: { type: string; url: string }) => { type: string; url: string } | null }, mounted: 0 }));
const vercel = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@vercel/analytics/react', () => ({
  Analytics: (props: NonNullable<typeof analytics.props>) => {
    analytics.props = props;
    analytics.mounted += 1;
    return null;
  },
  track: (...args: unknown[]) => vercel.track(...args),
}));

import { alsoToVercel, Visits } from './visits';

afterEach(() => {
  cleanup();
  analytics.props = null;
  analytics.mounted = 0;
  vercel.track.mockReset();
});

const ended: Counted = { name: 'life_end', mode: 'ranked', escaped: true };

describe('visits counted by Vercel', () => {
  it('counts the page without its query: an invitation\'s code is nobody\'s to count', () => {
    render(<Visits production />);
    expect(analytics.mounted).toBe(1);
    const send = analytics.props!.beforeSend;
    expect(send({ type: 'pageview', url: 'https://theratrace.com/en/room?code=ABCD' })).toEqual({ type: 'pageview', url: 'https://theratrace.com/en/room' });
    expect(send({ type: 'event', url: 'https://theratrace.com/es/rankings?x=1&y=2#friends' })).toEqual({ type: 'event', url: 'https://theratrace.com/es/rankings' });
    // An address with no query is as it was.
    expect(send({ type: 'pageview', url: 'https://theratrace.com/ru' })).toEqual({ type: 'pageview', url: 'https://theratrace.com/ru' });
  });

  it('counts nothing outside a production build', () => {
    render(<Visits production={false} />);
    expect(analytics.mounted).toBe(0);
    // A test is not a production build either.
    render(<Visits />);
    expect(analytics.mounted).toBe(0);
  });
});

describe('the eight events counted by Vercel', () => {
  it('reach Vercel\'s track with their name and what they say, in production, and the game\'s own sender too', () => {
    const own = vi.fn();
    const track: Track = alsoToVercel(own, true);
    track(ended);
    track({ name: 'challenge_attempt' });
    expect(own).toHaveBeenNthCalledWith(1, ended);
    expect(own).toHaveBeenNthCalledWith(2, { name: 'challenge_attempt' });
    expect(vercel.track).toHaveBeenNthCalledWith(1, 'life_end', { mode: 'ranked', escaped: true });
    expect(vercel.track).toHaveBeenNthCalledWith(2, 'challenge_attempt', {});
  });

  it('reach only the game\'s own sender outside production', () => {
    const own = vi.fn();
    alsoToVercel(own, false)(ended);
    alsoToVercel(own)(ended);
    expect(own).toHaveBeenCalledTimes(2);
    expect(vercel.track).not.toHaveBeenCalled();
  });

  it('a count Vercel cannot take is no failure of anything, and the game\'s own is still sent', () => {
    vercel.track.mockImplementation(() => {
      throw new Error('blocked');
    });
    const own = vi.fn();
    expect(() => alsoToVercel(own, true)(ended)).not.toThrow();
    expect(own).toHaveBeenCalledTimes(1);
  });
});
