import { advancesOf, FONT_FILES, fontPath, type FontFamily } from '../../scripts/fontCoverage';
import { runsOf, type Role } from '../ui/fonts';
import { RU_WORD_SPACING } from '../ui/text';

/*
 * How wide a line of the kit's text is, from the fonts' own files: each run in the typeface the kit sets it in (`runsOf`) at the kit's scale of it,
 * every character's advance, and the pixel text's letter spacing after each character (0.03 of its size; on a Russian page 0.16 less after a space),
 * as iOS adds a kit's spacing. No kerning is taken off, so a line is never found narrower than the phone sets it: what fits here fits there. For a test
 * that asks whether words have the room the layout leaves them (jsdom lays nothing out).
 */

const families = new Map<string, (point: number) => number | null>();
function advanceIn(family: string): (point: number) => number | null {
  let advance = families.get(family);
  if (advance === undefined) {
    if (!(family in FONT_FILES)) throw new Error(`no file of ${family} to measure with`);
    advance = advancesOf(fontPath(family as FontFamily));
    families.set(family, advance);
  }
  return advance;
}

/** The width in points of `text` set by the kit in `role` at `size` on a page in `language` (weight 400). */
export function widthOf(text: string, role: Role, size: number, language: string): number {
  let width = 0;
  for (const run of runsOf(text, role, 400, language)) {
    const advance = advanceIn(run.family);
    for (const ch of Array.from(run.text)) {
      const em = advance(ch.codePointAt(0)!);
      if (em === null) throw new Error(`${run.family} does not draw ${JSON.stringify(ch)}`);
      width += em * size * run.scale;
      if (role === 'pixel') width += size * 0.03 + (language === 'ru' && /\s/u.test(ch) ? RU_WORD_SPACING * size : 0);
    }
  }
  return width;
}
