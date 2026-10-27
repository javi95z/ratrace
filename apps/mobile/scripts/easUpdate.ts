import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

/**
 * Sends an update over the air (EAS Update) to a channel's builds, bundled with the channel's EAS environment:
 *
 *   pnpm --filter @ratrace/mobile update:preview [-- --message "…"]      (update:production for the players' store builds; only when asked)
 *
 * `eas update --environment` gives the channel's variables to the bundle only: eas-cli reads app.config.ts first, without them, and the config
 * refuses an update with no live project (`serverProblem`, RATRACE_UPDATE). So they are pulled first (`eas env:pull`) into a file in a folder of
 * this run's own, read, and the folder removed before the update runs with them in its environment. Their values are never printed.
 */

export const CHANNELS = ['preview', 'production'] as const;

type Env = Record<string, string | undefined>;

/** Runs a command to its end, its output the terminal's: its exit status. */
export type Run = (command: string, args: string[], env: Env) => number;

const runHere: Run = (command, args, env) => spawnSync(command, args, { env: env as NodeJS.ProcessEnv, stdio: 'inherit' }).status ?? 1;

/** Pulls the channel's variables, then sends the update on them: the update's exit status, or the pull's where it failed. */
export function sendUpdate(channel: string, extra: string[], run: Run = runHere, env: Env = process.env): number {
  if (!(CHANNELS as readonly string[]).includes(channel)) throw new Error(`update: the channel is preview or production, not ${channel}`);
  const folder = mkdtempSync(join(tmpdir(), 'ratrace-update-'));
  let pulled: Record<string, string>;
  try {
    const file = join(folder, '.env');
    const status = run('eas', ['env:pull', '--environment', channel, '--path', file, '--non-interactive'], env);
    if (status !== 0) {
      console.error(`update: the ${channel} environment could not be pulled`);
      return status;
    }
    pulled = parseEnv(readFileSync(file, 'utf8')) as Record<string, string>;
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
  console.log(`update: ${Object.keys(pulled).length} variables of the ${channel} environment (${Object.keys(pulled).sort().join(', ')})`);
  return run('eas', ['update', '--channel', channel, '--environment', channel, '--auto', ...extra], { ...env, ...pulled, RATRACE_UPDATE: channel });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [channel = '', ...extra] = process.argv.slice(2);
  process.exit(sendUpdate(channel, extra.filter((arg) => arg !== '--')));
}
