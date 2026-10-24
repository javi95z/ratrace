import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { useFontsSettled } from './fonts';
import { FONT_SOURCES } from './fontSources';
import { uriOf } from './spriteImages.web';

/*
 * The web export's twin of `gameFonts.ts` (Metro picks it for the web). A page fetches ahead only the typefaces it draws first, as the Next web's
 * next/font does (apps/web/src/app/[locale]/layout.tsx): Jersey 15 and Chakra Petch on every page, and Oswald and Exo 2 too on a Russian one, whose
 * words they draw. Those go through expo-font, which writes them into the page the build draws (an @font-face and a `preload` each) and waits for
 * them in the browser. The others (the Cyrillic faces of a Latin page, the slanted ones) are only declared to the page once it is the browser's, with
 * no fetch: the browser fetches one when a text needs it, drawing that text in the stack's next face meanwhile, as next/font's `preload: false`
 * faces are (`font-display: swap`).
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

/** The style element the faces fetched later are declared in. */
const LATER = 'ratrace-later-fonts';

/** Declares to the page every face that is not fetched ahead, once: the browser fetches each only for a text that needs it. */
function declareLater(ahead: readonly Family[]): void {
  if (document.getElementById(LATER)) return;
  // A face's file is an asset of the export: its address (`uriOf`, as a sprite's), a string in the export and a registry number in development.
  const rules = (Object.keys(FONT_SOURCES) as Family[])
    .filter((family) => !ahead.includes(family))
    .map((family) => `@font-face{font-family:${JSON.stringify(family)};src:url(${JSON.stringify(uriOf(FONT_SOURCES[family]))});font-display:swap}`);
  const style = document.createElement('style');
  style.id = LATER;
  style.textContent = rules.join('\n');
  document.head.appendChild(style);
}

/** Loads the typefaces a page in `locale` draws first: true once they are in, or once they failed to. The rest are declared for later. */
export function useGameFonts(locale: string): boolean {
  const ahead = facesAhead(locale);
  // The faces ahead are the page's first language's: a page that turns to another later finds that language's faces among those declared for later.
  const settled = useFontsSettled(useFonts(Object.fromEntries(ahead.map((family) => [family, FONT_SOURCES[family]]))));
  useEffect(() => declareLater(ahead), [ahead]);
  return settled;
}
