import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Puts the approved sprites where the browser can fetch them, and writes the list the app reads.
 *
 *   art/clean/<group>/<id>.png   →  public/sprites/<group>/<id>.png   (not committed; copied on every dev and build)
 *   art/clean/manifest.json      →  src/sprites/manifest.json         (committed; a test fails when it is stale)
 *
 * Packing them into one atlas image was left to the web game by the art pipeline. With HTTP/2 and
 * about two hundred small files it is not needed yet, so they are served as they are.
 */
const here = dirname(fileURLToPath(import.meta.url));
const art = join(here, '../../../art/clean');
const out = join(here, '../public/sprites');

interface ArtManifest {
  sprites: Record<string, { file: string; width: number; height: number }>;
}

export interface SpriteEntry {
  /** Path under /sprites. */
  src: string;
  w: number;
  h: number;
}

export function buildManifest(source: ArtManifest): Record<string, SpriteEntry> {
  const entries = Object.entries(source.sprites)
    .map(([id, sprite]): [string, SpriteEntry] => [id, { src: sprite.file, w: sprite.width, h: sprite.height }])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return Object.fromEntries(entries);
}

function main(): void {
  if (!existsSync(join(art, 'manifest.json'))) {
    console.warn('sprites: art/clean/manifest.json not found; the game will run on placeholders');
    return;
  }
  const source = JSON.parse(readFileSync(join(art, 'manifest.json'), 'utf8')) as ArtManifest;
  const manifest = buildManifest(source);

  rmSync(out, { recursive: true, force: true });
  for (const entry of Object.values(manifest)) {
    mkdirSync(dirname(join(out, entry.src)), { recursive: true });
    cpSync(join(art, entry.src), join(out, entry.src));
  }
  writeFileSync(join(here, '../src/sprites/manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`sprites: ${Object.keys(manifest).length} copied`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
