import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Puts the approved sprites where Metro can bundle them, and writes what the app reads, as the web's
 * scripts/sprites.ts does for the browser:
 *
 *   art/clean/<group>/<id>.png   →  assets/sprites/<group>/<id>.png   (not committed; copied on every install and before every start)
 *   art/clean/manifest.json      →  src/sprites/manifest.json         (committed; a test fails when it is stale)
 *                                →  src/sprites/sources.ts            (committed: one static require per id, as Metro asks)
 *
 *   pnpm --filter @ratrace/mobile sprites
 */
const here = dirname(fileURLToPath(import.meta.url));
const art = join(here, '../../../art/clean');
const out = join(here, '../assets/sprites');

interface ArtManifest {
  sprites: Record<string, { file: string; width: number; height: number }>;
}

export interface SpriteEntry {
  /** Path under assets/sprites (and under the web's /sprites). */
  src: string;
  w: number;
  h: number;
}

/** The same list the web writes: id → file and size, sorted by id. */
export function buildManifest(source: ArtManifest): Record<string, SpriteEntry> {
  const entries = Object.entries(source.sprites)
    .map(([id, sprite]): [string, SpriteEntry] => [id, { src: sprite.file, w: sprite.width, h: sprite.height }])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return Object.fromEntries(entries);
}

/** The module that names every sprite's file for Metro. */
export function sourcesFile(manifest: Record<string, SpriteEntry>): string {
  const lines = Object.entries(manifest).map(([id, entry]) => `  '${id}': require('../../assets/sprites/${entry.src}'),`);
  return [
    '// Written by scripts/sprites.ts: do not edit. Metro bundles an image only through a static require.',
    'import type { ImageSourcePropType } from \'react-native\';',
    '',
    'export const SOURCES: Record<string, ImageSourcePropType> = {',
    ...lines,
    '};',
    '',
  ].join('\n');
}

function main(): void {
  if (!existsSync(join(art, 'manifest.json'))) {
    console.warn('sprites: art/clean/manifest.json not found; the app will run on placeholders');
    return;
  }
  const source = JSON.parse(readFileSync(join(art, 'manifest.json'), 'utf8')) as ArtManifest;
  const manifest = buildManifest(source);

  rmSync(out, { recursive: true, force: true });
  for (const entry of Object.values(manifest)) {
    mkdirSync(dirname(join(out, entry.src)), { recursive: true });
    cpSync(join(art, entry.src), join(out, entry.src));
  }
  mkdirSync(join(here, '../src/sprites'), { recursive: true });
  writeFileSync(join(here, '../src/sprites/manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(here, '../src/sprites/sources.ts'), sourcesFile(manifest));
  console.log(`sprites: ${Object.keys(manifest).length} copied`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
