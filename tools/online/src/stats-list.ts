/**
 * The usage numbers of the game, as `pnpm online:stats` reads them from the linked project: what to
 * ask the database, and how to print its answer. Days are Spain's, as `private.today()` counts them.
 * Nothing here is about a person: every figure is a count.
 */

/** One day of the numbers. Counts are numbers; a return not yet knowable is null. */
export interface DayRow {
  day: string;
  /** Players whose account began that day, and of them those who keep it with Google now. */
  new_players: number;
  new_kept: number;
  /** Players who played that day, whenever they began. */
  active: number;
  /** Lives begun that day: alone, ranked, and in a game with others. */
  begun_casual: number;
  begun_ranked: number;
  begun_room: number;
  /** Lives finished that day, of every kind. */
  finished: number;
  /** Of the players who began that day, those who played again the next day, and a week later. Null until that day has come. */
  back_d1: number | null;
  back_d7: number | null;
  /** Games with others opened that day: among friends, public ones played together, public ones of a round a day. */
  games_friends: number;
  games_quick: number;
  games_slow: number;
}

/** The whole of it, whatever the day. */
export interface TotalRow {
  players: number;
  kept: number;
  active_week: number;
}

/** How many days are shown when none is asked for, and the most that may be. */
export const DEFAULT_DAYS = 14;
const MOST_DAYS = 90;

/** The number of days asked for on the command line, within reason. */
export function daysAsked(argv: readonly string[]): number {
  const asked = Number.parseInt(argv.find((arg) => /^\d+$/.test(arg)) ?? '', 10);
  return Number.isSafeInteger(asked) && asked > 0 ? Math.min(asked, MOST_DAYS) : DEFAULT_DAYS;
}

/** A rat of the server is no player: it is left out of every count. */
const NOT_A_RAT = (column: string) => `not exists (select 1 from public.room_bots r where r.user_id = ${column})`;
const IN_SPAIN = (column: string) => `(${column} at time zone 'Europe/Madrid')::date`;

/** One row a day, the latest first, for the last `days` days. */
export function daysSql(days: number): string {
  const n = Math.max(1, Math.min(MOST_DAYS, Math.floor(days)));
  return `
with
days as (select (private.today() - g)::date as day from generate_series(0, ${n - 1}) g),
people as (select u.id, ${IN_SPAIN('u.created_at')} as day, u.is_anonymous from auth.users u where ${NOT_A_RAT('u.id')}),
lives as (select ${IN_SPAIN('g.created_at')} as day, g.mode from public.games g where ${NOT_A_RAT('g.user_id')}),
ends as (select ${IN_SPAIN('r.finished_at')} as day from public.runs r where ${NOT_A_RAT('r.user_id')}),
games as (select ${IN_SPAIN('m.created_at')} as day, m.public, m.seconds from public.rooms m)
select d.day::text as day,
  (select count(*) from people p where p.day = d.day)::int as new_players,
  (select count(*) from people p where p.day = d.day and not p.is_anonymous)::int as new_kept,
  (select count(*) from private.player_days a where a.day = d.day and ${NOT_A_RAT('a.user_id')})::int as active,
  (select count(*) from lives l where l.day = d.day and l.mode = 'casual')::int as begun_casual,
  (select count(*) from lives l where l.day = d.day and l.mode = 'ranked')::int as begun_ranked,
  (select count(*) from lives l where l.day = d.day and l.mode = 'room')::int as begun_room,
  (select count(*) from ends e where e.day = d.day)::int as finished,
  case when d.day + 1 <= private.today() then (select count(*) from people p where p.day = d.day
    and exists (select 1 from private.player_days a where a.user_id = p.id and a.day = d.day + 1))::int end as back_d1,
  case when d.day + 7 <= private.today() then (select count(*) from people p where p.day = d.day
    and exists (select 1 from private.player_days a where a.user_id = p.id and a.day = d.day + 7))::int end as back_d7,
  (select count(*) from games m where m.day = d.day and not m.public)::int as games_friends,
  (select count(*) from games m where m.day = d.day and m.public and m.seconds < 3600)::int as games_quick,
  (select count(*) from games m where m.day = d.day and m.public and m.seconds >= 3600)::int as games_slow
from days d
order by d.day desc`.trim();
}

/** Every player, those who keep their account with Google, and those who played in the last seven days. */
export const TOTAL_SQL = `
select
  (select count(*) from auth.users u where ${NOT_A_RAT('u.id')})::int as players,
  (select count(*) from auth.users u where not u.is_anonymous and ${NOT_A_RAT('u.id')})::int as kept,
  (select count(distinct a.user_id) from private.player_days a where a.day > private.today() - 7 and ${NOT_A_RAT('a.user_id')})::int as active_week`.trim();

/** A share of a count, as a reader takes it in at a glance: "2/5 40%", or a dash when there is nothing to share. */
export function share(part: number | null, whole: number): string {
  if (part === null) return '·';
  if (whole === 0) return '—';
  return `${part}/${whole} ${Math.round((part / whole) * 100)}%`;
}

const COLUMNS: Array<{ title: string; width: number; of(row: DayRow): string }> = [
  { title: 'day', width: 10, of: (row) => row.day },
  { title: 'new', width: 5, of: (row) => String(row.new_players) },
  { title: 'google', width: 6, of: (row) => String(row.new_kept) },
  { title: 'active', width: 6, of: (row) => String(row.active) },
  { title: 'alone', width: 5, of: (row) => String(row.begun_casual) },
  { title: 'ranked', width: 6, of: (row) => String(row.begun_ranked) },
  { title: 'multi', width: 5, of: (row) => String(row.begun_room) },
  { title: 'ended', width: 5, of: (row) => String(row.finished) },
  { title: 'back day 1', width: 11, of: (row) => share(row.back_d1, row.new_players) },
  { title: 'back day 7', width: 11, of: (row) => share(row.back_d7, row.new_players) },
  { title: 'friends', width: 7, of: (row) => String(row.games_friends) },
  { title: 'quick', width: 5, of: (row) => String(row.games_quick) },
  { title: 'slow', width: 4, of: (row) => String(row.games_slow) },
];

/** The numbers as lines for a terminal: the whole first, then a row a day, the latest first, and what each column means. */
export function statsLines(days: readonly DayRow[], total: TotalRow): string[] {
  const line = (cells: string[]) => cells.map((cell, at) => (at === 0 ? cell.padEnd(COLUMNS[at].width) : cell.padStart(COLUMNS[at].width))).join('  ');
  return [
    `Players ${total.players} · keep their account with Google ${total.kept} · played in the last 7 days ${total.active_week}`,
    '',
    line(COLUMNS.map((column) => column.title)),
    ...days.map((row) => line(COLUMNS.map((column) => column.of(row)))),
    '',
    'new: accounts begun that day (google: of them, kept with Google now) · active: played that day',
    'alone, ranked, multi: lives begun · ended: lives finished · back day 1/7: of the new, played again a day/a week later (· not yet known)',
    'friends, quick, slow: games with others opened: among friends, public played together, public a round a day',
  ];
}

/** One day of the events the game counted on one platform (`private.app_events`, kept by the function `track`). */
export interface EventRow {
  day: string;
  platform: string;
  life_start: number;
  life_end: number;
  /** Of the lives ended, those that escaped the rat race. */
  escaped: number;
  challenge_attempt: number;
  game_start: number;
  game_join: number;
  account_kept: number;
  app_installed: number;
  share: number;
}

const EVENT_NAMES = ['life_start', 'life_end', 'challenge_attempt', 'game_start', 'game_join', 'account_kept', 'app_installed', 'share'] as const;

/** One row a day and platform that counted anything, the latest first, for the last `days` days. */
export function eventsSql(days: number): string {
  const n = Math.max(1, Math.min(MOST_DAYS, Math.floor(days)));
  const sums = EVENT_NAMES.map((name) => `  coalesce(sum(e.count) filter (where e.name = '${name}'), 0)::int as ${name},`);
  return `
select e.day::text as day, e.platform,
${sums.join('\n')}
  coalesce(sum(e.count) filter (where e.name = 'life_end' and e.props ->> 'escaped' = 'true'), 0)::int as escaped
from private.app_events e
where e.day >= private.today() - ${n - 1}
group by e.day, e.platform
order by e.day desc, e.platform`.trim();
}

const EVENT_COLUMNS: Array<{ title: string; width: number; of(row: EventRow): string }> = [
  { title: 'day', width: 10, of: (row) => row.day },
  { title: 'on', width: 7, of: (row) => row.platform },
  { title: 'begun', width: 5, of: (row) => String(row.life_start) },
  { title: 'ended', width: 5, of: (row) => String(row.life_end) },
  { title: 'escaped', width: 7, of: (row) => String(row.escaped) },
  { title: 'challenge', width: 9, of: (row) => String(row.challenge_attempt) },
  { title: 'started', width: 7, of: (row) => String(row.game_start) },
  { title: 'joined', width: 6, of: (row) => String(row.game_join) },
  { title: 'kept', width: 4, of: (row) => String(row.account_kept) },
  { title: 'installed', width: 9, of: (row) => String(row.app_installed) },
  { title: 'shared', width: 6, of: (row) => String(row.share) },
];

/** The events as lines for a terminal: a row a day and platform, the latest first, and what each column means. */
export function eventLines(rows: readonly EventRow[]): string[] {
  const title = 'Events, as the game counted them';
  if (rows.length === 0) return [title, '', 'None in these days.'];
  const line = (cells: string[]) => cells.map((cell, at) => (at < 2 ? cell.padEnd(EVENT_COLUMNS[at].width) : cell.padStart(EVENT_COLUMNS[at].width))).join('  ');
  return [
    title,
    '',
    line(EVENT_COLUMNS.map((column) => column.title)),
    ...rows.map((row) => line(EVENT_COLUMNS.map((column) => column.of(row)))),
    '',
    'on: ios, android or web · begun, ended: lives (escaped: of them, out of the rat race) · challenge: attempts that counted',
    'kept: guests who kept their account with Google · installed: the game installed as an app · shared: cards and invitations',
    'started, joined: games with others begun as a player saw them, and joined by code, link or a quick game',
  ];
}
