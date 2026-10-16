import { describe, expect, it } from 'vitest';
import { ago, listOf, rowsOf } from './errors-list';

const NOW = Date.parse('2026-10-16T12:00:00.000Z');
const row = (over: Record<string, unknown> = {}) => ({ source: 'page', place: '/play', message: 'boom', build: '0.35.0/1.35.0', browser: 'Chrome 140', seen: 3, first_seen: '2026-10-14T12:00:00.000Z', last_seen: '2026-10-16T11:55:00.000Z', ...over });

describe('the list of errors', () => {
  it('says how long ago in the largest unit that fits', () => {
    expect(ago('2026-10-16T11:59:30.000Z', NOW)).toBe('30s');
    expect(ago('2026-10-16T11:55:00.000Z', NOW)).toBe('5m');
    expect(ago('2026-10-16T09:00:00.000Z', NOW)).toBe('3h');
    expect(ago('2026-10-14T12:00:00.000Z', NOW)).toBe('2d');
  });

  it('puts the latest first, with where, how often, since when and what it said', () => {
    const lines = listOf([row({ message: 'older', last_seen: '2026-10-16T09:00:00.000Z' }), row({ source: 'function', place: 'ranked', message: 'answered 500:\n server', build: null, browser: null })], NOW);
    expect(lines).toEqual([
      '  5m ago  ×3     function ranked  (first 2d ago)',
      '           answered 500: server',
      '  3h ago  ×3     page     /play  (first 2d ago, 0.35.0/1.35.0, Chrome 140)',
      '           older',
    ]);
    expect(listOf([], NOW)).toEqual(['No errors kept.']);
  });

  it('reads the rows the database printed, and nothing that is not them', () => {
    expect(rowsOf('Initialising...\n{"rows":[{"source":"page"}],"warning":"untrusted"}')).toEqual([{ source: 'page' }]);
    expect(rowsOf('no json here')).toBeNull();
    expect(rowsOf('{"message":"no rows"}')).toBeNull();
  });
});
