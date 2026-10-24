import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LOCALES } from '@ratrace/i18n/locales';
import { serverProblem } from '../app.config';
import { SITE_URL } from '../src/game/site';
import { writeServiceWorker } from './serviceWorker';
import { settlePages, writeSitePieces } from './sitePieces';
import type { SourceMap } from './webSize';
import { exportWeb, judgeExport, judgeSiteFiles, pageFiles, readExport, routedPages, sourcesOf, walk } from './webSize';

/**
 * The site's build: what Vercel runs (vercel.json's `buildCommand`, `pnpm web:build`, which is `tsx scripts/webBuild.ts dist`), and what the checks on
 * this machine run to make the site they serve (`web-life.ts --export`, `web-offline.ts`, `web-signin.ts`), so that what is checked is what is
 * deployed. In order:
 *
 * 0. A Vercel deployment held to the live project and the live web's settings, and a build on Vercel that does not say which it is refused
 *    (`serverProblem`, `app.config.ts`): nothing is made.
 * 1. The sprites and the older rules copied in (`pnpm sprites`, `pnpm rules`: the export's `public/sprites` and `public/rules`).
 * 2. The export (`expo export --platform web`) into `out`, with source maps, in the build's environment, `EXPO_PUBLIC_VERCEL_GIT_COMMIT_SHA` taken
 *    from Vercel's `VERCEL_GIT_COMMIT_SHA` where it is not set (`buildEnv`).
 * 3. The maps taken out of it, what each script holds kept for the checks (`takeMaps`): the scripts are then byte for byte those of an export made
 *    without maps.
 * 4. The pages the site serves (`settlePages`: the router's templates dropped, its page of nothing the site's `404.html`), the site's pieces
 *    (`writeSitePieces`) and the worker (`writeServiceWorker`, which precaches what is left).
 * 5. The checks (web:size's, `judgeExport`, on the site as it is, and `judgeSiteFiles`): a problem fails the build. The first visit's lazy chunks are
 *    weighed by `web-life.ts --export`, which needs a browser, and is run on this machine before a deployment (CLAUDE.md).
 */
const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..');

/**
 * The environment the export is made in: `env`, with the commit its error reports name (`EXPO_PUBLIC_VERCEL_GIT_COMMIT_SHA`, the Next web's
 * `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`) taken from Vercel's `VERCEL_GIT_COMMIT_SHA` where it is not given. The site's address must be the one this
 * build's checks hold the pages to (`SITE_URL`, read from this process's own environment): an export made for another would fail them.
 */
export function buildEnv(env: Record<string, string | undefined>, own: Record<string, string | undefined> = process.env): Record<string, string | undefined> {
  if ((env.EXPO_PUBLIC_SITE_URL ?? '') !== (own.EXPO_PUBLIC_SITE_URL ?? '')) {
    throw new Error(`the export would be made for ${env.EXPO_PUBLIC_SITE_URL || 'the published address'}, and checked for ${own.EXPO_PUBLIC_SITE_URL || 'the published address'}: give both the same EXPO_PUBLIC_SITE_URL`);
  }
  return { ...env, EXPO_PUBLIC_VERCEL_GIT_COMMIT_SHA: env.EXPO_PUBLIC_VERCEL_GIT_COMMIT_SHA || env.VERCEL_GIT_COMMIT_SHA || '' };
}

/** The two lines Metro ends a script with when it makes its map: where the map is, and the bundle's id. */
const MAP_LINES = /\n\/\/# sourceMappingURL=[^\n]*(\n\/\/# debugId=[^\n]*)?\n?$/;

/**
 * Takes the source maps out of the export at `out`: each `.map` removed, and the lines that name it taken off the end of its script. What each
 * script holds, by its path (`sourcesOf` its map), for the checks.
 */
export function takeMaps(out: string): Map<string, string[]> {
  const sources = new Map<string, string[]>();
  for (const path of walk(out).filter((one) => one.endsWith('.map'))) {
    const script = path.slice(0, -'.map'.length);
    sources.set(script, sourcesOf(JSON.parse(readFileSync(join(out, path), 'utf8')) as SourceMap));
    unlinkSync(join(out, path));
    if (!script.endsWith('.js')) continue;
    try {
      const text = readFileSync(join(out, script), 'utf8');
      if (MAP_LINES.test(text)) writeFileSync(join(out, script), text.replace(MAP_LINES, ''));
    } catch {
      // A map whose script is not there: nothing to take off.
    }
  }
  return sources;
}

/** Runs one of the app's package scripts, or says why it failed. */
function packageScript(name: string, env: Record<string, string | undefined>): void {
  const run = spawnSync('pnpm', ['-s', name], { cwd: app, env: env as NodeJS.ProcessEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (run.status !== 0) throw new Error(`pnpm ${name} failed (exit ${run.status ?? run.signal}):\n${`${run.stdout}\n${run.stderr}`.trim()}`);
  console.log(run.stdout.trim());
}

/**
 * Builds the site into `out` in the environment `env` (`process.env` for Vercel's build; the checks on this machine give theirs: no project, or the
 * fake one) and checks it. What is wrong with it, in words (nothing when it is fine), and how long each step took.
 */
export async function buildSite(out: string, env: Record<string, string | undefined> = process.env): Promise<{ problems: string[]; seconds: Record<string, number> }> {
  const seconds: Record<string, number> = {};
  const timed = async <T>(step: string, run: () => T | Promise<T>): Promise<T> => {
    const start = performance.now();
    const done = await run();
    seconds[step] = Math.round(performance.now() - start) / 1000;
    return done;
  };
  // A deployment that is not what the live web needs, or a build on Vercel that cannot tell which it is, is refused before anything is made: the
  // export's config (`app.config.ts`) would refuse it too, but this build does not rest on the export reading it.
  const refused = serverProblem(env);
  if (refused !== null) return { problems: [refused], seconds };
  const given = buildEnv(env);
  await timed('sprites and rules', () => {
    packageScript('sprites', given);
    packageScript('rules', given);
  });
  rmSync(out, { recursive: true, force: true });
  const failed = await timed('export', () => exportWeb(out, given));
  if (failed !== null) return { problems: [failed], seconds };
  const known = takeMaps(out);
  await timed('pages, pieces and worker', async () => {
    const { dropped } = settlePages(out);
    console.log(`site pages: ${dropped.length} templates dropped (${dropped.join(', ')}), the page of nothing as 404.html`);
    const pieces = await writeSitePieces(out, SITE_URL);
    console.log(`site pieces: ${pieces.length} files for ${SITE_URL.href}`);
    const { version, assets } = writeServiceWorker(out);
    console.log(`service worker: ${assets.length} files precached, cache ratrace-${version}`);
  });
  const problems = await timed('checks', () => {
    const { files, sources } = readExport(out, known);
    return [...judgeExport(files, sources, SITE_URL), ...judgeSiteFiles(files, pageFiles(routedPages(), LOCALES))];
  });
  return { problems, seconds };
}

async function main() {
  const out = resolve(process.argv[2] ?? join(app, 'dist'));
  const { problems, seconds } = await buildSite(out);
  console.log(`steps: ${Object.entries(seconds).map(([step, s]) => `${step} ${s} s`).join(', ')}`);
  for (const problem of problems) console.error(`problem: ${problem}`);
  if (problems.length > 0) process.exitCode = 1;
  else console.log(`the site is built in ${out}, as light and as whole as it must be`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
