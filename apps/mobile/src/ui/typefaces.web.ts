/*
 * The web export's twin of `typefaces.ts` (Metro picks it for the web). The phone hands Skia the font files to draw the share card's text by hand;
 * the web draws text with CSS fonts, which the page loads itself, so there is no typeface to be had and Skia is never loaded.
 */

/** No typeface, ever: the web's text is set by the page's fonts. (The phone's answers a Skia typeface, or null where it cannot be had.) */
export function typefaceOf(family: string): Promise<null> {
  void family;
  return Promise.resolve(null);
}
