import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { CONTENT_VERSION } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import { LOCALES } from '@ratrace/i18n/locales';
import { describe, expect, it } from 'vitest';
import { PAGES } from '../src/game/pageList';
import { serviceWorker as nextWebWorker } from '../../web/scripts/pwa';
import { cacheVersion, NOTICES, precacheOf, serviceWorker, WORKER_PARTS, writeServiceWorker } from './serviceWorker';

const ORIGIN = 'http://localhost:8091';
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

/** What the worker is given of a request: its method, mode and address (a navigation's mode cannot be made with Node's own `Request`). */
interface Asked {
  url: string;
  method: string;
  mode: string;
  cache?: string;
  credentials?: string;
}

type Listener = (event: Record<string, unknown>) => void;

/** A window of the site open in the browser, as the worker sees it (`WindowClient`): where it is, whether it is in front, and what it was told to do. */
interface OpenWindow {
  url: string;
  visibilityState: 'visible' | 'hidden';
  focused: number;
  navigated: string[];
}

/** A notice in the tray (`Notification`): its tag, and whether the worker took it down. */
interface Shown {
  title: string;
  options: { body?: string; tag?: string; icon?: string; badge?: string; data?: { url?: string } };
  closed: boolean;
}

/**
 * The generated worker, run as a browser runs it, over a browser's pieces made in memory: its caches (`CacheStorage`), the network (`network`:
 * the answer to an address, or a throw when offline), its clients (`windows`, the site's open windows; `opened`, the addresses it opened a window
 * for) and its registration (`tray`, the notices shown). What it does is read off them.
 */
function workerOn(code: string, network: (url: URL) => Response | Promise<Response>, options: { language?: string; windows?: Array<Partial<OpenWindow>> } = {}) {
  const listeners = new Map<string, Listener>();
  const store = new Map<string, Map<string, Response>>();
  const keyOf = (request: string | Asked) => new URL(typeof request === 'string' ? request : request.url, ORIGIN).href;
  const asked: Asked[] = [];
  const fetchOf = async (request: string | Asked): Promise<Response> => {
    const one: Asked = typeof request === 'string' ? { url: keyOf(request), method: 'GET', mode: 'cors' } : request;
    asked.push(one);
    return network(new URL(one.url));
  };
  const entriesOf = (name: string) => {
    let entries = store.get(name);
    if (!entries) store.set(name, (entries = new Map()));
    return entries;
  };
  const open = (name: string) => {
    const entries = entriesOf(name);
    return {
      put: async (request: string | Asked, response: Response) => void entries.set(keyOf(request), response),
      match: async (request: string | Asked) => entries.get(keyOf(request))?.clone(),
      add: async (request: Asked) => {
        const response = await fetchOf(request);
        if (!response.ok) throw new TypeError(`${response.status}`);
        entries.set(keyOf(request), response);
      },
    };
  };
  const caches = {
    open: async (name: string) => open(name),
    keys: async () => [...store.keys()],
    delete: async (name: string) => store.delete(name),
    match: async (request: string | Asked, given: { cacheName?: string } = {}) => {
      for (const name of given.cacheName ? [given.cacheName] : [...store.keys()]) {
        const found = store.get(name)?.get(keyOf(request));
        if (found) return found.clone();
      }
      return undefined;
    },
  };
  class WorkerRequest {
    url: string;
    method = 'GET';
    mode = 'cors';
    constructor(url: string, init: object = {}) {
      this.url = keyOf(url);
      Object.assign(this, init);
    }
  }
  const told = { claimed: 0, preload: 0 };
  const windows: OpenWindow[] = (options.windows ?? []).map((one) => ({ url: `${ORIGIN}/en`, visibilityState: 'hidden', focused: 0, navigated: [], ...one }));
  const opened: string[] = [];
  const tray: Shown[] = [];
  const self = {
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    location: new URL(ORIGIN),
    navigator: { language: options.language ?? 'en-US' },
    clients: {
      claim: async () => void (told.claimed += 1),
      matchAll: async () =>
        windows.map((one) => ({
          url: one.url,
          visibilityState: one.visibilityState,
          focus: async () => void (one.focused += 1),
          navigate: async (to: string) => void one.navigated.push(to),
        })),
      openWindow: async (to: string) => void opened.push(to),
    },
    registration: {
      navigationPreload: { enable: async () => void (told.preload += 1) },
      showNotification: async (title: string, shown: Shown['options']) => void tray.push({ title, options: shown, closed: false }),
      getNotifications: async ({ tag }: { tag?: string } = {}) => tray.filter((one) => !one.closed && (tag === undefined || one.options.tag === tag)).map((one) => ({ close: () => void (one.closed = true) })),
    },
  };
  new Function('self', 'caches', 'fetch', 'Request', code)(self, caches, fetchOf, WorkerRequest);

  /** An event the browser gives the worker, and what the worker made it wait for. */
  const dispatch = async (type: string, fields: Record<string, unknown> = {}) => {
    const waits: Promise<unknown>[] = [];
    let answer: Promise<Response> | undefined;
    listeners.get(type)?.({ ...fields, waitUntil: (promise: Promise<unknown>) => waits.push(promise), respondWith: (promise: Promise<Response>) => (answer = promise) });
    const response = answer ? await answer : undefined;
    await Promise.all(waits);
    return response;
  };
  /** A request the page makes: a navigation, or a file of the site (by default), and the worker's answer (none: the browser's own network). */
  const request = (path: string, mode = 'no-cors', method = 'GET') =>
    dispatch('fetch', { request: { url: new URL(path, ORIGIN).href, method, mode }, preloadResponse: Promise.resolve(undefined) });
  /** A notice arriving as the push service delivers it (`data`: its JSON, or anything else), and the player's tap on a notice carrying `data`. */
  const push = (data?: unknown) => dispatch('push', { data: data === undefined ? null : { json: () => (typeof data === 'string' ? JSON.parse(data) : data) } });
  const click = (data: unknown) => {
    const notification = { data, closed: false, close: () => void (notification.closed = true) };
    return dispatch('notificationclick', { notification }).then(() => notification);
  };
  return { listeners, store, asked, told, windows, opened, tray, push, click, dispatch, request, cached: (name: string, path: string) => store.get(name)?.has(new URL(path, ORIGIN).href) ?? false };
}

/** The site's answer to every address while online: its path, as text. */
const online = (url: URL) => new Response(`page ${url.pathname}`, { headers: { 'content-type': 'text/html' } });
const offline = (): Response => {
  throw new TypeError('Failed to fetch');
};

const VERSION = 'test-version';
const CACHE = `ratrace-${VERSION}`;

describe("the app's web's worker, the Next web's own", () => {
  it('names its cache from the versions and what the files hold', () => {
    const files = new Map([['/sprites/coin.png', Buffer.from([1, 2, 3])], ['/en', Buffer.from('front door')]]);
    const version = cacheVersion([...files.keys()], (asset) => files.get(asset) as Buffer);
    expect(version).toMatch(new RegExp(`^${ENGINE_VERSION.replace(/\./g, '\\.')}-${CONTENT_VERSION.replace(/\./g, '\\.')}-[0-9a-f]{12}$`));
    // The same files, the same cache; a sprite drawn again under the same name, or another file, a new one (the old one goes on activate).
    expect(cacheVersion([...files.keys()].reverse(), (asset) => files.get(asset) as Buffer)).toBe(version);
    expect(cacheVersion([...files.keys()], (asset) => (asset === '/sprites/coin.png' ? Buffer.from([1, 2, 4]) : (files.get(asset) as Buffer)))).not.toBe(version);
    expect(cacheVersion([...files.keys(), '/icons/icon-192.png'], (asset) => files.get(asset) ?? Buffer.alloc(0))).not.toBe(version);
    expect(serviceWorker(version, ['/en'])).toContain(`const CACHE = CACHE_PREFIX + ${JSON.stringify(version)};`);
    expect(serviceWorker(version, ['/en'])).toContain("const CACHE_PREFIX = 'ratrace-';");
  });

  it('precaches every page in every language, the site\'s files and the export\'s static chunks, and nothing that is not served or not a page', () => {
    const files = [
      'index.html', 'en/index.html', 'en/play.html', '[locale]/play.html', '[locale].html', '+not-found.html', 'scene.html', '_sitemap.html', 'sw.js', 'sitemap.xml',
      'robots.txt', 'manifest.webmanifest', 'offline.html', 'favicon.ico', 'og.png', 'icons/icon-192.png', 'sprites/brand/brand.mascot.png', 'rules/v0.30.0-1.30.0.js',
      '_expo/.routes.json', '_expo/static/js/web/es-2e38.js', '_expo/static/js/web/_layout-9f1b.js', '_expo/static/js/web/_layout-9f1b.js.map', '_expo/static/css/web-ab12.css',
      'assets/assets/fonts/Jersey15_400Regular.54b3.ttf', 'assets/assets/sounds/coin.2b0c.wav', 'sprites/.DS_Store',
    ];
    const assets = precacheOf(files);
    const pages = LOCALES.flatMap((locale) => PAGES.map((page) => `/${locale}${page === '' ? '' : `/${page}`}`));
    expect(pages).toHaveLength(30);
    expect(assets).toEqual(expect.arrayContaining([...pages, '/manifest.webmanifest', '/offline.html', '/favicon.ico', '/og.png', '/icons/icon-192.png']));
    expect(assets).toEqual(expect.arrayContaining(['/sprites/brand/brand.mascot.png', '/rules/v0.30.0-1.30.0.js', '/_expo/static/js/web/es-2e38.js', '/_expo/static/js/web/_layout-9f1b.js']));
    expect(assets).toEqual(expect.arrayContaining(['/_expo/static/css/web-ab12.css', '/assets/assets/fonts/Jersey15_400Regular.54b3.ttf', '/assets/assets/sounds/coin.2b0c.wav']));
    // Pages by their address, never their file; nothing that is not one of the game's pages, nor the worker, a map, a hidden file or what is for search engines.
    for (const left of ['/index.html', '/en/index.html', '/en/play.html', '/[locale]/play.html', '/[locale].html', '/+not-found.html', '/scene.html', '/_sitemap.html', '/sw.js', '/sitemap.xml', '/robots.txt', '/_expo/.routes.json', '/_expo/static/js/web/_layout-9f1b.js.map', '/sprites/.DS_Store', '/']) {
      expect(assets).not.toContain(left);
    }
    expect(new Set(assets).size).toBe(assets.length);
  });

  it('installs with every file precached in batches of 16, as a fresh copy with no cookies, a file that fails left out', async () => {
    const assets = Array.from({ length: 40 }, (_, i) => `/sprites/s${i}.png`);
    let inFlight = 0;
    let most = 0;
    const worker = workerOn(serviceWorker(VERSION, assets), async (url) => {
      most = Math.max(most, (inFlight += 1));
      await new Promise((done) => setTimeout(done, 1));
      inFlight -= 1;
      return url.pathname === '/sprites/s7.png' ? new Response('', { status: 404 }) : online(url);
    });
    await worker.dispatch('install');
    expect(worker.asked).toHaveLength(40);
    expect(most).toBe(16);
    expect(worker.asked.every((one) => one.credentials === 'omit' && one.cache === 'reload')).toBe(true);
    expect(worker.cached(CACHE, '/sprites/s6.png')).toBe(true);
    expect(worker.cached(CACHE, '/sprites/s7.png')).toBe(false);
    expect(worker.cached(CACHE, '/sprites/s39.png')).toBe(true);
  });

  it('leaves to the network a navigation with a query (an invitation, Google\'s code), what is not a GET, another host\'s and /api/', async () => {
    const worker = workerOn(serviceWorker(VERSION, []), online);
    expect(await worker.request('/es/room?code=ABC123', 'navigate')).toBeUndefined();
    expect(await worker.request('/en?code=oauth-once', 'navigate')).toBeUndefined();
    expect(await worker.request('/en', 'navigate', 'POST')).toBeUndefined();
    expect(await worker.request('https://abcdefghij.supabase.co/rest/v1/runs')).toBeUndefined();
    expect(await worker.request('/api/anything')).toBeUndefined();
    expect(worker.asked).toHaveLength(0);
    expect([...worker.store.values()].every((entries) => entries.size === 0)).toBe(true);
  });

  it('opens a page fresh from the network, keeps it and the language it is in, and serves it from the cache offline', async () => {
    let network: (url: URL) => Response = online;
    const worker = workerOn(serviceWorker(VERSION, []), (url) => network(url));
    expect(await (await worker.request('/es/records', 'navigate'))?.text()).toBe('page /es/records');
    expect(worker.cached(CACHE, '/es/records')).toBe(true);
    expect(await (await worker.store.get('rat-race-language')?.get(`${ORIGIN}/__language`))?.clone().text()).toBe('es');
    network = offline;
    expect(await (await worker.request('/es/records', 'navigate'))?.text()).toBe('page /es/records');
  });

  it('opens the bare address offline in the language last played, else the browser\'s, and any page it never kept as /offline.html', async () => {
    const pages = (worker: ReturnType<typeof workerOn>, paths: string[]) => worker.store.set(CACHE, new Map(paths.map((path) => [`${ORIGIN}${path}`, new Response(`kept ${path}`)])));
    // The player last played in Spanish, the browser speaks English: `/` is the Spanish front door.
    const played = workerOn(serviceWorker(VERSION, ['/en', '/es', '/offline.html']), online);
    await played.dispatch('install');
    await played.request('/es/new', 'navigate');
    const away = workerOn(serviceWorker(VERSION, []), offline);
    away.store.set(CACHE, played.store.get(CACHE) as Map<string, Response>);
    away.store.set('rat-race-language', played.store.get('rat-race-language') as Map<string, Response>);
    expect(await (await away.request('/', 'navigate'))?.text()).toBe('page /es');
    // A page never kept: the offline page.
    expect(await (await away.request('/en/nowhere', 'navigate'))?.text()).toBe('page /offline.html');
    // No language kept: the browser's.
    const fresh = workerOn(serviceWorker(VERSION, []), offline, { language: 'ru-RU' });
    pages(fresh, ['/ru', '/en', '/offline.html']);
    expect(await (await fresh.request('/', 'navigate'))?.text()).toBe('kept /ru');
    // No front door kept at all: the offline page; and with nothing at all, the browser's own error.
    const bare = workerOn(serviceWorker(VERSION, []), offline);
    pages(bare, ['/offline.html']);
    expect(await (await bare.request('/', 'navigate'))?.text()).toBe('kept /offline.html');
    const none = workerOn(serviceWorker(VERSION, []), offline);
    expect((await none.request('/en', 'navigate'))?.type).toBe('error');
  });

  it('serves the static chunks, the files they name, the sprites, the icons and the older rules from the cache first', async () => {
    let network: (url: URL) => Response = online;
    const worker = workerOn(serviceWorker(VERSION, []), (url) => network(url));
    const files = ['/_expo/static/js/web/es-2e38.js', '/_expo/static/css/web-ab12.css', '/assets/assets/fonts/Jersey15.54b3.ttf', '/sprites/brand/brand.mascot.png', '/icons/icon-192.png', '/rules/v0.30.0-1.30.0.js'];
    for (const path of files) expect(await (await worker.request(path))?.text()).toBe(`page ${path}`);
    expect(files.every((path) => worker.cached(CACHE, path))).toBe(true);
    // Asked again, the cache answers and the network is not asked, offline or not.
    network = offline;
    const before = worker.asked.length;
    for (const path of files) expect(await (await worker.request(path))?.text()).toBe(`page ${path}`);
    expect(worker.asked.length).toBe(before);
    // A file of no rule (the share picture) is the network's.
    expect(await worker.request('/og.png')).toBeUndefined();
  });

  it('keeps no answer the site says not to keep', async () => {
    const worker = workerOn(serviceWorker(VERSION, []), () => new Response('x', { headers: { 'cache-control': 'private, no-store' } }));
    await worker.request('/sprites/coin.png');
    await worker.request('/en', 'navigate');
    expect(worker.cached(CACHE, '/sprites/coin.png')).toBe(false);
    expect(worker.cached(CACHE, '/en')).toBe(false);
  });

  it('answers the manifest and the offline page from the cache while it asks the network for a fresher copy', async () => {
    let served = 'one';
    const worker = workerOn(serviceWorker(VERSION, []), () => new Response(served));
    expect(await (await worker.request('/manifest.webmanifest'))?.text()).toBe('one');
    served = 'two';
    expect(await (await worker.request('/manifest.webmanifest'))?.text()).toBe('one');
    expect(await (await worker.request('/manifest.webmanifest'))?.text()).toBe('two');
    expect(await (await worker.request('/offline.html'))?.text()).toBe('two');
  });

  it('on activate deletes every other ratrace- cache, the Next web\'s among them, and keeps the language and what is not its own; then takes the open pages', async () => {
    const worker = workerOn(serviceWorker(VERSION, []), online);
    for (const name of ['ratrace-0.39.0-1.43.0-0123456789ab', CACHE, 'rat-race-language', 'someone-else']) worker.store.set(name, new Map());
    await worker.dispatch('activate');
    expect([...worker.store.keys()].sort()).toEqual([CACHE, 'rat-race-language', 'someone-else'].sort());
    expect(worker.told).toEqual({ claimed: 1, preload: 1 });
    // A new worker waits for the old one's pages to close: a life is never swapped under the player.
    expect(serviceWorker(VERSION, [])).not.toContain('skipWaiting');
  });

  it('is made of parts, the notices one of them, and is a script a browser reads', () => {
    expect(WORKER_PARTS).toContain(NOTICES);
    const worker = workerOn(serviceWorker(VERSION, []), online);
    expect([...worker.listeners.keys()].sort()).toEqual(['activate', 'fetch', 'install', 'notificationclick', 'push']);
    expect(() => new Function(serviceWorker(VERSION, ['/en']))).not.toThrow();
    // A worker made of other parts has only theirs.
    expect([...workerOn(serviceWorker(VERSION, [], [NOTICES]), online).listeners.keys()].sort()).toEqual(['notificationclick', 'push']);
  });

  describe('the notices', () => {
    const notice = { title: 'A new week', body: 'The challenge is open', url: '/es/challenge', tag: 'weekly' };

    it("shows a notice as the server sends it when no window of the game is in front, with the game's icon and badge, and the page it leads to", async () => {
      const worker = workerOn(serviceWorker(VERSION, []), online, { windows: [{ visibilityState: 'hidden' }] });
      await worker.push(notice);
      expect(worker.tray).toEqual([
        { title: 'A new week', closed: false, options: { body: 'The challenge is open', tag: 'weekly', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: '/es/challenge' } } },
      ]);
      // With no window open at all, the same; and a notice with no page leads to the front door.
      const away = workerOn(serviceWorker(VERSION, []), online);
      await away.push({ title: 'Hello' });
      expect(away.tray[0].options.data).toEqual({ url: '/' });
    });

    it('says nothing with the game in front of the player, and nothing of a notice with no title or one it cannot read', async () => {
      const front = workerOn(serviceWorker(VERSION, []), online, { windows: [{ visibilityState: 'hidden' }, { visibilityState: 'visible' }] });
      await front.push(notice);
      expect(front.tray).toEqual([]);
      const worker = workerOn(serviceWorker(VERSION, []), online);
      await worker.push({ body: 'no title' });
      await worker.push();
      await worker.dispatch('push', {
        data: {
          json: () => {
            throw new SyntaxError('not json');
          },
        },
      });
      expect(worker.tray).toEqual([]);
    });

    it('takes an older notice of the same tag out of the tray before the new one comes, and leaves the others', async () => {
      const worker = workerOn(serviceWorker(VERSION, []), online);
      await worker.push(notice);
      await worker.push({ title: 'A friend', tag: 'friend' });
      await worker.push({ ...notice, title: 'Last day' });
      expect(worker.tray.map((one) => [one.title, one.closed])).toEqual([
        ['A new week', true],
        ['A friend', false],
        ['Last day', false],
      ]);
    });

    it('on a tap closes the notice and focuses a window of the game that is open, taking it to the page', async () => {
      const worker = workerOn(serviceWorker(VERSION, []), online, { windows: [{ url: 'https://elsewhere.example/en' }, { url: `${ORIGIN}/en/records` }] });
      const tapped = await worker.click({ url: '/es/challenge' });
      expect(tapped.closed).toBe(true);
      expect(worker.windows.map((one) => [one.focused, one.navigated])).toEqual([[0, []], [1, [`${ORIGIN}/es/challenge`]]]);
      expect(worker.opened).toEqual([]);
    });

    it('on a tap with no window of the game open opens one at the page (the front door for a notice with none)', async () => {
      const worker = workerOn(serviceWorker(VERSION, []), online, { windows: [{ url: 'https://elsewhere.example/en' }] });
      await worker.click({ url: '/en/room?code=ABC123' });
      await worker.click(null);
      expect(worker.opened).toEqual([`${ORIGIN}/en/room?code=ABC123`, `${ORIGIN}/`]);
      expect(worker.windows[0].focused).toBe(0);
    });

    it("is the Next web's, word for word", () => {
      expect(nextWebWorker('v', [])).toContain(NOTICES.trim());
      expect(NOTICES.trim().startsWith("// The weekly notice")).toBe(true);
    });
  });

  it('writes the worker and the offline page into an export, and refuses an export that lacks a page', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ratrace-worker-'));
    try {
      const write = (path: string, text: string) => {
        mkdirSync(dirname(join(dir, path)), { recursive: true });
        writeFileSync(join(dir, path), text);
      };
      for (const locale of LOCALES) for (const page of PAGES) write(page === '' ? `${locale}/index.html` : `${locale}/${page}.html`, `${locale} ${page}`);
      write('manifest.webmanifest', '{}');
      write('_expo/static/js/web/en-1.js', 'en');
      write('sprites/brand/brand.mascot.png', 'png');
      const written = writeServiceWorker(dir);
      const worker = readFileSync(join(dir, 'sw.js'), 'utf8');
      expect(worker.startsWith('/* Generated by scripts/serviceWorker.ts. Do not edit. */')).toBe(true);
      expect(worker).toContain(`const CACHE = CACHE_PREFIX + ${JSON.stringify(written.version)};`);
      expect(written.assets).toEqual(expect.arrayContaining(['/en', '/ru/legal', '/_expo/static/js/web/en-1.js', '/sprites/brand/brand.mascot.png', '/offline.html']));
      // The offline page is the Next web's, byte for byte.
      expect(readFileSync(join(dir, 'offline.html'), 'utf8')).toBe(read('../../web/public/offline.html'));
      // A page drawn again changes the cache, so the new drawing is not hidden behind the old.
      write('es/records.html', 'es records, again');
      expect(writeServiceWorker(dir).version).not.toBe(written.version);
      rmSync(join(dir, 'ru/legal.html'));
      expect(() => writeServiceWorker(dir)).toThrow(/ru\/legal/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('carries the Next web\'s offline page as the app\'s own file', () => {
    expect(read('../public/offline.html')).toBe(read('../../web/public/offline.html'));
  });
});
