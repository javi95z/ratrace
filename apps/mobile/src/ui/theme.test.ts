import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { COLORS, EDGE, SHELL_WIDTH, TOUCH, BODY, EXTRA } from './theme';

const css = readFileSync(new URL('../../../web/src/app/globals.css', import.meta.url), 'utf8');
const theme = css.slice(css.indexOf('@theme {'), css.indexOf('\n}', css.indexOf('@theme {')));
const webColours: Record<string, string> = {};
for (const m of theme.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8});/g)) {
  webColours[m[1]] = m[2].toLowerCase();
}

test('COLORS are the web stylesheet\'s 31 tokens, name for name and hex for hex', () => {
  expect(Object.keys(webColours)).toHaveLength(31);
  expect(COLORS).toEqual(webColours);
});

test('measures match the design', () => {
  expect(EDGE).toBe(2);
  expect(SHELL_WIDTH).toBe(448);
  expect(TOUCH).toBe(44);
  expect(BODY).toEqual({ size: 15, lineHeight: 1.45, color: 'cream' });
});

test('extra colours the web uses outside the tokens', () => {
  expect(EXTRA.backdrop).toBe('rgba(11,16,34,0.8)');
  expect(EXTRA.bronze).toBe('#c98a4b');
  expect(EXTRA.glint).toBe('rgba(255,255,255,0.4)');
  expect(EXTRA.glow).toEqual({
    uncommon: '0 0 6px rgba(240,230,210,0.35)',
    rare: '0 0 12px rgba(233,177,60,0.6)',
    legendary: '0 0 20px rgba(94,224,200,0.7)',
  });
});
