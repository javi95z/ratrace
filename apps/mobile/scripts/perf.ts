import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

/**
 * The collector of the timing probe (src/ui/perfProbe.tsx, in a build made with `EXPO_PUBLIC_PERF=1` only): it listens on this machine, which the
 * simulator reaches as its own 127.0.0.1, prints each line the app tells it, and keeps them all in `apps/mobile/.perf/<run>.jsonl` (not kept in git).
 *
 *   pnpm --filter @ratrace/mobile exec tsx scripts/perf.ts [--launches=5] [--run=name]
 *
 * With `--launches=n` it first times n cold starts of the release app on the booted simulator: the app is closed, the wall clock read, the app
 * launched, and the time is that until the app says the front door is drawn (its `home` line's own wall clock, the same machine's). It then
 * listens until it is stopped.
 */
const here = dirname(fileURLToPath(import.meta.url));
export const PERF_PORT = 8095;
export const BUNDLE_ID = 'com.hackio.theratrace';

export interface Told {
  kind: 'drawn' | 'frames' | 'launch' | 'count';
  name?: string;
  wall: number;
  drawnMs?: number | null;
  commitMs?: number | null;
  what?: string | null;
  [key: string]: unknown;
}

/** The median of some numbers (the budgets are each the median of five). */
export function median(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** One line of what the app told, as it is printed. */
export function lineOf(told: Told): string {
  if (told.kind === 'drawn') return `drawn  ${String(told.name).padEnd(28)} ${told.drawnMs == null ? '(no touch before it)' : `${told.drawnMs.toFixed(0)} ms (commit ${told.commitMs?.toFixed(0)} ms) from ${told.what}`}`;
  if (told.kind === 'frames') {
    const { ui, js } = told as unknown as { ui: { frames: number; worstMs: number; missed: number }; js: { frames: number; worstMs: number; missed: number } };
    return `frames ui ${ui.frames} (worst ${ui.worstMs} ms, missed ${ui.missed})  js ${js.frames} (worst ${js.worstMs} ms, missed ${js.missed})`;
  }
  return `${told.kind.padEnd(6)} ${JSON.stringify({ ...told, kind: undefined, n: undefined, wall: undefined })}`;
}

async function main() {
  const args = process.argv.slice(2);
  const launches = Number(args.find((a) => a.startsWith('--launches='))?.slice('--launches='.length) ?? 0);
  const run = args.find((a) => a.startsWith('--run='))?.slice('--run='.length) ?? `run-${Date.now()}`;
  const folder = join(here, '../.perf');
  mkdirSync(folder, { recursive: true });
  const file = join(folder, `${run}.jsonl`);
  const waiting: Array<(told: Told) => void> = [];
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk: Buffer) => (body += chunk.toString()));
    request.on('end', () => {
      response.writeHead(200).end('ok');
      if (request.url !== '/perf') return;
      try {
        const told = JSON.parse(body) as Told;
        appendFileSync(file, `${JSON.stringify({ ...told, heard: Date.now() })}\n`);
        console.log(`${new Date().toISOString().slice(11, 23)} ${lineOf(told)}`);
        for (const one of waiting.splice(0)) one(told);
      } catch {
        // Not a line of the probe's.
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(PERF_PORT, '127.0.0.1', () => resolve()));
  console.log(`listening on 127.0.0.1:${PERF_PORT}, keeping ${file}`);

  const heard = (match: (told: Told) => boolean, ms: number) =>
    new Promise<Told | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), ms);
      const listen = (told: Told) => {
        if (match(told)) {
          clearTimeout(timer);
          resolve(told);
        } else waiting.push(listen);
      };
      waiting.push(listen);
    });

  const cold: number[] = [];
  for (let i = 0; i < launches; i++) {
    try {
      execFileSync('xcrun', ['simctl', 'terminate', 'booted', BUNDLE_ID], { stdio: 'ignore' });
    } catch {
      // It was not running.
    }
    await sleep(3000);
    const t0 = Date.now();
    const home = heard((told) => told.kind === 'drawn' && told.name === 'home', 30_000);
    execFileSync('xcrun', ['simctl', 'launch', 'booted', BUNDLE_ID], { stdio: 'ignore' });
    const told = await home;
    if (told === null) {
      console.log(`launch ${i + 1}: the front door never said it was drawn`);
      continue;
    }
    cold.push(told.wall - t0);
    console.log(`launch ${i + 1}: ${told.wall - t0} ms to the front door drawn`);
    appendFileSync(file, `${JSON.stringify({ kind: 'cold', ms: told.wall - t0, launch: i + 1 })}\n`);
    await sleep(4000);
  }
  if (cold.length > 0) console.log(`cold start to the front door: median ${median(cold)} ms of ${cold.join(', ')}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
