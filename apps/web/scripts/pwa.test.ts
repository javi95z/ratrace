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
