import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, relative, resolve } from 'node:path';
import { createGzip } from 'node:zlib';
import middleware, { config as middlewareConfig } from '../middleware';
import { FAKE_CLOUD_PORT, FAKE_KEY } from './fakeProject';
import { exportEnv } from './webSize';

/*
 * What `web-life.ts` checks of a run apart from the browser, so it can be tested without starting one (the script runs as it is imported).
 */

/**
 * The project the app's web was started with, as its page has it (`process.env`, which Expo's development server fills with the `EXPO_PUBLIC_*` of
 * its environment), or null: a run of this script must have none (no `EXPO_PUBLIC_SUPABASE_URL` nor `_PUBLISHABLE_KEY`).
 */
export function projectNamed(env: Readonly<Record<string, string | undefined>>): string | null {
  const named = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'].filter((key) => (env[key] ?? '') !== '');
  return named.length === 0 ? null : named.join(', ');
}

/** Whether a request stays on this machine. */
export const onThisMachine = (href: string): boolean => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(href).hostname);

/** Which app's web a run plays on: Metro's development server (by default), or the export (`--export`), made by the run and served as the site will serve it. */
export const appWebOf = (argv: readonly string[]): 'dev' | 'export' => (argv.includes('--export') ? 'export' : 'dev');

/**
 * The site a run serves when it is told one (`--site=<folder>`: a site already built, as `pnpm web:build` builds it into `dist`), or null: the run
 * builds its own.
 */
export const siteOf = (argv: readonly string[]): string | null => {
  const given = argv.find((arg) => arg.startsWith('--site='))?.slice('--site='.length);
  return given ? resolve(given) : null;
};

/**
 * The projects a built site would sign in to, as its scripts name them (the build writes `EXPO_PUBLIC_SUPABASE_URL` into them): a Supabase project's
 * address, or the fake one of this machine (`scripts/fakeCloud.ts`). A run that must be offline refuses a site that names any.
 */
export function projectsInSite(dir: string): string[] {
  const found = new Set<string>();
  const look = (folder: string) => {
    for (const name of readdirSync(folder)) {
      const path = join(folder, name);
      if (statSync(path).isDirectory()) look(path);
      else if (name.endsWith('.js')) for (const [address] of readFileSync(path, 'utf8').matchAll(/https:\/\/[a-z0-9]+\.supabase\.co|http:\/\/127\.0\.0\.1:54399/g)) found.add(address);
    }
  };
  if (existsSync(join(dir, '_expo'))) look(join(dir, '_expo'));
  return [...found].sort();
}

/**
 * The build's environment for the fake project of this machine (`scripts/fakeCloud.ts`, `web-signin.ts`): no live setting (`exportEnv`), and the
 * fake project's address and key, given to the build by name, never the live project's.
 */
export const fakeEnv = (env: Record<string, string | undefined>): Record<string, string | undefined> => ({
  ...exportEnv(env),
  EXPO_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${FAKE_CLOUD_PORT}`,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: FAKE_KEY,
});

/** What a file of the export is served as, by its ending: what a static host (Vercel) says of each. */
const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
};

/** What is read of the site's Vercel configuration (apps/mobile/vercel.json): where a page's address leads, and the headers of some files. */
interface HostConfig {
  /** False: an address ending in a slash is led to the same address without it (308), before anything else. */
  trailingSlash?: boolean;
  rewrites: readonly { source: string; destination: string }[];
  headers: readonly { source: string; headers: readonly { key: string; value: string }[] }[];
}

/** The site's own Vercel configuration, the one the deployment reads. */
export const HOST_CONFIG = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as HostConfig;

/**
 * A `source` of vercel.json as the expression of a whole path, for the part of path-to-regexp it uses: `:name(a|b)` a named part of one of those,
 * `:name` a named part of one segment, `(.*)` an expression as written, anything else itself.
 */
export function sourcePattern(source: string): RegExp {
  let pattern = '';
  for (let at = 0; at < source.length; ) {
    const named = /^:([A-Za-z_]\w*)/.exec(source.slice(at));
    if (named) at += named[0].length;
    if (source[at] === '(') {
      let depth = 0;
      let end = at;
      for (; end < source.length; end += 1) {
        if (source[end] === '(') depth += 1;
        if (source[end] === ')' && --depth === 0) break;
      }
      pattern += named ? `(?<${named[1]}>${source.slice(at + 1, end)})` : source.slice(at, end + 1);
      at = end + 1;
    } else if (named) pattern += `(?<${named[1]}>[^/]+)`;
    else pattern += source[at++].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${pattern}$`);
}

/** Where a rewrite of `config` leads `pathname`, or null when none matches (vercel.json's `rewrites`, the first that matches). */
export function rewriteOf(pathname: string, config: HostConfig = HOST_CONFIG): string | null {
  for (const { source, destination } of config.rewrites) {
    const found = sourcePattern(source).exec(pathname);
    if (found) return destination.replace(/:([A-Za-z_]\w*)/g, (_, name: string) => found.groups?.[name] ?? '');
  }
  return null;
}

/**
 * The file of the export at `dir` that answers `pathname`, as Vercel answers it with the site's configuration: the file itself where there is one
 * (wherever it is: a typeface in a folder whose name begins with a dot is one), a folder's `index.html`, else the file the site's rewrites lead the
 * address to (`/en` is `en/index.html`, `/en/play` is `en/play.html`, matched as Vercel matches them, strictly: `/en/play/` is led to `/en/play`
 * before, `serveExport`), else the site's page of nothing (`404.html`, with a 404), which a missing older rules file is answered with too, so that it
 * fails as it does on the site. No address leads elsewhere: `/offline.html` is the worker's offline page
 * by that very address. Never a file outside `dir`.
 */
export function fileFor(dir: string, pathname: string, config: HostConfig = HOST_CONFIG): { path: string; type: string; status?: number } | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const inside = (address: string) => {
    const path = resolve(dir, `.${address.startsWith('/') ? address : `/${address}`}`);
    return relative(dir, path).startsWith('..') ? null : path;
  };
  const path = inside(decoded);
  if (path === null) return null;
  const typed = (file: string) => ({ path: file, type: TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream' });
  const isFile = (file: string | null): file is string => file !== null && existsSync(file) && statSync(file).isFile();
  if (isFile(path)) return typed(path);
  if (isFile(join(path, 'index.html'))) return typed(join(path, 'index.html'));
  const rewritten = rewriteOf(decoded, config);
  const destination = rewritten === null ? null : inside(rewritten);
  if (isFile(destination)) return typed(destination);
  const nothing = join(dir, '404.html');
  return isFile(nothing) ? { ...typed(nothing), status: 404 } : null;
}

/** The headers the site's configuration gives `pathname` (vercel.json's `headers`: every rule that matches, in their order). */
export function headersOf(pathname: string, config: HostConfig = HOST_CONFIG): Record<string, string> {
  const given: Record<string, string> = {};
  for (const rule of config.headers) if (sourcePattern(rule.source).test(pathname)) for (const { key, value } of rule.headers) given[key.toLowerCase()] = value;
  return given;
}

/** The addresses the site's Routing Middleware is asked about (its `config.matcher`, which names no part: an expression of the whole path). */
const MIDDLEWARE_ASKED = new RegExp(`^${middlewareConfig.matcher}$`);

/**
 * The files the site's host sends compressed to a browser that takes gzip, by their type (Vercel compresses text, scripts, styles, JSON, SVG and the
 * TrueType and OpenType faces; pictures, sound and woff2 are compressed already).
 */
const COMPRESSED = /^(text\/|application\/json|image\/svg|font\/(ttf|otf))/;

/** Where Vercel serves what is its own beside the site's files: Web Analytics' script (`/_vercel/insights/script.js`) and the visits it sends. */
const VERCEL_OWN = '/_vercel/insights/';

/** What the site's host says of how long a file of it may be kept (Vercel's for a static file): kept, and asked again before it is used. */
const HOST_CACHING = 'public, max-age=0, must-revalidate';

/**
 * Serves the export at `dir` on `port` of this machine as the site will be served (its Vercel configuration and its Routing Middleware): an end
 * slash first (`trailingSlash: false`, a 308), then the middleware, for the addresses it is asked about (`middleware.ts`: its redirect answered as it is, the headers it lets a request through with
 * added to the file's); then the file (`fileFor`), compressed where the host compresses (`COMPRESSED`) for a browser that takes gzip, with the
 * headers vercel.json gives it (`headersOf`: the worker's, the app's chunks') and otherwise the host's caching (`HOST_CACHING`), so the service worker
 * may keep it. The server, once it listens. Port 0 is any free port.
 */
export function serveExport(dir: string, port: number): Promise<Server> {
  const server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
      // Vercel's `trailingSlash: false`, its first route: the address without its end slash, the query kept.
      const slashed = HOST_CONFIG.trailingSlash === false ? /^\/(.*)\/$/.exec(url.pathname) : null;
      if (slashed) {
        response.writeHead(308, { location: `/${slashed[1]}${url.search}` });
        response.end();
        return;
      }
      const added: Record<string, string> = {};
      if (MIDDLEWARE_ASKED.test(url.pathname)) {
        const headers = new Headers();
        for (const [key, value] of Object.entries(request.headers)) if (typeof value === 'string') headers.set(key, value);
        const answer = await middleware(new Request(url, { method: request.method, headers }));
        if (answer.headers.get('x-middleware-next') !== '1') {
          response.writeHead(answer.status, Object.fromEntries(answer.headers));
          response.end(Buffer.from(await answer.arrayBuffer()));
          return;
        }
        for (const [key, value] of answer.headers) if (!key.startsWith('x-middleware-')) added[key] = value;
      }
      if (url.pathname.startsWith(VERCEL_OWN)) {
        // Vercel's own addresses, which no build writes (Web Analytics: its script, and the visits it sends): a stand-in that counts nothing.
        response.writeHead(200, { 'content-type': TYPES['.js'], 'cache-control': HOST_CACHING });
        response.end(url.pathname.endsWith('.js') ? '/* Vercel Web Analytics, not on this machine */' : '');
        return;
      }
      const file = request.method === 'GET' || request.method === 'HEAD' ? fileFor(dir, url.pathname) : null;
      if (file === null) {
        response.writeHead(404, { 'content-type': TYPES['.txt'], ...added });
        response.end('not found');
        return;
      }
      const gzip = COMPRESSED.test(file.type) && /\bgzip\b/.test(String(request.headers['accept-encoding'] ?? ''));
      const given = { 'cache-control': HOST_CACHING, ...headersOf(url.pathname) };
      response.writeHead(file.status ?? 200, { 'content-type': file.type, ...given, ...added, ...(gzip ? { 'content-encoding': 'gzip', vary: 'Accept-Encoding' } : null) });
      if (request.method === 'HEAD') response.end();
      else if (gzip) createReadStream(file.path).pipe(createGzip()).pipe(response);
      else createReadStream(file.path).pipe(response);
    })().catch((error: unknown) => {
      if (!response.headersSent) response.writeHead(500, { 'content-type': TYPES['.txt'] });
      response.end(String(error));
    });
  });
  return new Promise((done, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', () => done(server));
  });
}
