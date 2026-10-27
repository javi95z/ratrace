import { existsSync, writeFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { sendUpdate, type Run } from './easUpdate';

/** `eas` as the script calls it: env:pull writes the channel's variables where it is told, update is only seen. */
function fakeEas(pulled: string, statuses: { pull?: number; update?: number } = {}) {
  const calls: Array<{ args: string[]; env: Record<string, string | undefined>; fileThere: boolean }> = [];
  let pulledTo = '';
  const run: Run = (command, args, env) => {
    expect(command).toBe('eas');
    if (args[0] === 'env:pull') {
      pulledTo = args[args.indexOf('--path') + 1];
      if (!statuses.pull) writeFileSync(pulledTo, pulled);
      calls.push({ args, env, fileThere: true });
      return statuses.pull ?? 0;
    }
    calls.push({ args, env, fileThere: existsSync(pulledTo) });
    return statuses.update ?? 0;
  };
  return { run, calls, pulledTo: () => pulledTo };
}

const PULLED = '# Environment: preview\nEXPO_PUBLIC_SUPABASE_URL="https://live.example"\nEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_live\n';

test("the channel's EAS variables are pulled to a file of its own, read, the file gone before the update runs on them, held to the live project", () => {
  const eas = fakeEas(PULLED);
  expect(sendUpdate('preview', ['--message', 'hello'], eas.run, {})).toBe(0);
  const [pull, update] = eas.calls;
  expect(pull.args).toEqual(['env:pull', '--environment', 'preview', '--path', eas.pulledTo(), '--non-interactive']);
  // The pull reads the config as any command on this machine does: not held, it has nothing yet.
  expect(pull.env.RATRACE_UPDATE).toBeUndefined();
  expect(update.args).toEqual(['update', '--channel', 'preview', '--environment', 'preview', '--auto', '--message', 'hello']);
  expect(update.env).toMatchObject({ RATRACE_UPDATE: 'preview', EXPO_PUBLIC_SUPABASE_URL: 'https://live.example', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_live' });
  expect(update.fileThere).toBe(false);
  expect(existsSync(eas.pulledTo())).toBe(false);
});

test('production is its own channel and environment; any other name is refused before anything runs', () => {
  const eas = fakeEas(PULLED);
  sendUpdate('production', [], eas.run, {});
  expect(eas.calls.map((call) => call.args.slice(0, 3))).toEqual([['env:pull', '--environment', 'production'], ['update', '--channel', 'production']]);
  expect(() => sendUpdate('staging', [], eas.run, {})).toThrow(/preview or production/);
  expect(eas.calls).toHaveLength(2);
});

test('a pull that fails sends nothing and leaves no file; a failed update is told by its status; no value is ever printed', () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const failedPull = fakeEas(PULLED, { pull: 1 });
  expect(sendUpdate('preview', [], failedPull.run, {})).toBe(1);
  expect(failedPull.calls).toHaveLength(1);
  expect(existsSync(failedPull.pulledTo())).toBe(false);
  const failedUpdate = fakeEas(PULLED, { update: 3 });
  expect(sendUpdate('preview', [], failedUpdate.run, {})).toBe(3);
  const printed = [...log.mock.calls, ...error.mock.calls].flat().join('\n');
  expect(printed).not.toMatch(/live\.example|sb_publishable_live/);
  log.mockRestore();
  error.mockRestore();
});

test('the package runs it for each channel', async () => {
  const { readFileSync } = await import('node:fs');
  const scripts = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> }).scripts;
  for (const channel of ['preview', 'production']) expect(scripts[`update:${channel}`]).toBe(`tsx scripts/easUpdate.ts ${channel}`);
});
