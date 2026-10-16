/**
 * Lists the errors kept in the linked Supabase project, the latest first: `pnpm online:errors`.
 * It reads and changes nothing else. See `docs/errors.md`.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { listOf, rowsOf } from './errors-list';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const SQL = 'select source, place, message, build, browser, seen, first_seen, last_seen from public.error_kinds order by last_seen desc limit 40';
const run = spawnSync('supabase', ['db', 'query', '--linked', SQL], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const rows = rowsOf(`${run.stdout}`);
if (run.status !== 0 || rows === null) {
  console.error(`✗ the errors could not be read: ${`${run.stderr}${run.stdout}`.trim().slice(0, 500)}`);
  process.exit(2);
}
for (const line of listOf(rows, Date.now())) console.log(line);
