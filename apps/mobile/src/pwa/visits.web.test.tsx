// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Counted, Track } from '../game/events';
import { pathname } from '../testing/fakes';

/*
 * The web export's counting of visits and events by Vercel Web Analytics (visits.web.tsx), the Next web's (`apps/web/src/pwa/Visits.tsx`,
 * `events.ts`'s `toVercel`): a visit for each page the player is on, a replace included, as the Next entry sends it; the address without its
 * query, so an invitation's code is never counted; the eight events through Vercel's `track`, in production only, and never in the way of the game.
 */

interface Props {
  path: string;
  route: string;
  beforeSend: (event: { type: string; url: string }) => { type: string; url: string } | null;
}
const analytics = vi.hoisted(() => ({ props: [] as unknown[] }));
const vercel = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@vercel/analytics/react', () => ({
  Analytics: (props: unknown) => {
    analytics.props.push(props);
    return null;
  },
  track: (...args: unknown[]) => vercel.track(...args),
}));

import { alsoToVercel, Visits } from './visits';

/** What Analytics was last given. */
const given = () => analytics.props.at(-1) as Props;

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  analytics.props = [];
  vercel.track.mockReset();
});

const ended: Counted = { name: 'life_end', mode: 'ranked', escaped: true };

describe('visits counted by Vercel', () => {
  it('counts the page without its query: an invitation\'s code is nobody\'s to count', () => {
    pathname.now = '/en/room';
    render(<Visits />);
    const send = given().beforeSend;
    expect(send({ type: 'pageview', url: 'https://theratrace.com/en/room?code=ABCD' })).toEqual({ type: 'pageview', url: 'https://theratrace.com/en/room' });
    expect(send({ type: 'event', url: 'https://theratrace.com/es/rankings?x=1&y=2#friends' })).toEqual({ type: 'event', url: 'https://theratrace.com/es/rankings' });
    // An address with no query is as it was.
    expect(send({ type: 'pageview', url: 'https://theratrace.com/ru' })).toEqual({ type: 'pageview', url: 'https://theratrace.com/ru' });
  });

  it('gives the Next entry\'s path and route, and follows the player\'s moves, a replace as well as a push', () => {
    pathname.now = '/en/new';
    const view = render(<Visits />);
    expect(given()).toMatchObject({ path: '/en/new', route: '/[locale]/new' });
    // NewLife replaces itself with the life: the router's address changes, the page is counted anew.
    pathname.now = '/en/play';
    view.rerender(<Visits />);
    expect(given()).toMatchObject({ path: '/en/play', route: '/[locale]/play' });
    // The language switch: the same page in another language is the same route.
    pathname.now = '/es/play';
    view.rerender(<Visits />);
    expect(given()).toMatchObject({ path: '/es/play', route: '/[locale]/play' });
    // The front door is the language alone; an address outside the languages is its own route.
    pathname.now = '/ru';
    view.rerender(<Visits />);
    expect(given()).toMatchObject({ path: '/ru', route: '/[locale]' });
    pathname.now = '/';
    view.rerender(<Visits />);
    expect(given()).toMatchObject({ path: '/', route: '/' });
  });

  it('counts nothing outside a production build', () => {
    vi.stubEnv('NODE_ENV', 'development');
    render(<Visits />);
    expect(analytics.props).toHaveLength(0);
  });
});

describe('the eight events counted by Vercel', () => {
  it('reach Vercel\'s track with their name and what they say, in production, and the game\'s own sender too', () => {
    const own = vi.fn();
    const track: Track = alsoToVercel(own);
    track(ended);
    track({ name: 'challenge_attempt' });
    expect(own).toHaveBeenNthCalledWith(1, ended);
    expect(own).toHaveBeenNthCalledWith(2, { name: 'challenge_attempt' });
    expect(vercel.track).toHaveBeenNthCalledWith(1, 'life_end', { mode: 'ranked', escaped: true });
    expect(vercel.track).toHaveBeenNthCalledWith(2, 'challenge_attempt', {});
  });

  it('reach only the game\'s own sender outside production', () => {
    vi.stubEnv('NODE_ENV', 'test');
    const own = vi.fn();
    alsoToVercel(own)(ended);
    expect(own).toHaveBeenCalledTimes(1);
    expect(vercel.track).not.toHaveBeenCalled();
  });

  it('a count Vercel cannot take is no failure of anything, and the game\'s own is still sent', () => {
    vercel.track.mockImplementation(() => {
      throw new Error('blocked');
    });
    const own = vi.fn();
    expect(() => alsoToVercel(own)(ended)).not.toThrow();
    expect(own).toHaveBeenCalledTimes(1);
  });
});
