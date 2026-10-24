import type { ImageSourcePropType } from 'react-native';
import { getAssetByID } from 'react-native-web/dist/modules/AssetRegistry';

/*
 * Where the browser fetches a file of the web export that the code names (a sprite's picture, a typeface): what Metro gives for it is a number in
 * react-native-web's registry in development, an object with its address or the address itself in the export.
 */

/** The address of an asset, from what the bundle gives for it (a registry number, an object with a `uri`, or the address itself), or null. */
export function uriOf(source: ImageSourcePropType | string): string | null {
  if (typeof source === 'string') return source;
  if (typeof source === 'number') {
    const asset = getAssetByID(source);
    if (!asset) return null;
    // The closest scale to the screen's, as react-native-web's own Image picks it.
    const wanted = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    const scale = asset.scales.reduce((prev, now) => (Math.abs(now - wanted) < Math.abs(prev - wanted) ? now : prev), asset.scales[0] ?? 1);
    return `${asset.httpServerLocation}/${asset.name}${scale !== 1 ? `@${scale}x` : ''}.${asset.type}`;
  }
  const one = Array.isArray(source) ? source[0] : source;
  return one && typeof one.uri === 'string' && one.uri !== '' ? one.uri : null;
}
