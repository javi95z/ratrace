import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { FORBIDDEN, JS_GZIP_BUDGET, exportEnv, judgeWebExport, sourcesOf } from './webSize';

/** A JS file of this many bytes that gzip cannot shrink (random-looking), so its gzip size is about its own. */
function noise(bytes: number): Buffer {
  const out = Buffer.alloc(bytes);
  let seed = 1;
  for (let i = 0; i < bytes; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    out[i] = seed >>> 24;
  }
  return out;
}

const small = { path: '_expo/static/js/web/entry-abc.js', bytes: Buffer.from('console.log(1)') };

describe('judgeWebExport', () => {
  it('finds nothing wrong with a small clean export', () => {
    expect(judgeWebExport([small, { path: 'index.html', bytes: Buffer.from('<html></html>') }], ['node_modules/react/index.js', 'apps/mobile/src/ui/Sprite.tsx'])).toEqual([]);
  });

  it('reports a .wasm file', () => {
    const problems = judgeWebExport([small, { path: '_expo/static/js/web/canvaskit-1.wasm', bytes: Buffer.from([0, 97, 115, 109]) }], []);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('canvaskit-1.wasm');
  });

  it('reports a JS total over the budget in gzip, and not one under it', () => {
    expect(JS_GZIP_BUDGET).toBe(1_350 * 1024);
    const over = noise(JS_GZIP_BUDGET + 64 * 1024);
    expect(gzipSync(over).length).toBeGreaterThan(JS_GZIP_BUDGET);
    const problems = judgeWebExport([{ path: 'a.js', bytes: over }], []);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/gzip/);
    // Two files count together, and only .js counts.
    const half = noise(Math.floor(JS_GZIP_BUDGET * 0.6));
    expect(judgeWebExport([{ path: 'a.js', bytes: half }, { path: 'b.js', bytes: half }], [])).toHaveLength(1);
    expect(judgeWebExport([{ path: 'a.js', bytes: half }, { path: 'b.map', bytes: half }, { path: 'c.png', bytes: half }], [])).toEqual([]);
  });

  it.each([
    '@shopify/react-native-skia',
    'canvaskit-wasm',
    'expo-sqlite',
    '@formatjs/intl-getcanonicallocales',
    '@formatjs/intl-locale',
    '@formatjs/intl-pluralrules',
    '@formatjs/intl-numberformat',
    '@formatjs/intl-datetimeformat',
    '@formatjs/intl-relativetimeformat',
    '@formatjs/intl-listformat',
    '@formatjs/intl-displaynames',
    'react-native-webview',
    'expo-media-library',
    'apps/mobile/src/rules/v0.40.0-1.41.0.js',
  ])('reports a source naming %s', (name) => {
    const source = name.startsWith('apps/') ? `../../${name}` : `../../node_modules/${name}/lib/index.js`;
    const problems = judgeWebExport([small], ['node_modules/react/index.js', source]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(source);
  });

  it('reports each forbidden module once, however many of its files are in', () => {
    const problems = judgeWebExport([small], ['a/node_modules/expo-sqlite/a.js', 'a/node_modules/expo-sqlite/b.js']);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/2 sources/);
  });

  it('lists the older rules by their folder, not by one version', () => {
    expect(FORBIDDEN.map((entry) => entry.label)).toContain('the older rules (src/rules/v*.js)');
    expect(judgeWebExport([small], ['apps/mobile/src/rules/index.ts'])).toEqual([]);
  });
});

describe('sourcesOf', () => {
  it('reads the sources of a plain map and of every section of an indexed one', () => {
    expect(sourcesOf({ sources: ['a.js', 'b.js'] })).toEqual(['a.js', 'b.js']);
    expect(sourcesOf({ sections: [{ map: { sources: ['a.js'] } }, { map: { sources: ['b.js', 'c.js'] } }] })).toEqual(['a.js', 'b.js', 'c.js']);
    expect(sourcesOf({})).toEqual([]);
  });
});

describe('formatjs', () => {
  it('is forbidden as the polyfills only: use-intl\'s own dependencies stay', () => {
    const kept = [
      '../../node_modules/.pnpm/@formatjs+fast-memoize@2.2.0/node_modules/@formatjs/fast-memoize/lib/index.js',
      '../../node_modules/.pnpm/@formatjs+icu-messageformat-parser@2.9.0/node_modules/@formatjs/icu-messageformat-parser/lib/parser.js',
      '../../node_modules/.pnpm/intl-messageformat@10.7.0/node_modules/intl-messageformat/lib/src/core.js',
    ];
    expect(judgeWebExport([small], kept)).toEqual([]);
  });

  it('finds a polyfill in a pnpm path', () => {
    const polyfill = '../../node_modules/.pnpm/@formatjs+intl-numberformat@9.4.3/node_modules/@formatjs/intl-numberformat/polyfill-force.js';
    expect(judgeWebExport([small], [polyfill])).toHaveLength(1);
  });
});

describe('exportEnv', () => {
  it('blanks the live project\'s settings for the export, and leaves the rest of the environment', () => {
    const env = exportEnv({
      PATH: '/bin',
      EXPO_PUBLIC_SUPABASE_URL: 'https://live.supabase.co',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_live',
      EXPO_PUBLIC_TURNSTILE_SITE_KEY: '0x4AAA',
      EXPO_PUBLIC_OTHER: 'kept',
    });
    expect(env).toEqual({
      PATH: '/bin',
      EXPO_PUBLIC_SUPABASE_URL: '',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
      EXPO_PUBLIC_TURNSTILE_SITE_KEY: '',
      EXPO_PUBLIC_OTHER: 'kept',
    });
  });

  it('sets them empty when they were not set at all', () => {
    expect(exportEnv({ PATH: '/bin' })).toMatchObject({ EXPO_PUBLIC_SUPABASE_URL: '', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '', EXPO_PUBLIC_TURNSTILE_SITE_KEY: '' });
  });
});
