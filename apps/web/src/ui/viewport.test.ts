import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * On a phone with a notch the body is padded by the safe area at the top. A page that is as tall as
 * the whole screen then runs that far past the fold: its foot is hidden and it scrolls for nothing.
 * So a page is as tall as what is left under the safe area, never the whole screen.
 */
const SRC = fileURLToPath(new URL('..', import.meta.url));
const CSS = readFileSync(join(SRC, 'app/globals.css'), 'utf8');

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return filesUnder(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('the height of a page', () => {
  it('is what is left under the safe area, by the same inset the body is padded with', () => {
    expect(CSS).toMatch(/body \{[^}]*padding-top: env\(safe-area-inset-top\);/);
    expect(CSS).toMatch(/@utility min-h-safe \{\s*min-height: calc\(100dvh - env\(safe-area-inset-top\)\);/);
    expect(CSS).toMatch(/@utility max-h-safe \{\s*max-height: calc\(100dvh - env\(safe-area-inset-top\)\);/);
  });

  it('is never the whole screen', () => {
    const whole = filesUnder(SRC).flatMap((path) =>
      [...readFileSync(path, 'utf8').matchAll(/\b(?:min-|max-)?h-(?:dvh|svh|lvh|screen)\b/g)].map((m) => `${relative(SRC, path)}: ${m[0]}`),
    );
    expect(whole).toEqual([]);
  });
});
