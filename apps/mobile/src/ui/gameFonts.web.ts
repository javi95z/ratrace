import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { useLocaleParam } from '../game/pages';
import { uriOf } from './assetUri.web';
import { useFontsSettled } from './fonts';
import { FONT_SOURCES } from './fontSources';

/*
 * The web export's twin of `gameFonts.ts` (Metro picks it for the web). A page fetches ahead only the typefaces it draws first, as the Next web's
 * next/font does (apps/web/src/app/[locale]/layout.tsx): Jersey 15 and Chakra Petch on every page, and Oswald and Exo 2 too on a Russian one, whose
 * words they draw. Those go through expo-font, which writes them into the page the build draws (an @font-face and a `preload` each) and waits for
 * them in the browser. The others (the Cyrillic faces of a Latin page, the slanted ones) are declared with no fetch, from the page's first byte
 * (`laterFaces`, written into its head by `app/+html.tsx`), as next/font declares its `preload: false` faces: the browser fetches one when a text
 * needs it, drawing that text in the stack's next face meanwhile (`font-display: swap`).
 */

type Family = keyof typeof FONT_SOURCES;

/** What every page draws first, its pixel face and its reading faces. */
const LATIN: readonly Family[] = ['Jersey15_400Regular', 'ChakraPetch_400Regular', 'ChakraPetch_600SemiBold'];
/** What a Russian page draws first besides: its words' Cyrillic, pixel and reading. */
const CYRILLIC: readonly Family[] = ['Oswald_500Medium', 'Exo2_400Regular', 'Exo2_600SemiBold'];
const RUSSIAN: readonly Family[] = [...LATIN, ...CYRILLIC];

/** The typefaces a page in `locale` fetches ahead. */
function facesAhead(locale: string): readonly Family[] {
  return locale === 'ru' ? RUSSIAN : LATIN;
}

/** The style element the faces fetched later are declared in: the page's head's, where the build drew it. */
export const LATER_FACES = 'ratrace-later-fonts';

/**
 * The @font-face rules of every face a page in `locale` does not fetch ahead, with no preload: each fetched only for a text that needs it. A face
 * with no address (`uriOf`) is left out, never declared as `url(null)`.
 */
export function laterFaces(locale: string): string {
  const ahead = facesAhead(locale);
  return (Object.keys(FONT_SOURCES) as Family[])
    .filter((family) => !ahead.includes(family))
    .flatMap((family) => {
      // A face's file is an asset of the export: a string there, a registry number in development (`uriOf`, as a sprite's).
      const uri = uriOf(FONT_SOURCES[family]);
      return uri === null ? [] : [`@font-face{font-family:${JSON.stringify(family)};src:url(${JSON.stringify(uri)});font-display:swap}`];
    })
    .join('\n');
}

/** Declares the faces not fetched ahead, where the build's page did not (development, which draws no page ahead of the browser). */
function declareLater(locale: string): void {
  if (document.getElementById(LATER_FACES)) return;
  const style = document.createElement('style');
  style.id = LATER_FACES;
  style.textContent = laterFaces(locale);
  document.head.appendChild(style);
}

/** Loads the typefaces the page draws first (in the language of its address): true once they are in, or once they failed to. */
export function useGameFonts(): boolean {
  // Read here, not by the root layout: the phone's root layout is not drawn again with each move of the router for an argument it does not use.
  const locale = useLocaleParam();
  const ahead = facesAhead(locale);
  // The faces ahead are the page's first language's: a page that turns to another later finds that language's faces among those declared for later.
  const settled = useFontsSettled(useFonts(Object.fromEntries(ahead.map((family) => [family, FONT_SOURCES[family]]))));
  useEffect(() => declareLater(locale), [locale]);
  return settled;
}
