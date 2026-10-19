import { describe, expect, it } from 'vitest';
import { daysAsked, daysSql, DEFAULT_DAYS, share, statsLines, TOTAL_SQL } from './stats-list';
import type { DayRow } from './stats-list';

const day = (over: Partial<DayRow> = {}): DayRow => ({
  day: '2026-10-19', new_players: 5, new_kept: 1, active: 7, begun_casual: 9, begun_ranked: 2, begun_room: 4, finished: 6,
  back_d1: null, back_d7: null, games_friends: 1, games_quick: 3, games_slow: 0, ...over,
});

describe('the usage numbers', () => {
  it('shows two weeks unless told otherwise, and never more than ninety days', () => {
    expect(daysAsked([])).toBe(DEFAULT_DAYS);
    expect(daysAsked(['30'])).toBe(30);
    expect(daysAsked(['--', '7'])).toBe(7);
    expect(daysAsked(['0'])).toBe(DEFAULT_DAYS);
    expect(daysAsked(['5000'])).toBe(90);
    expect(daysAsked(['lots'])).toBe(DEFAULT_DAYS);
  });

  it('asks for exactly the days wanted, and counts no rat anywhere', () => {
    expect(daysSql(7)).toContain('generate_series(0, 6)');
    expect(daysSql(500)).toContain('generate_series(0, 89)');
    for (const sql of [daysSql(14), TOTAL_SQL]) {
      // Every source of a count is held to people: accounts, lives, runs and days played.
      expect(sql.match(/public\.room_bots/g)?.length).toBe(sql === TOTAL_SQL ? 3 : 4);
      expect(sql).not.toMatch(/\b(insert|update|delete|drop|alter)\b/i);
    }
  });

  it('says a return as a share of the day\'s new players, and when it cannot be known yet', () => {
    expect(share(2, 5)).toBe('2/5 40%');
    expect(share(0, 0)).toBe('—');
    expect(share(null, 5)).toBe('·');
  });

  it('prints the whole first, a row a day the latest first, and what each column means', () => {
    const lines = statsLines([day(), day({ day: '2026-10-18', back_d1: 2, new_players: 4 })], { players: 120, kept: 9, active_week: 31 });
    expect(lines[0]).toBe('Players 120 · keep their account with Google 9 · played in the last 7 days 31');
    expect(lines[2]).toMatch(/^day\s+new\s+google\s+active\s+alone\s+ranked\s+multi\s+ended\s+back day 1\s+back day 7\s+friends\s+quick\s+slow$/);
    expect(lines[3]).toMatch(/^2026-10-19\s+5\s+1\s+7\s+9\s+2\s+4\s+6\s+·\s+·\s+1\s+3\s+0$/);
    expect(lines[4]).toContain('2/4 50%');
    // Columns line up, whatever the numbers.
    expect(new Set(lines.slice(2, 5).map((line) => line.length)).size).toBe(1);
    expect(lines.at(-1)).toMatch(/^friends, quick, slow:/);
  });
});
