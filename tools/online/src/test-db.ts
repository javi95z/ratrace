/**
 * Runs the SQL security tests against the linked Supabase project and says how they went.
 *
 * The tests are one block that always ends by raising, so the database is left as it was; the
 * outcome is read from the message of that error. This needs the Supabase CLI, logged in and
 * linked, and the network: it is not part of `pnpm test`.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { outcomeOf } from './outcome';

const file = fileURLToPath(new URL('../../../supabase/tests/security.sql', import.meta.url));
const root = fileURLToPath(new URL('../../../', import.meta.url));
const run = spawnSync('supabase', ['db', 'query', '--linked', '--file', file], { cwd: root, encoding: 'utf8' });
const output = `${run.stdout}\n${run.stderr}`;

const outcome = outcomeOf(output);
if (outcome === null) {
  console.error('The security tests did not run to the end:\n');
  console.error(output.trim().slice(0, 2000));
  process.exit(2);
}
for (const line of outcome.failed) console.error(`  ✗ ${line}`);
console.log(`${outcome.failed.length === 0 ? '✓' : '✗'} security rules: ${outcome.passed} held, ${outcome.failed.length} broken`);
process.exit(outcome.failed.length === 0 ? 0 : 1);
