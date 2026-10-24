import type { ImageSourcePropType } from 'react-native';
import manifest from './manifest.json';

/*
 * The web export's twin of `sources.ts` (Metro picks it for the web): each sprite is the site's own file, at the address the Next web serves it from
 * (`/sprites/<group>/<id>.png`; scripts/sprites.ts copies them into public/sprites, which the export serves at its root), not one of Metro's assets.
 * The first page then carries no registry of every sprite, and the site's service worker keeps them as it keeps the Next web's. Not written by
 * scripts/sprites.ts: it reads the manifest that script writes.
 */
export const SOURCES: Record<string, ImageSourcePropType> = Object.fromEntries(
  Object.entries(manifest as Record<string, { src: string }>).map(([id, sprite]) => [id, { uri: `/sprites/${sprite.src}` }]),
);
