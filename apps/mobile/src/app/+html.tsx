import { DEFAULT_LOCALE, isLocale } from '@ratrace/i18n/locales';
import { useServerDocumentContext } from 'expo-router/html';
import { preload } from 'react-dom';
import type { ReactNode } from 'react';
import { FAULT_WORDS } from '../game/faultWords';
import { faultWordsJson } from '../game/faultWordsHtml';
import { FRONT_PICTURE } from '../game/frontPicture';
import { sourceOf, uriOf } from '../ui/spriteImages.web';
import { LATER_FACES, laterFaces } from '../ui/gameFonts';

/*
 * The document of every page of the web export (expo-router's template for `web.output: "static"`: drawn on the build's machine only, never in the
 * browser nor on the phone). It is the Next web's layout (apps/web/src/app/[locale]/layout.tsx) and page (globals.css): the page in the language of
 * its address, the viewport that reaches under the notch, the colour of the browser's bar, a dark page with nothing to select. What the export puts
 * in every page (its scripts and their preloads, the hydration flag, the head a page asks for) comes through expo-router's document context, written
 * where Expo's own template writes it. The typefaces are expo-font's to write, after this is drawn: an @font-face and a `preload` for each the page
 * draws first (`ui/gameFonts.web.ts`: Jersey 15 and Chakra Petch, and on a Russian page Oswald and Exo 2), as next/font preloads the Next web's; the
 * others are declared here with no preload (`laterFaces`), as next/font declares its `preload: false` faces, and fetched by the text that needs them.
 */

/** The page's styles, as the Next web's: react-native-web's root reset (the app fills the page, the page never scrolls), then the game's page. */
const PAGE_STYLES = `
      /* These styles make the body full-height */
      html,
      body {
        height: 100%;
      }
      /* These styles disable body scrolling if you are using <ScrollView> */
      body {
        overflow: hidden;
      }
      /* These styles make the root element full-height */
      #root {
        display: flex;
        height: 100%;
        flex: 1;
      }
      /* The page is a game's, as the Next web's (apps/web/src/app/globals.css \`:root\`, \`html\`, \`body\`, \`:focus-visible\`). */
      :root {
        color-scheme: dark;
      }
      html {
        background: #0b1022;
        -webkit-text-size-adjust: 100%;
      }
      body {
        background: #141b33;
        -webkit-font-smoothing: antialiased;
        -webkit-tap-highlight-color: transparent;
        overscroll-behavior-y: none;
        -webkit-user-select: none;
        user-select: none;
        -webkit-touch-callout: none;
      }
      :focus-visible {
        outline: 3px solid #ffe9a8;
        outline-offset: 3px;
      }
      /* The round's stage takes the focus at each step, and a sheet's panel as it opens, for the keyboard to carry on from (the Next web's
         \`outline-none\` on both): no ring round them. */
      #round-stage:focus,
      [data-sheet-panel]:focus {
        outline: none;
      }
`;

/**
 * What a page does first, before the app's scripts: opened at the bare address, a page of the game's takes its own (its canonical address's path,
 * the query and the hash kept). The site leads `/` to a language's front door before it is served (`middleware.ts`), but the worker answers `/`
 * offline with the front door of the language last played (the Next web's worker, word for word): drawn at `/`, the router would take over the bare
 * address's page from that front door's HTML, a mismatch React reports as an error and draws again. The bare address's own page names no canonical
 * address, and stays.
 */
const OWN_ADDRESS = `(function () {
  if (location.pathname !== '/') return;
  var own = document.querySelector('link[rel="canonical"]');
  if (!own) return;
  var path = new URL(own.href).pathname;
  if (path !== '/') history.replaceState(history.state, '', path + location.search + location.hash);
})();`;

/**
 * The address of the picture a page fetches ahead, as the Next web's HTML does its largest: the front door's mascot (`FRONT_PICTURE`), which a first
 * visit meets and is the page's largest paint; no other page. Its `<img>` is in the HTML too (`ui/Sprite.web.tsx`), so it is painted with the
 * page's first text, not once the scripts have run.
 */
function pictureAhead(lang: string, asked: unknown, pathname: string | undefined): string | null {
  if (asked !== lang || pathname?.replace(/\/$/, '') !== `/${lang}`) return null;
  const source = sourceOf(FRONT_PICTURE);
  return source === undefined ? null : uriOf(source);
}

/** The document a page is drawn in: `params` are its route's (`locale` the first part of its address), `children` the app's root. */
export default function Document({ children, params, pathname }: { children: ReactNode; params?: Record<string, string | string[] | undefined>; pathname?: string }) {
  const asked = params?.locale;
  const lang = isLocale(asked) ? asked : DEFAULT_LOCALE;
  const { htmlAttributes, headNodes, bodyAttributes, bodyNodes } = useServerDocumentContext();
  const picture = pictureAhead(lang, asked, pathname);
  // Through React's own preloads, which also fetch ahead every picture the page's HTML draws: one link for it, first among them.
  if (picture) preload(picture, { as: 'image', fetchPriority: 'high' });
  return (
    <html {...htmlAttributes} lang={lang}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* As the Next web's `viewport`: the page reaches under the notch and the home bar, and the game clears the safe areas. */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#141b33" />
        <style id="ratrace-page" dangerouslySetInnerHTML={{ __html: PAGE_STYLES }} />
        <style id={LATER_FACES} dangerouslySetInnerHTML={{ __html: laterFaces(lang) }} />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        <script dangerouslySetInnerHTML={{ __html: OWN_ADDRESS }} />
        {/* The words of the page of a fault, in the page's language: what it says if the language's own cannot be had (game/PageFault.web.tsx). */}
        <script id={FAULT_WORDS} type="application/json" dangerouslySetInnerHTML={{ __html: faultWordsJson(lang) }} />
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
