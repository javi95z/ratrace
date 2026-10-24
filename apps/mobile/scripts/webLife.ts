import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, relative, resolve } from 'node:path';

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

/**
 * The file of the export at `dir` that answers `pathname`, as the site will answer it: the file itself where there is one; the app's page
 * (`index.html`, the router finds the route) for any path that names no file (`/play`, `/en/room`); and nothing (404) for a file that is not there,
 * so that a missing older rules file fails as it does on the site instead of being answered with the page. Never a file outside `dir`.
 */
export function fileFor(dir: string, pathname: string): { path: string; type: string } | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const path = resolve(dir, `.${decoded.startsWith('/') ? decoded : `/${decoded}`}`);
  if (relative(dir, path).startsWith('..')) return null;
  const page = { path: join(dir, 'index.html'), type: TYPES['.html'] };
  const found = existsSync(path) ? statSync(path) : null;
  if (found?.isFile()) return { path, type: TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream' };
  if (found?.isDirectory() && existsSync(join(path, 'index.html'))) return { path: join(path, 'index.html'), type: TYPES['.html'] };
  // A path that names a file (it has an ending) and finds none is not a route of the app's.
  return /\.[A-Za-z0-9]+$/.test(decoded) ? null : page;
}

/** Serves the export at `dir` on `port` of this machine (`fileFor`), as the site will; the server, once it listens. Port 0 is any free port. */
export function serveExport(dir: string, port: number): Promise<Server> {
  const server = createServer((request, response) => {
    const file = request.method === 'GET' || request.method === 'HEAD' ? fileFor(dir, new URL(request.url ?? '/', 'http://localhost').pathname) : null;
    if (file === null) {
      response.writeHead(404, { 'content-type': TYPES['.txt'] });
      response.end('not found');
      return;
    }
    response.writeHead(200, { 'content-type': file.type, 'cache-control': 'no-store' });
    if (request.method === 'HEAD') response.end();
    else createReadStream(file.path).pipe(response);
  });
  return new Promise((done, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', () => done(server));
  });
}
