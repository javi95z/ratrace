import { describe, expect, it } from 'vitest';
import { allowed, LIMITS } from '../../../supabase/functions/_shared/rate.ts';
import type { Counter } from '../../../supabase/functions/_shared/rate.ts';

/** The database's counter, answering as told and remembering what it was asked. */
function counter(answer: { data: unknown; error: { message: string } | null }) {
  const asked: unknown[] = [];
  const db: Counter = {
    rpc: async (name, args) => {
      asked.push([name, args]);
      return answer;
    },
  };
  return { db, asked };
}

describe('counting calls', () => {
  it('asks the database to count each kind of call for the player, with that kind\'s own limit', async () => {
    const { db, asked } = counter({ data: true, error: null });
    expect(await allowed(db, 'user-1', 'ranked-step')).toBe(true);
    expect(await allowed(db, 'user-1', 'ranked-start')).toBe(true);
    expect(asked).toEqual([
      ['take_rate', { who: 'user-1', what: 'ranked-step', at_most: 240, per_seconds: 60 }],
      ['take_rate', { who: 'user-1', what: 'ranked-start', at_most: 20, per_seconds: 3600 }],
    ]);
  });

  it('says no when the database says the call is one too many, and only yes to a plain yes', async () => {
    expect(await allowed(counter({ data: false, error: null }).db, 'u', 'engine')).toBe(false);
    expect(await allowed(counter({ data: null, error: null }).db, 'u', 'engine')).toBe(false);
    expect(await allowed(counter({ data: 'true', error: null }).db, 'u', 'engine')).toBe(false);
  });

  it('fails, instead of letting everything through, when the calls cannot be counted', async () => {
    await expect(allowed(counter({ data: null, error: { message: 'the database is away' } }).db, 'u', 'finish')).rejects.toThrow('the database is away');
  });

  it('lets a whole life be played at a brisk pace, and the lives of a first sync be finished', () => {
    // About a hundred steps in a life; a first sync asks for five finished lives every five seconds.
    expect(LIMITS['ranked-step'][0]).toBeGreaterThanOrEqual(200);
    expect(LIMITS.finish[0] / LIMITS.finish[1]).toBeGreaterThanOrEqual(5 / 5 / 2);
  });
});
