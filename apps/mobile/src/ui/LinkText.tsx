import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { webBaseline } from './fonts';
import { ReadText, type TextLine } from './text';
import { BODY, COLORS, type ColorToken } from './theme';

/** A line of the words as the phone laid it out: where it starts, how far down it stands, and how wide it is. */
type Laid = Readonly<{ x: number; y: number; width: number }>;

/** Two layouts alike, line for line: laid out again the same way, the link is not drawn again. */
const sameLines = (a: readonly Laid[], b: readonly Laid[]): boolean =>
  a.length === b.length && a.every((line, i) => line.x === b[i].x && line.y === b[i].y && line.width === b[i].width);

/**
 * Where Chrome draws a link's underline with no offset of its own (the web's `underline` alone: `offset="auto"`): Chakra's own underline (its post
 * table, −75 of 1000 at 13), 1.5 under the baseline, measured on the web's shot (phase 3's batch pass).
 */
export const AUTO_OFFSET = 1.5;

/**
 * The words of a link, in the reading face, underlined as the web underlines them (`underline underline-offset-N` on a line of `size` × 1.45): every
 * line the words wrap to has a line of its own under it, as wide as its words, `offset` under the baseline the browser gives that line. The lines
 * are drawn, not asked of the font: iOS puts a font's underline where the font says, with no offset. Until the phone has laid the words out they are
 * taken for one line, which nearly every link is, and a link laid out on one line is not drawn again for it; a link that wraps (a Russian one in a
 * narrow column) is underlined line by line once it has.
 * The lines are decoration: they take no touch, and a screen reader reads the words. The web's twin (`LinkText.web.tsx`) leaves the underline to the
 * browser, as the Next web does.
 */
export function LinkText({ size, offset, tone = 'sky-300', children }: { size: number; offset: number | 'auto'; tone?: ColorToken; children: string }) {
  // The lines of the words they were laid out for: words that change (a switch link turning into "✓ …") are one line again until they are laid out.
  const [held, setHeld] = useState<{ words: string; lines: readonly Laid[] } | null>(null);
  const laid = useCallback(
    (told: readonly TextLine[]) => {
      const next = told.map(({ x, y, width }) => ({ x, y, width }));
      // One line is what the link is taken for before its layout: laid out so, it is not drawn again (a text is drawn again only when it wraps).
      setHeld((was) => (next.length <= 1 ? null : was !== null && was.words === children && sameLines(was.lines, next) ? was : { words: children, lines: next }));
    },
    [children],
  );
  const lines = held !== null && held.words === children ? held.lines : null;
  // The words themselves, made once for what they are: the lines under them change with their layout (a wrap, back to one line), the words do not,
  // and are not drawn again for it. (How many lines there are is only known from the layout, so the lines are state: what changes is drawn, once.)
  const words = useMemo(
    () => (
      <ReadText size={size} tone={tone} onLines={laid}>
        {children}
      </ReadText>
    ),
    [size, tone, laid, children],
  );
  // The first line's underline stands where the web puts it under a line of this size; each line after it as far below it as the phone set that line.
  const under = webBaseline('read', 400, size, size * BODY.lineHeight) + (offset === 'auto' ? AUTO_OFFSET : offset);
  const strip = { position: 'absolute', height: 1, backgroundColor: COLORS[tone], pointerEvents: 'none' } as const;
  return (
    <View>
      {words}
      {lines === null ? (
        <View testID="underline" aria-hidden style={{ ...strip, left: 0, right: 0, top: under }} />
      ) : (
        lines.map((line, i) => <View key={i} testID="underline" aria-hidden style={{ ...strip, left: line.x, width: line.width, top: under + line.y - lines[0].y }} />)
      )}
    </View>
  );
}
