/**
 * The usage numbers of the game, from the linked Supabase project: `pnpm online:stats [days]`.
 * It reads counts and changes nothing. What each column means is printed under the numbers.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { rowsOf } from './errors-list';
import { daysAsked, daysSql, eventLines, eventsSql, statsLines, TOTAL_SQL } from './stats-list';
import type { DayRow, EventRow, TotalRow } from './stats-list';

const root = fileURLToPath(new URL('../../../', import.meta.url));

/** The rows of one read-only query of the linked project, or why there are none. */
function query<Row>(sql: string): { rows: Row[] } | { failure: string } {
  const run = spawnSync('supabase', ['db', 'query', '--linked', '--output-format', 'json', sql], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const rows = rowsOf<Row>(`${run.stdout}`);
  if (run.status !== 0 || rows === null) return { failure: `${run.stderr}${run.stdout}`.trim().slice(0, 500) };
  return { rows };
}

/** The rows of one read-only query of the linked project; with none, the numbers end here. */
function ask<Row>(sql: string): Row[] {
  const read = query<Row>(sql);
  if ('failure' in read) {
    console.error(`✗ the numbers could not be read: ${read.failure}`);
    process.exit(2);
  }
  return read.rows;
}

const asked = daysAsked(process.argv.slice(2));
const days = ask<DayRow>(daysSql(asked));
const [total] = ask<TotalRow>(TOTAL_SQL);
for (const line of statsLines(days, total ?? { players: 0, kept: 0, active_week: 0 })) console.log(line);

// The events are read apart: a project without their table yet still shows the rest.
console.log('');
const events = query<EventRow>(eventsSql(asked));
if ('failure' in events) console.log(`Events could not be read (has the migration of app_events been pushed?): ${events.failure.split('\n')[0]}`);
else for (const line of eventLines(events.rows)) console.log(line);
