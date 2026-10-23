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
