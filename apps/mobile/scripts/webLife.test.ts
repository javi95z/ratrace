import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { get } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { expect, test } from 'vitest';
import { appWebOf, fileFor, onThisMachine, projectNamed, serveExport } from './webLife';

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

test('the export is served as the site will serve it: every route the app\'s page, its files as they are, the older rules as scripts', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ratrace-export-'));
  try {
    mkdirSync(join(dir, '_expo/static/js/web'), { recursive: true });
    mkdirSync(join(dir, 'rules'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>app</title>');
    writeFileSync(join(dir, '_expo/static/js/web/entry-abc.js'), 'console.log(1)');
    writeFileSync(join(dir, 'rules/v0.40.0-1.44.0.js'), 'export default 1');
    // What is asked, and what answers: the file, or the app's page for a route of the app's (any path that names no file).
    expect(fileFor(dir, '/')).toEqual({ path: join(dir, 'index.html'), type: 'text/html; charset=utf-8' });
    expect(fileFor(dir, '/play')).toEqual({ path: join(dir, 'index.html'), type: 'text/html; charset=utf-8' });
    expect(fileFor(dir, '/en/room')).toEqual({ path: join(dir, 'index.html'), type: 'text/html; charset=utf-8' });
    expect(fileFor(dir, '/_expo/static/js/web/entry-abc.js')).toEqual({ path: join(dir, '_expo/static/js/web/entry-abc.js'), type: 'text/javascript; charset=utf-8' });
    expect(fileFor(dir, '/rules/v0.40.0-1.44.0.js')?.type).toBe('text/javascript; charset=utf-8');
    // A file that is not there is not the page: an older rules file missing must fail as it does on the site, not be answered with HTML.
    expect(fileFor(dir, '/rules/v9.9.9-9.9.9.js')).toBeNull();
    // Never a file outside the export.
    expect(fileFor(dir, '/../../etc/passwd')).not.toEqual(expect.objectContaining({ path: '/etc/passwd' }));
    expect(fileFor(dir, '/%2e%2e/%2e%2e/etc/hosts')).toBeNull();

    const server = await serveExport(dir, 0);
    try {
      const port = (server.address() as AddressInfo).port;
      const page = await fetch(`http://127.0.0.1:${port}/records?x=1`);
      expect([page.status, page.headers.get('content-type'), await page.text()]).toEqual([200, 'text/html; charset=utf-8', '<!doctype html><title>app</title>']);
      const rules = await fetch(`http://127.0.0.1:${port}/rules/v0.40.0-1.44.0.js`);
      expect([rules.status, rules.headers.get('content-type')]).toEqual([200, 'text/javascript; charset=utf-8']);
      expect((await fetch(`http://127.0.0.1:${port}/rules/v9.9.9-9.9.9.js`)).status).toBe(404);
    } finally {
      await new Promise((done) => server.close(done));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a static export is served page by page, as a static host with clean addresses serves it: each page its own HTML, any other address the page of nothing', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ratrace-export-'));
  try {
    mkdirSync(join(dir, 'en'));
    writeFileSync(join(dir, 'index.html'), 'bare');
    writeFileSync(join(dir, 'en/index.html'), 'front door');
    writeFileSync(join(dir, 'en/play.html'), 'play');
    writeFileSync(join(dir, '+not-found.html'), 'nothing here');
    const html = 'text/html; charset=utf-8';
    expect(fileFor(dir, '/')).toEqual({ path: join(dir, 'index.html'), type: html });
    expect(fileFor(dir, '/en')).toEqual({ path: join(dir, 'en/index.html'), type: html });
    expect(fileFor(dir, '/en/')).toEqual({ path: join(dir, 'en/index.html'), type: html });
    expect(fileFor(dir, '/en/play')).toEqual({ path: join(dir, 'en/play.html'), type: html });
    // An address of no page: the router's page of nothing, as the site answers it, not the bare address's page (which would lead to the front door).
    expect(fileFor(dir, '/de/play')).toEqual({ path: join(dir, '+not-found.html'), type: html, status: 404 });
    expect(fileFor(dir, '/en/nowhere')).toEqual({ path: join(dir, '+not-found.html'), type: html, status: 404 });
    // Still never a file outside the export, and a file that is not there is still not a page.
    expect(fileFor(dir, '/%2e%2e/%2e%2e/etc/hosts')).toBeNull();
    expect(fileFor(dir, '/en/play.js')).toBeNull();

    const server = await serveExport(dir, 0);
    try {
      const port = (server.address() as AddressInfo).port;
      const play = await fetch(`http://127.0.0.1:${port}/en/play?x=1`);
      expect([play.status, await play.text()]).toEqual([200, 'play']);
      const nowhere = await fetch(`http://127.0.0.1:${port}/de/play`);
      expect([nowhere.status, nowhere.headers.get('content-type'), await nowhere.text()]).toEqual([404, html, 'nothing here']);
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
  // The export is made here, with no project in its environment (the size check's own), and served on the app's web's port.
  expect(script).toContain('exportEnv(process.env)');
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
