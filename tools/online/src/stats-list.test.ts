import { describe, expect, it } from 'vitest';
import { daysAsked, daysSql, DEFAULT_DAYS, eventLines, eventsSql, share, statsLines, TOTAL_SQL } from './stats-list';
import type { DayRow, EventRow } from './stats-list';

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

  it('asks for the events of the days wanted, by platform, and changes nothing', () => {
    expect(eventsSql(7)).toContain('private.app_events');
    expect(eventsSql(7)).toContain('private.today() - 6');
    expect(eventsSql(500)).toContain('private.today() - 89');
    expect(eventsSql(14)).toMatch(/group by e\.day, e\.platform/);
    expect(eventsSql(14)).not.toMatch(/\b(insert|update|delete|drop|alter)\b/i);
  });

  it('prints the events a row a day and platform, the latest first, and what each column means', () => {
    const row = (over: Partial<EventRow> = {}): EventRow => ({
      day: '2026-10-23', platform: 'ios', life_start: 12, life_end: 7, escaped: 2, challenge_attempt: 3, game_start: 1, game_join: 4, account_kept: 1, app_installed: 5, share: 6, ...over,
    });
    const lines = eventLines([row(), row({ platform: 'web', life_start: 120 }), row({ day: '2026-10-22', platform: 'android' })]);
    expect(lines[0]).toBe('Events, as the game counted them');
    expect(lines[2]).toMatch(/^day\s+on\s+begun\s+ended\s+escaped\s+challenge\s+started\s+joined\s+kept\s+installed\s+shared$/);
    expect(lines[3]).toMatch(/^2026-10-23\s+ios\s+12\s+7\s+2\s+3\s+1\s+4\s+1\s+5\s+6$/);
    expect(lines[4]).toMatch(/^2026-10-23\s+web\s+120\s/);
    expect(lines[5]).toMatch(/^2026-10-22\s+android\s/);
    expect(new Set(lines.slice(2, 6).map((line) => line.length)).size).toBe(1);
    expect(lines.at(-1)).toMatch(/^started, joined:/);
    expect(eventLines([])).toEqual(['Events, as the game counted them', '', 'None in these days.']);
  });
});
