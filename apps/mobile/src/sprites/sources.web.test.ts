import { expect, test } from 'vitest';
import manifest from './manifest.json';
import { SOURCES } from './sources';

/*
 * On the web a sprite is the site's own file, at the address the Next web serves it from (`/sprites/<group>/<id>.png`, its public/sprites, which the
 * app's export has too: scripts/sprites.ts copies art/clean into public/sprites), not one of Metro's assets: the first page carries no registry of a
 * thousand files, and the site's service worker keeps them as it keeps the Next web's.
 */

test('every sprite of the manifest is the site\'s file at /sprites/<group>/<id>.png, and nothing else is one', () => {
  expect(Object.keys(SOURCES)).toEqual(Object.keys(manifest));
  expect(SOURCES['anim.coin.0']).toEqual({ uri: '/sprites/icons/anim.coin.0.png' });
  expect(SOURCES['backdrop.madrid']).toEqual({ uri: '/sprites/portraits/backdrop.madrid.png' });
  expect(Object.hasOwn(SOURCES, 'no.such.sprite')).toBe(false);
});
