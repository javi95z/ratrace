import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { webBaseline } from './fonts';
import { ReadText, type TextLine } from './text';
import { BODY, COLORS, type ColorToken } from './theme';

/** A line of the words as the phone laid it out: where it starts, how far down it stands, and how wide it is. */
type Laid = Readonly<{ x: number; y: number; width: number }>;

/** Two layouts alike, line for line: laid out again the same way, the link is not drawn again. */
const sameLines = (a: readonly Laid[] | null, b: readonly Laid[]): boolean =>
  a !== null && a.length === b.length && a.every((line, i) => line.x === b[i].x && line.y === b[i].y && line.width === b[i].width);

/**
 * The words of a link, in the reading face, underlined as the web underlines them (`underline underline-offset-N` on a line of `size` × 1.45): every
 * line the words wrap to has a line of its own under it, as wide as its words, `offset` under the baseline the browser gives that line. The lines
 * are drawn, not asked of the font: iOS puts a font's underline where the font says, with no offset. Until the phone has laid the words out they are
 * taken for one line, which nearly every link is; a link that wraps (a Russian one in a narrow column) is underlined line by line once it has.
 * The lines are decoration: they take no touch, and a screen reader reads the words.
 */
export function LinkText({ size, offset, tone = 'sky-300', children }: { size: number; offset: number; tone?: ColorToken; children: string }) {
  const [lines, setLines] = useState<readonly Laid[] | null>(null);
  const laid = useCallback((told: readonly TextLine[]) => {
    const next = told.map(({ x, y, width }) => ({ x, y, width }));
    setLines((held) => (sameLines(held, next) ? held : next));
  }, []);
  // The first line's underline stands where the web puts it under a line of this size; each line after it as far below it as the phone set that line.
  const under = webBaseline('read', 400, size, size * BODY.lineHeight) + offset;
  const strip = { position: 'absolute', height: 1, backgroundColor: COLORS[tone], pointerEvents: 'none' } as const;
  return (
    <View>
      <ReadText size={size} tone={tone} onLines={laid}>
        {children}
      </ReadText>
      {lines === null || lines.length === 0 ? (
        <View testID="underline" aria-hidden style={{ ...strip, left: 0, right: 0, top: under }} />
      ) : (
        lines.map((line, i) => <View key={i} testID="underline" aria-hidden style={{ ...strip, left: line.x, width: line.width, top: under + line.y - lines[0].y }} />)
      )}
    </View>
  );
}
