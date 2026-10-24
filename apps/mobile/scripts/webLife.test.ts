import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { get } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { expect, test } from 'vitest';
import { appWebOf, fakeEnv, fileFor, onThisMachine, projectNamed, projectsInSite, serveExport, siteOf } from './webLife';

test('the whole life runs offline: a page given a project is found, and only this machine is asked', () => {
  expect(projectNamed({ EXPO_PUBLIC_PROJECT_ROOT: '/apps/mobile' })).toBeNull();
  expect(projectNamed({ EXPO_PUBLIC_SUPABASE_URL: '', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined })).toBeNull();
  expect(projectNamed({ EXPO_PUBLIC_SUPABASE_URL: 'https://abcdefghij.supabase.co' })).toBe('EXPO_PUBLIC_SUPABASE_URL');
  expect(projectNamed({ EXPO_PUBLIC_SUPABASE_URL: 'u', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'k' })).toBe('EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  expect(onThisMachine('http://localhost:8091/scene')).toBe(true);
  expect(onThisMachine('http://127.0.0.1:8093/ready')).toBe(true);
  expect(onThisMachine('https://abcdefghij.supabase.co/auth/v1/token')).toBe(false);
  const script = readFileSync(new URL('./web-life.ts', import.meta.url), 'utf8');
  expect(script).toContain('const named = projectNamed(env);');
  expect(script).toContain("const fromAppWeb = asked.filter((line) => line.startsWith(`${APP_WEB_PORT}:`));");
});

test('the site is served as Vercel serves it (vercel.json): its files as they are, each page its own HTML, any other address its page of nothing', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ratrace-export-'));
  try {
    for (const folder of ['_expo/static/js/web', 'rules', 'en', 'assets/__node_modules/.pnpm/face@1/files']) mkdirSync(join(dir, folder), { recursive: true });
    writeFileSync(join(dir, 'index.html'), 'bare');
    writeFileSync(join(dir, 'en/index.html'), 'front door');
    writeFileSync(join(dir, 'en/play.html'), 'play');
    writeFileSync(join(dir, 'offline.html'), 'offline');
    writeFileSync(join(dir, '404.html'), 'nothing here');
    writeFileSync(join(dir, '_expo/static/js/web/entry-abc.js'), 'console.log(1)');
    writeFileSync(join(dir, 'rules/v0.40.0-1.44.0.js'), 'export default 1');
    writeFileSync(join(dir, 'assets/__node_modules/.pnpm/face@1/files/face.abc.ttf'), 'face');
    const html = 'text/html; charset=utf-8';
    // A file of the export is itself, wherever it is (a typeface under a folder whose name begins with a dot among them).
    expect(fileFor(dir, '/_expo/static/js/web/entry-abc.js')).toEqual({ path: join(dir, '_expo/static/js/web/entry-abc.js'), type: 'text/javascript; charset=utf-8' });
    expect(fileFor(dir, '/rules/v0.40.0-1.44.0.js')?.type).toBe('text/javascript; charset=utf-8');
    expect(fileFor(dir, '/assets/__node_modules/.pnpm/face@1/files/face.abc.ttf')).toEqual({ path: join(dir, 'assets/__node_modules/.pnpm/face@1/files/face.abc.ttf'), type: 'font/ttf' });
    // The offline page is its own address, as the worker keeps it: never led elsewhere (a clean address would lead /offline.html to /offline).
    expect(fileFor(dir, '/offline.html')).toEqual({ path: join(dir, 'offline.html'), type: html });
    // A page by its address (vercel.json's rewrites): /en its front door, /en/play its own HTML.
    expect(fileFor(dir, '/en')).toEqual({ path: join(dir, 'en/index.html'), type: html });
    expect(fileFor(dir, '/en/')).toEqual({ path: join(dir, 'en/index.html'), type: html });
    expect(fileFor(dir, '/en/play')).toEqual({ path: join(dir, 'en/play.html'), type: html });
    // Any other address: the site's page of nothing, with a 404, a missing older rules file among them (it fails as it does on the site).
    for (const nowhere of ['/de/play', '/en/nowhere', '/play', '/rules/v9.9.9-9.9.9.js', '/en/play.js']) expect(fileFor(dir, nowhere), nowhere).toEqual({ path: join(dir, '404.html'), type: html, status: 404 });
    // Never a file outside the export.
    expect(fileFor(dir, '/../../etc/passwd')).not.toEqual(expect.objectContaining({ path: '/etc/passwd' }));
    expect(fileFor(dir, '/%2e%2e/%2e%2e/etc/hosts')).toBeNull();

    const server = await serveExport(dir, 0);
    try {
      const port = (server.address() as AddressInfo).port;
      const play = await fetch(`http://127.0.0.1:${port}/en/play?x=1`);
      expect([play.status, await play.text()]).toEqual([200, 'play']);
      const nowhere = await fetch(`http://127.0.0.1:${port}/de/play`);
      expect([nowhere.status, nowhere.headers.get('content-type'), await nowhere.text()]).toEqual([404, html, 'nothing here']);
      const rules = await fetch(`http://127.0.0.1:${port}/rules/v0.40.0-1.44.0.js`);
      expect([rules.status, rules.headers.get('content-type')]).toEqual([200, 'text/javascript; charset=utf-8']);
      expect((await fetch(`http://127.0.0.1:${port}/rules/v9.9.9-9.9.9.js`)).status).toBe(404);
      const offline = await fetch(`http://127.0.0.1:${port}/offline.html`, { redirect: 'manual' });
      expect([offline.status, await offline.text()]).toEqual([200, 'offline']);
      // Vercel's own Web Analytics, which the production page loads: there on Vercel, a stand-in that counts nothing here.
      const analytics = await fetch(`http://127.0.0.1:${port}/_vercel/insights/script.js`);
      expect([analytics.status, analytics.headers.get('content-type')]).toEqual([200, 'text/javascript; charset=utf-8']);
    } finally {
      await new Promise((done) => server.close(done));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an address ending in a slash is led to the same address without it (308), as Vercel does with trailingSlash false and the Next web does', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ratrace-export-'));
  try {
    mkdirSync(join(dir, 'en'));
    writeFileSync(join(dir, 'en/play.html'), 'play');
    writeFileSync(join(dir, '404.html'), 'nothing here');
    // Matched as Vercel matches a rewrite, strictly: the slash is not taken off by the file's lookup.
    expect(fileFor(dir, '/en/play/')).toEqual({ path: join(dir, '404.html'), type: 'text/html; charset=utf-8', status: 404 });
    const server = await serveExport(dir, 0);
    try {
      const at = (path: string) => `http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`;
      for (const [from, to] of [['/en/play/', '/en/play'], ['/es/room/?code=ABC123', '/es/room?code=ABC123'], ['/play/', '/play']]) {
        const answer = await fetch(at(from), { redirect: 'manual' });
        expect([answer.status, answer.headers.get('location')], from).toEqual([308, to]);
      }
      const followed = await fetch(at('/en/play/'));
      expect([followed.status, await followed.text()]).toEqual([200, 'play']);
    } finally {
      await new Promise((done) => server.close(done));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the site applies its Routing Middleware first, as Vercel does: the bare address to a language, the language of a page opened kept', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ratrace-export-'));
  try {
    mkdirSync(join(dir, 'es'));
    writeFileSync(join(dir, 'index.html'), 'bare');
    writeFileSync(join(dir, 'es/play.html'), 'play');
    writeFileSync(join(dir, 'sw.js'), '');
    const server = await serveExport(dir, 0);
    try {
      const at = (path: string) => `http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`;
      const bare = await fetch(at('/?code=ABC123'), { redirect: 'manual', headers: { cookie: 'NEXT_LOCALE=es', 'accept-language': 'ru' } });
      expect([bare.status, bare.headers.get('location')]).toEqual([307, at('/es?code=ABC123')]);
      const first = await fetch(at('/'), { redirect: 'manual', headers: { 'accept-language': 'ru-RU,ru;q=0.9' } });
      expect(first.headers.get('location')).toBe(at('/ru'));
      // A page opened: its own HTML, and its language written into the cookie for a year.
      const page = await fetch(at('/es/play'), { headers: { 'sec-fetch-dest': 'document' } });
      expect([page.status, await page.text()]).toEqual([200, 'play']);
      expect(page.headers.get('set-cookie')).toMatch(/^NEXT_LOCALE=es; Path=\/; Expires=[^;]+; Max-Age=31536000; SameSite=lax$/);
      expect(page.headers.get('x-middleware-next')).toBeNull();
      // What the page fetches, and the export's files, are not the middleware's.
      expect((await fetch(at('/es/play'), { headers: { 'sec-fetch-dest': 'empty' } })).headers.get('set-cookie')).toBeNull();
      expect((await fetch(at('/sw.js'), { headers: { 'sec-fetch-dest': 'document' } })).headers.get('set-cookie')).toBeNull();
    } finally {
      await new Promise((done) => server.close(done));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the whole life can run on the export, and runs on the development server unless told', () => {
  expect(appWebOf([])).toBe('dev');
  expect(appWebOf(['--export'])).toBe('export');
  const script = readFileSync(new URL('./web-life.ts', import.meta.url), 'utf8');
  // The site is built here as Vercel builds it, with no project in its environment (the size check's own), or the one given is served, offline,
  // and served on the app's web's port.
  expect(script).toContain('buildSite(dir, exportEnv(process.env))');
  expect(script).toContain('projectsInSite(given)');
  expect(script).toContain('serveExport(');
  // And a new visitor's first page on it is weighed with what its first draw fetches after the HTML, and held to the first page's gate.
  expect(script).toContain('problems.push(...judgeFirstVisit(files, scripts));');
});

/** A file of the served export as the browser is sent it: its encoding and its bytes, asked with (or without) `Accept-Encoding: gzip`. */
function sent(port: number, path: string, gzip: boolean): Promise<{ encoding: string | undefined; vary: string | undefined; body: Buffer }> {
  return new Promise((done, fail) => {
    get({ host: '127.0.0.1', port, path, headers: gzip ? { 'accept-encoding': 'gzip, deflate, br' } : {} }, (response) => {
      const parts: Buffer[] = [];
      response.on('data', (part: Buffer) => parts.push(part));
      response.on('end', () => done({ encoding: response.headers['content-encoding'], vary: response.headers.vary, body: Buffer.concat(parts) }));
    }).on('error', fail);
  });
}

test('the export is sent compressed, as the site\'s host sends it, to a browser that takes gzip: its pages, scripts and typefaces, not its pictures', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ratrace-export-'));
  try {
    mkdirSync(join(dir, 'en'));
    mkdirSync(join(dir, 'sprites'));
    const script = 'console.log("the same line, again and again");\n'.repeat(200);
    writeFileSync(join(dir, 'en/index.html'), '<!doctype html><title>en</title>');
    writeFileSync(join(dir, 'entry.js'), script);
    writeFileSync(join(dir, 'face.ttf'), Buffer.alloc(4000, 7));
    writeFileSync(join(dir, 'sprites/coin.png'), Buffer.from([137, 80, 78, 71]));
    const server = await serveExport(dir, 0);
    try {
      const port = (server.address() as AddressInfo).port;
      const js = await sent(port, '/entry.js', true);
      expect([js.encoding, js.vary]).toEqual(['gzip', 'Accept-Encoding']);
      expect(js.body.length).toBeLessThan(script.length / 10);
      expect(gunzipSync(js.body).toString('utf8')).toBe(script);
      expect((await sent(port, '/en', true)).encoding).toBe('gzip');
      expect((await sent(port, '/face.ttf', true)).encoding).toBe('gzip');
      // A picture is sent as it is (it is compressed already), and so is anything to a browser that does not take gzip.
      const png = await sent(port, '/sprites/coin.png', true);
      expect([png.encoding, [...png.body]]).toEqual([undefined, [137, 80, 78, 71]]);
      const plain = await sent(port, '/entry.js', false);
      expect([plain.encoding, plain.body.toString('utf8')]).toEqual([undefined, script]);
    } finally {
      await new Promise((done) => server.close(done));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the worker is sent as the Next web sends it (vercel.json\'s headers), never kept by the browser, and the rest as the site\'s host sends its files', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ratrace-export-'));
  try {
    mkdirSync(join(dir, 'en'));
    writeFileSync(join(dir, 'sw.js'), "self.addEventListener('fetch', () => undefined);");
    writeFileSync(join(dir, 'en/index.html'), '<!doctype html><title>en</title>');
    mkdirSync(join(dir, '_expo/static/js/web'), { recursive: true });
    writeFileSync(join(dir, '_expo/static/js/web/entry-abc.js'), 'console.log(1)');
    const server = await serveExport(dir, 0);
    try {
      const port = (server.address() as AddressInfo).port;
      const worker = await fetch(`http://127.0.0.1:${port}/sw.js`);
      // apps/web/next.config.ts's headers for /sw.js, verbatim.
      expect([worker.status, worker.headers.get('content-type'), worker.headers.get('cache-control'), worker.headers.get('service-worker-allowed')]).toEqual([
        200, 'text/javascript; charset=utf-8', 'no-cache, no-store, must-revalidate', '/',
      ]);
      // A page is the host's ordinary answer (Vercel's for a static file): the worker may keep it.
      const page = await fetch(`http://127.0.0.1:${port}/en`);
      expect([page.headers.get('cache-control'), page.headers.get('service-worker-allowed')]).toEqual(['public, max-age=0, must-revalidate', null]);
      // The app's chunks, named by what they hold, are kept for good, as the Next web's `_next/static`.
      const chunk = await fetch(`http://127.0.0.1:${port}/_expo/static/js/web/entry-abc.js`);
      expect(chunk.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    } finally {
      await new Promise((done) => server.close(done));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a run is told the site it serves, already built, and refuses one that would sign in anywhere', () => {
  expect(siteOf(['--export'])).toBeNull();
  expect(siteOf(['--export', '--site=/tmp/dist'])).toBe('/tmp/dist');
  const dir = mkdtempSync(join(tmpdir(), 'ratrace-site-'));
  try {
    mkdirSync(join(dir, '_expo/static/js/web'), { recursive: true });
    writeFileSync(join(dir, '_expo/static/js/web/entry-abc.js'), 'const url = "";');
    expect(projectsInSite(dir)).toEqual([]);
    writeFileSync(join(dir, '_expo/static/js/web/entry-def.js'), 'const url = "https://abcdefghij.supabase.co", fake = "http://127.0.0.1:54399";');
    expect(projectsInSite(dir)).toEqual(['http://127.0.0.1:54399', 'https://abcdefghij.supabase.co']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the site built for the fake project names it, and no live setting: the address and key of this machine\'s, given to the build by name', () => {
  const env = fakeEnv({ EXPO_PUBLIC_SUPABASE_URL: 'https://abcdefghij.supabase.co', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_live', EXPO_PUBLIC_TURNSTILE_SITE_KEY: '0x4AAA', PATH: '/bin' });
  expect(env).toMatchObject({ EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54399', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fake_local_only', EXPO_PUBLIC_TURNSTILE_SITE_KEY: '', PATH: '/bin' });
  const script = readFileSync(new URL('./web-signin.ts', import.meta.url), 'utf8');
  expect(script).toContain('buildSite(dir, fakeEnv(process.env))');
  // Named, not loaded: the offline checks that import this module never load the fake project (its servers, the edge functions' code).
  const checks = readFileSync(new URL('./webLife.ts', import.meta.url), 'utf8');
  expect(checks).toContain("from './fakeProject'");
  expect(checks).not.toContain("from './fakeCloud'");
  expect(script).toContain('refuseServerInUse(');
});
