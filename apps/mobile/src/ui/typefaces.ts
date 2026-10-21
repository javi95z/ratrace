import { Skia, type SkTypeface } from '@shopify/react-native-skia';
import { Image, type ImageSourcePropType } from 'react-native';

/*
 * The game's typefaces as Skia draws them by hand, on a surface of its own (the share card): the very files the app sets its type in
 * (`fontSources.ts`), by the family name the kit's runs give (`runsOf` in fonts.ts). A Text is drawn by the platform with the fonts the app
 * loaded; Skia is given the file itself, as its own `useFonts` does. What is not the game's own (Arial, the system's font, Zapf Dingbats: what
 * the page falls to past them) is asked of the phone's fonts, and the phone's sans serif stands in where it has none of that name.
 */

/** The typefaces made so far, by family: each file read and made a typeface once. A read that failed is not kept: the next request tries again. */
const made = new Map<string, Promise<SkTypeface | null>>();

/** The typeface of a family the kit's runs name, or null where it cannot be had now (a file not read, a font the phone does not have). */
export function typefaceOf(family: string): Promise<SkTypeface | null> {
  let face = made.get(family);
  if (face === undefined) {
    face = faceOf(family).then(
      (found) => {
        if (found === null) made.delete(family);
        return found;
      },
      () => {
        made.delete(family);
        return null;
      },
    );
    made.set(family, face);
  }
  return face;
}

async function faceOf(family: string): Promise<SkTypeface | null> {
  // Loaded here, not at the top: the font files are the app's, and only what draws with them needs them.
  const { FONT_SOURCES } = await import('./fontSources');
  const sources = FONT_SOURCES as Readonly<Record<string, ImageSourcePropType>>;
  if (!Object.hasOwn(sources, family)) {
    // The phone's own, by name, or its sans serif where it has none of that name (Android has no Arial; iOS has no font called System).
    const fonts = Skia.FontMgr.System();
    for (const name of [family, 'Helvetica', 'sans-serif']) {
      const face = fonts.matchFamilyStyle(name, { weight: 400 }) as SkTypeface | null;
      if (face) return face;
    }
    return null;
  }
  const source = sources[family];
  const uri = typeof source === 'number' ? Image.resolveAssetSource(source)?.uri : (source as { uri?: string }).uri;
  if (!uri) return null;
  return Skia.Typeface.MakeFreeTypeFaceFromData(await Skia.Data.fromURI(uri));
}
