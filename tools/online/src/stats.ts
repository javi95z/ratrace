/**
 * The usage numbers of the game, from the linked Supabase project: `pnpm online:stats [days]`.
 * It reads counts and changes nothing. What each column means is printed under the numbers.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { rowsOf } from './errors-list';
import { daysAsked, daysSql, statsLines, TOTAL_SQL } from './stats-list';
import type { DayRow, TotalRow } from './stats-list';

const root = fileURLToPath(new URL('../../../', import.meta.url));

/** The rows of one read-only query of the linked project, or the reason there are none. */
function ask<Row>(sql: string): Row[] {
  const run = spawnSync('supabase', ['db', 'query', '--linked', '--output-format', 'json', sql], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const rows = rowsOf<Row>(`${run.stdout}`);
  if (run.status !== 0 || rows === null) {
    console.error(`✗ the numbers could not be read: ${`${run.stderr}${run.stdout}`.trim().slice(0, 500)}`);
    process.exit(2);
  }
  return rows;
}

const days = ask<DayRow>(daysSql(daysAsked(process.argv.slice(2))));
const [total] = ask<TotalRow>(TOTAL_SQL);
for (const line of statsLines(days, total ?? { players: 0, kept: 0, active_week: 0 })) console.log(line);
