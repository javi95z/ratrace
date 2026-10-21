import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { COLORS, EDGE, SHELL_WIDTH, TOUCH, BODY, EXTRA, GREYSCALE, grey } from './theme';

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
  // `shadow-[…,4px_4px_0_rgb(0_0_0/0.45)]`: the paper of the news, thrown on the table
  expect(EXTRA.paperShadow).toBe('rgba(0,0,0,0.45)');
  expect(readFileSync(new URL('../../../web/src/game/screens/News.tsx', import.meta.url), 'utf8')).toContain('4px_4px_0_rgb(0_0_0/0.45)');
  // `bg-night-900/85`: the strip under a city's name on its banner
  expect(EXTRA.label).toBe('rgba(11,16,34,0.85)');
  expect(EXTRA.glow).toEqual({
    uncommon: '0 0 6px rgba(240,230,210,0.35)',
    rare: '0 0 12px rgba(233,177,60,0.6)',
    legendary: '0 0 20px rgba(94,224,200,0.7)',
  });
});

test('grey is a colour as the web\'s `grayscale` filter draws it (CSS grayscale(1), in sRGB): each channel the luminance of the three', () => {
  // The filter's matrix at its full amount (Filter Effects 1, grayscale()): three rows alike, alpha kept, nothing added.
  expect(GREYSCALE).toEqual([0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0, 0, 0, 1, 0]);
  expect(grey('#ffffff')).toBe('#ffffff');
  expect(grey('#000000')).toBe('#000000');
  // night-700 #1f2a4d: 0.2126 × 31 + 0.7152 × 42 + 0.0722 × 77 = 42.19, a grey of 42 (#2a).
  expect(grey(COLORS['night-700'])).toBe('#2a2a2a');
  // night-900 #0b1022: 16.24; gold-500 #f2c14e: 195.11; the bronze of a common badge #c98a4b: 146.85.
  expect(grey(COLORS['night-900'])).toBe('#101010');
  expect(grey(COLORS['gold-500'])).toBe('#c3c3c3');
  expect(grey(EXTRA.bronze)).toBe('#939393');
});
