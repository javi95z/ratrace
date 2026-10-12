import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildManifest } from './sprites';

const read = (path: string) => JSON.parse(readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8'));

describe('the sprite list the app reads', () => {
  it('is in step with the art pipeline: run `pnpm --filter @ratrace/web sprites` if this fails', () => {
    expect(read('../src/sprites/manifest.json')).toEqual(buildManifest(read('../../../art/clean/manifest.json')));
  });

  it('keeps each sprite under its group folder, with its size', () => {
    const manifest = buildManifest({ sprites: { 'item.b': { file: 'items/item.b.png', width: 64, height: 64 }, 'car.a': { file: 'cars/car.a.png', width: 96, height: 48 } } });
    expect(manifest).toEqual({ 'car.a': { src: 'cars/car.a.png', w: 96, h: 48 }, 'item.b': { src: 'items/item.b.png', w: 64, h: 64 } });
    expect(Object.keys(manifest)).toEqual(['car.a', 'item.b']);
  });
});
