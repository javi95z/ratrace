import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Track } from '../game/events';
import { alsoToVercel, Visits } from './visits';

/* The phone counts no visits (it is an app, not a site) and its events go where they went: visits.web.tsx is tested beside this. */

describe('visits on the phone', () => {
  it('draws nothing', () => {
    expect(renderToString(<Visits />)).toBe('');
  });

  it('leaves the events where they go: the very same sender', () => {
    const track: Track = vi.fn();
    expect(alsoToVercel(track)).toBe(track);
  });
});
