import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LOCALES } from '@ratrace/i18n/locales';
import { describe, expect, it } from 'vitest';
import webNext from '../../web/next.config';
import { PAGES } from '../src/game/pageList';
import { buildEnv, buildSite, takeMaps } from './webBuild';
import { fileFor, HOST_CONFIG, headersOf, rewriteOf, sourcePattern } from './webLife';
import { pageFiles } from './webSize';

/*
 * The site's build and its Vercel configuration (apps/mobile/vercel.json): what is deployed is what the checks on this machine build and serve.
 */

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as Record<string, unknown>;
const app = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> };

describe('the Vercel configuration', () => {
  it('builds the site with the build the checks run, into the folder it serves, with no framework of Vercel\'s own', () => {
    expect(vercel.buildCommand).toBe('pnpm web:build');
    expect(app.scripts['web:build']).toBe('tsx scripts/webBuild.ts dist');
    expect(vercel.outputDirectory).toBe('dist');
    expect(vercel.framework).toBeNull();
  });

  it('serves every page of the game in every language at its address, as the Next web does: /en its front door, /es/play its HTML', () => {
    const out = mkdtempSync(join(tmpdir(), 'ratrace-rewrites-'));
    try {
      const files = pageFiles(PAGES, LOCALES);
      for (const file of files) {
        mkdirSync(join(out, file, '..'), { recursive: true });
        writeFileSync(join(out, file), file);
      }
      for (const locale of LOCALES) {
        for (const page of PAGES) {
          const address = `/${locale}${page === '' ? '' : `/${page}`}`;
          expect(rewriteOf(address), address).toBe(`/${pageFiles([page], [locale])[0]}`);
          expect(fileFor(out, address)?.path, address).toBe(join(out, pageFiles([page], [locale])[0]));
        }
      }
      expect(rewriteOf('/de/play')).toBeNull();
      expect(rewriteOf('/en/nowhere')).toBeNull();
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it('leads no file elsewhere: no clean URLs, which would send /offline.html, the worker\'s offline page, to /offline; only an address\'s end slash goes (308), as the Next web\'s', () => {
    expect(vercel.cleanUrls).toBeUndefined();
    expect(vercel.redirects).toBeUndefined();
    expect(vercel.trailingSlash).toBe(false);
  });

  it('sends the worker with the Next web\'s headers (apps/web/next.config.ts), and the app\'s chunks, named by what they hold, kept for good', async () => {
    const theirs = await webNext.headers?.();
    const worker = theirs?.find((rule) => rule.source === '/sw.js');
    expect(worker).toBeDefined();
    expect(HOST_CONFIG.headers.find((rule) => rule.source === '/sw.js')).toEqual({ source: '/sw.js', headers: worker?.headers });
    expect(headersOf('/sw.js')).toEqual({ 'cache-control': 'no-cache, no-store, must-revalidate', 'service-worker-allowed': '/' });
    expect(headersOf('/_expo/static/js/web/entry-0123abcd.js')).toEqual({ 'cache-control': 'public, max-age=31536000, immutable' });
    expect(headersOf('/en')).toEqual({});
    expect(headersOf('/swajs')).toEqual({});
  });

  it('is read on this machine as Vercel reads its sources (path-to-regexp): a named part of a list, a named segment, an expression as written', () => {
    expect(sourcePattern('/:locale(en|es)/:page(play|new)').exec('/es/play')?.groups).toEqual({ locale: 'es', page: 'play' });
    expect(sourcePattern('/:locale(en|es)').test('/ru')).toBe(false);
    expect(sourcePattern('/files/:name').exec('/files/a.png')?.groups).toEqual({ name: 'a.png' });
    expect(sourcePattern('/files/:name').test('/files/a/b.png')).toBe(false);
    expect(sourcePattern('/_expo/static/(.*)').test('/_expo/static/js/web/a.js')).toBe(true);
    expect(sourcePattern('/sw.js').test('/swxjs')).toBe(false);
  });
});

describe('the build', () => {
  it('names the commit its error reports name, Vercel\'s, unless it is given one', () => {
    expect(buildEnv({ VERCEL_GIT_COMMIT_SHA: 'abc123' }, {}).EXPO_PUBLIC_VERCEL_GIT_COMMIT_SHA).toBe('abc123');
    expect(buildEnv({ VERCEL_GIT_COMMIT_SHA: 'abc123', EXPO_PUBLIC_VERCEL_GIT_COMMIT_SHA: 'def456' }, {}).EXPO_PUBLIC_VERCEL_GIT_COMMIT_SHA).toBe('def456');
    expect(buildEnv({}, {}).EXPO_PUBLIC_VERCEL_GIT_COMMIT_SHA).toBe('');
    expect(buildEnv({ EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54399' }, {}).EXPO_PUBLIC_SUPABASE_URL).toBe('http://127.0.0.1:54399');
  });

  it('refuses to build on Vercel when it cannot tell a deployment from a build here (VERCEL with no VERCEL_ENV), before anything is made', async () => {
    const out = mkdtempSync(join(tmpdir(), 'ratrace-unheld-'));
    try {
      const { problems, seconds } = await buildSite(join(out, 'dist'), { VERCEL: '1' });
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatch(/VERCEL_ENV/);
      // Nothing was run: no sprites, no rules, no export.
      expect(seconds).toEqual({});
      expect(existsSync(join(out, 'dist'))).toBe(false);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it('refuses a deployment without the live web\'s settings before it is made, as the export\'s config would', async () => {
    const { problems, seconds } = await buildSite(join(tmpdir(), 'ratrace-never-made'), { VERCEL: '1', VERCEL_ENV: 'production', EXPO_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_live' });
    expect(problems.join()).toMatch(/EXPO_PUBLIC_VAPID_PUBLIC_KEY/);
    expect(seconds).toEqual({});
  });

  it('refuses to make the site for one address and check it for another', () => {
    expect(() => buildEnv({ EXPO_PUBLIC_SITE_URL: 'https://rats.example' }, {})).toThrow(/EXPO_PUBLIC_SITE_URL/);
    expect(buildEnv({ EXPO_PUBLIC_SITE_URL: 'https://rats.example' }, { EXPO_PUBLIC_SITE_URL: 'https://rats.example' }).EXPO_PUBLIC_SITE_URL).toBe('https://rats.example');
  });

  it('takes the source maps out of the site, the lines that name them off the scripts, and keeps what each script holds for the checks', () => {
    const out = mkdtempSync(join(tmpdir(), 'ratrace-maps-'));
    try {
      mkdirSync(join(out, '_expo/static/js/web'), { recursive: true });
      mkdirSync(join(out, '_expo/static/css'), { recursive: true });
      const script = '_expo/static/js/web/entry-abc.js';
      writeFileSync(join(out, script), `console.log(1)\n//# sourceMappingURL=/${script}.map\n//# debugId=74d81fbc-bd9d-4d48-9a59-ab005cf665f0`);
      writeFileSync(join(out, `${script}.map`), JSON.stringify({ sources: ['apps/mobile/src/a.ts', 'node_modules/react/index.js'] }));
      writeFileSync(join(out, '_expo/static/css/a.css'), 'a{}');
      writeFileSync(join(out, '_expo/static/css/a.css.map'), JSON.stringify({ sections: [{ map: { sources: ['a.css'] } }] }));
      const sources = takeMaps(out);
      expect(Object.fromEntries(sources)).toEqual({ [script]: ['apps/mobile/src/a.ts', 'node_modules/react/index.js'], '_expo/static/css/a.css': ['a.css'] });
      expect(readFileSync(join(out, script), 'utf8')).toBe('console.log(1)');
      expect(readFileSync(join(out, '_expo/static/css/a.css'), 'utf8')).toBe('a{}');
      expect(existsSync(join(out, `${script}.map`))).toBe(false);
      expect(existsSync(join(out, '_expo/static/css/a.css.map'))).toBe(false);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
