import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MESSAGES } from '@ratrace/i18n';
import { expect, test, vi } from 'vitest';

/** What the export hands the document of a page (expo-router's document context): here, as a test sets it. */
const documentData: { headNodes?: ReactNode; bodyNodes?: ReactNode } = {};
// The router's document context, as the export fills it (the real module loads the whole router, which Node cannot run here).
vi.mock('expo-router/html', () => ({ useServerDocumentContext: () => documentData }));
const { default: Document } = await import('../src/app/+html');

/*
 * The document every page of the app's web is drawn in (apps/mobile/src/app/+html.tsx: expo-router's template for the static export, each page's
 * HTML made with it) is shaped as the Next web's layout (apps/web/src/app/[locale]/layout.tsx): the page's language, the same viewport, the same colour
 * for the browser's bar, and the same page (globals.css).
 */
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const layout = read('../../web/src/app/[locale]/layout.tsx');
const globals = read('../../web/src/app/globals.css');

/** The document as the export writes it for a page whose address is `/{locale}/…` (expo-router hands the route's parameters to the template). */
const pageIn = (locale: string | undefined) =>
  renderToStaticMarkup(createElement(Document, { params: locale === undefined ? {} : { locale }, pathname: '/', children: createElement('div', { id: 'root' }) }));
const page = pageIn('en');

test('the page is in the language of its address, as the Next web\'s `<html lang={locale}>`; any other address, the default one', () => {
  expect(layout).toContain('<html lang={locale}');
  for (const locale of ['en', 'es', 'ru']) expect(pageIn(locale)).toContain(`<html lang="${locale}">`);
  expect(pageIn(undefined)).toContain('<html lang="en">');
  expect(pageIn('[locale]')).toContain('<html lang="en">');
  expect(pageIn('de')).toContain('<html lang="en">');
});

test('the page reaches under the notch and the home bar, as the Next web\'s does (`viewportFit: cover`): the safe areas are the game\'s to clear', () => {
  expect(layout).toContain("viewportFit: 'cover',");
  expect(layout).toContain("width: 'device-width',");
  expect(layout).toContain('initialScale: 1,');
  expect(page).toContain('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>');
});

test('the browser\'s bar is the colour the Next web gives it', () => {
  const colour = /themeColor: '(#[0-9a-f]{6})'/.exec(layout)?.[1];
  expect(colour).toBe('#141b33');
  expect(page).toContain(`<meta name="theme-color" content="${colour}"/>`);
});

test('the page holds the app where expo-router draws it, full height, the body not scrolled (react-native-web\'s root, as Expo\'s own template)', () => {
  expect(page).toContain('<meta charSet="utf-8"/>');
  // The script that takes the page's own address first, the words of a fault as JSON (nothing run), then the app's root.
  expect(page).toMatch(/<body><script>[^<]*<\/script><script id="ratrace-fault-words" type="application\/json">[^<]*<\/script><div id="root"><\/div><\/body>/);
  expect(page).toMatch(/html,\s*body \{\s*height: 100%;/);
  expect(page).toMatch(/body \{\s*overflow: hidden;/);
  expect(page).toMatch(/#root \{\s*display: flex;\s*height: 100%;\s*flex: 1;/);
});

test('the page is a game\'s, as the Next web\'s body says (globals.css): its text smoothed the same, nothing to select, no tap flash, no rubber band, no text grown by the phone, a dark page', () => {
  const body = globals.slice(globals.indexOf('\nbody {'), globals.indexOf('}', globals.indexOf('\nbody {')));
  const html = globals.slice(globals.indexOf('\nhtml {'), globals.indexOf('}', globals.indexOf('\nhtml {')));
  for (const rule of ['-webkit-font-smoothing: antialiased;', '-webkit-tap-highlight-color: transparent;', 'overscroll-behavior-y: none;', '-webkit-user-select: none;', 'user-select: none;', '-webkit-touch-callout: none;']) {
    expect(body, rule).toContain(rule);
    expect(page, rule).toContain(rule);
  }
  expect(html).toContain('-webkit-text-size-adjust: 100%;');
  expect(page).toContain('-webkit-text-size-adjust: 100%;');
  expect(globals).toContain(':root {\n  color-scheme: dark;');
  expect(page).toContain('color-scheme: dark;');
  // Behind the app, before it is drawn: the Next web's night (html night-900, the body's ground night-800).
  expect(globals).toContain('--color-night-900: #0b1022;');
  expect(globals).toContain('--color-night-800: #141b33;');
  expect(page).toMatch(/html \{\s*background: #0b1022;/);
  expect(page).toMatch(/body \{\s*background: #141b33;/);
});

test('the page writes what the export gives it: the scripts\' preloads in its head, the scripts at the end of its body', () => {
  documentData.headNodes = createElement('link', { rel: 'preload', href: '/_expo/static/js/web/entry.js', as: 'script' });
  documentData.bodyNodes = createElement('script', { defer: true, src: '/_expo/static/js/web/entry.js' });
  try {
    const written = pageIn('en');
    expect(written).toContain('<link rel="preload" href="/_expo/static/js/web/entry.js" as="script"/>');
    expect(written).toContain('<div id="root"></div><script defer="" src="/_expo/static/js/web/entry.js"></script></body>');
  } finally {
    delete documentData.headNodes;
    delete documentData.bodyNodes;
  }
});

test('a keyboard\'s focus is the Next web\'s gold ring (globals.css `:focus-visible`), not the browser\'s own', () => {
  expect(globals).toContain(':focus-visible {\n  outline: 3px solid var(--color-gold-200);\n  outline-offset: 3px;');
  expect(globals).toContain('--color-gold-200: #ffe9a8;');
  expect(page).toMatch(/:focus-visible \{\s*outline: 3px solid #ffe9a8;\s*outline-offset: 3px;/);
});

test('a page opened at the bare address (the worker answers `/` offline with the last language\'s front door) takes its own address before the app takes it over', () => {
  // The script the document runs first in its body, before the app's scripts: the router then draws the page the HTML is, not the bare address's.
  const script = /<body><script>([\s\S]*?)<\/script>/.exec(page)?.[1];
  expect(script).toBeDefined();
  const run = (pathname: string, canonical: string | null, search = '', hash = '') => {
    const moved: string[] = [];
    const location = { pathname, search, hash };
    const document = { querySelector: (selector: string) => (selector === 'link[rel="canonical"]' && canonical !== null ? { href: canonical } : null) };
    const history = { state: { kept: true }, replaceState: (state: unknown, _: string, to: string) => moved.push(`${JSON.stringify(state)} ${to}`) };
    new Function('location', 'document', 'history', script ?? '')(location, document, history);
    return moved;
  };
  expect(run('/', 'https://ratrace-plum.vercel.app/es')).toEqual(['{"kept":true} /es']);
  expect(run('/', 'https://ratrace-plum.vercel.app/ru', '?x=1', '#friends')).toEqual(['{"kept":true} /ru?x=1#friends']);
  // A page at its own address, and the bare address's own page (it names no canonical address), stay where they are.
  expect(run('/es', 'https://ratrace-plum.vercel.app/es')).toEqual([]);
  expect(run('/es/play', 'https://ratrace-plum.vercel.app/es/play')).toEqual([]);
  expect(run('/', null)).toEqual([]);
});

test('holds the words of the page of a fault in the page\'s language, and no other\'s: what it says if the language\'s own words cannot be had', () => {
  for (const locale of ['en', 'es', 'ru'] as const) {
    const held = /<script id="ratrace-fault-words" type="application\/json">([^<]*)<\/script>/.exec(pageIn(locale))?.[1];
    const play = MESSAGES[locale].play;
    expect(JSON.parse(held ?? 'null'), locale).toEqual({ faultTitle: play.faultTitle, faultBody: play.faultBody, retry: play.retry, newLife: play.newLife, home: play.home });
  }
  expect(pageIn(undefined)).toContain(JSON.stringify(MESSAGES.en.play.faultTitle));
});
