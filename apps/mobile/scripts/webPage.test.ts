import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

/*
 * The page the app's web is drawn in (apps/mobile/public/index.html: Expo takes it in place of its own template, for `expo start --web` and
 * `expo export --platform web`) is shaped as the Next web's: the same viewport, and the same colour for the browser's bar.
 */
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const page = read('../public/index.html');
const layout = read('../../web/src/app/[locale]/layout.tsx');

test('the page reaches under the notch and the home bar, as the Next web\'s does (`viewportFit: cover`): the safe areas are the game\'s to clear', () => {
  expect(layout).toContain("viewportFit: 'cover',");
  expect(layout).toContain("width: 'device-width',");
  expect(layout).toContain('initialScale: 1,');
  expect(page).toContain('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />');
});

test('the browser\'s bar is the colour the Next web gives it', () => {
  const colour = /themeColor: '(#[0-9a-f]{6})'/.exec(layout)?.[1];
  expect(colour).toBe('#141b33');
  expect(page).toContain(`<meta name="theme-color" content="${colour}" />`);
});

test('the page keeps what Expo\'s own template has: the language and title it fills in, and the root the app is drawn in', () => {
  for (const kept of ['<html lang="%LANG_ISO_CODE%">', '<title>%WEB_TITLE%</title>', '<div id="root"></div>', 'body {\n        overflow: hidden;']) expect(page).toContain(kept);
});

test('the page is a game\'s, as the Next web\'s body says (globals.css): its text smoothed the same, nothing to select, no tap flash, no rubber band, no text grown by the phone, a dark page', () => {
  const globals = read('../../web/src/app/globals.css');
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

test('a keyboard\'s focus is the Next web\'s gold ring (globals.css `:focus-visible`), not the browser\'s own', () => {
  const globals = read('../../web/src/app/globals.css');
  expect(globals).toContain(':focus-visible {\n  outline: 3px solid var(--color-gold-200);\n  outline-offset: 3px;');
  expect(globals).toContain('--color-gold-200: #ffe9a8;');
  expect(page).toMatch(/:focus-visible \{\s*outline: 3px solid #ffe9a8;\s*outline-offset: 3px;/);
});
