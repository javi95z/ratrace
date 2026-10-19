/**
 * Runs the SQL security tests against the linked Supabase project and says how they went.
 *
 * The tests are one block that always ends by raising, so the database is left as it was; the
 * outcome is read from the message of that error. This needs the Supabase CLI, logged in and
 * linked, and the network: it is not part of `pnpm test`.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { outcomeOf, verdict } from './outcome';

const file = fileURLToPath(new URL('../../../supabase/tests/security.sql', import.meta.url));
const root = fileURLToPath(new URL('../../../', import.meta.url));
const run = spawnSync('supabase', ['db', 'query', '--linked', '--file', file], { cwd: root, encoding: 'utf8' });
const output = `${run.stdout}\n${run.stderr}`;

/** How many checks `supabase/tests/security.sql` holds. A run with fewer is a run in which some never happened. */
const EXPECTED = 213;

const outcome = outcomeOf(output);
const { ok, lines } = verdict(outcome, EXPECTED);
if (outcome === null) console.error(output.trim().slice(0, 2000));
for (const line of lines) console.log(line);
process.exit(ok ? 0 : outcome === null ? 2 : 1);
