import { describe, expect, it } from 'vitest';
import { mayBeStale } from '../../../supabase/functions/_shared/rooms.ts';
import type { RoomRow } from '../../../supabase/functions/_shared/rooms.ts';

const NOW = new Date('2026-10-17T12:00:00Z');
const DAY = 86_400_000;
const room = (over: Partial<RoomRow>): RoomRow => ({
  id: 'r', code: 'ABCD', host: 'h', life_id: 'nurse', engine_version: 'e', content_version: 'c', seconds: 90,
  status: 'playing', round: 0, deadline: NOW.toISOString(), created_at: NOW.toISOString(), rematch: null, rematch_of: null, ...over,
} as RoomRow);
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe('which rooms may have gone quiet', () => {
  it('asks the database about a lobby or a round left a day', () => {
    expect(mayBeStale(room({ status: 'open', created_at: ago(DAY + 1) }), NOW)).toBe(true);
    expect(mayBeStale(room({ deadline: ago(DAY + 1) }), NOW)).toBe(true);
  });

  it('does not for one moved within the day, or not open at all', () => {
    expect(mayBeStale(room({ status: 'open', created_at: ago(DAY - 1000) }), NOW)).toBe(false);
    expect(mayBeStale(room({ deadline: ago(DAY - 1000) }), NOW)).toBe(false);
    expect(mayBeStale(room({ deadline: null }), NOW)).toBe(false);
    expect(mayBeStale(room({ status: 'finished', deadline: ago(10 * DAY) }), NOW)).toBe(false);
  });

  it('waits three rounds when three rounds are longer than a day', () => {
    const slow = { seconds: 86_400 };
    expect(mayBeStale(room({ ...slow, deadline: ago(2 * DAY) }), NOW)).toBe(false);
    expect(mayBeStale(room({ ...slow, deadline: ago(3 * DAY + 1) }), NOW)).toBe(true);
  });
});
