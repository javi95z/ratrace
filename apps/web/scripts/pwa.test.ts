import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { serviceWorker } from './pwa';

describe('the installable app', () => {
  it('generates a worker that keeps private traffic out of caches', () => {
    const worker = serviceWorker('test-version', ['/en', '/offline.html']);
    expect(worker).toContain("const CACHE = CACHE_PREFIX + \"test-version\"");
    expect(worker).toContain("url.pathname.startsWith('/api/')");
    expect(worker).toContain('if (url.search) return');
    expect(worker).toContain("credentials: 'omit'");
    expect(worker).toContain("url.searchParams.has('_rsc')");
    expect(worker).toContain("caches.match('/offline.html')");
  });

  it('generates a worker the browser can read', () => {
    // Parsed, not run: a slip in the template (an escape lost in a regular expression) would stop the worker installing.
    expect(() => new Function(serviceWorker('test-version', ['/en']))).not.toThrow();
  });

  it('opens the bare address offline in the language last played, not the browser\'s', () => {
    const worker = serviceWorker('test-version', ['/en']);
    expect(worker).toContain('keepLanguage(response.url || request.url)');
    expect(worker).toContain('(await lastLanguage().catch(() => null)) ||');
    // Kept outside the versioned caches, which a new version clears.
    expect(worker).toContain("const LANGUAGE_CACHE = 'rat-race-language'");
    expect(worker).toContain("name.startsWith(CACHE_PREFIX)");
    expect('rat-race-language'.startsWith('ratrace-')).toBe(false);
  });

  it('has correctly sized ordinary, maskable and Apple icons', async () => {
    const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
    const expected = { 'icons/icon-192.png': 192, 'icons/icon-512.png': 512, 'icons/icon-maskable-512.png': 512, 'icons/apple-touch-icon.png': 180, 'favicon.ico': 32 };
    for (const [name, size] of Object.entries(expected)) {
      const path = `${publicDir}${name}`;
      expect(existsSync(path), `${name} was not generated`).toBe(true);
      const metadata = await sharp(readFileSync(path)).metadata();
      expect([metadata.width, metadata.height]).toEqual([size, size]);
    }
  });
});
