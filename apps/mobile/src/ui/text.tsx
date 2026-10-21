import { createContext, useContext, useState, type ReactNode } from 'react';
import { PixelRatio, Platform, StyleSheet, Text, type TextLayoutEvent, type TextStyle } from 'react-native';
import { adjustedRuns, baselineShift, faceOf, runsOf, type Run, type Weight } from './fonts';
import { BODY, COLORS, type ColorToken } from './theme';

/** The language the page is in (the web's `<html lang>`): Russian titles set their word spaces tighter. */
export const Language = createContext<string>('en');

/** Tailwind's `leading-tight`: a line 1.25 times its size (a Tag, a Stat's label, a hint). */
export const TIGHT = 1.25;

/** Tailwind's `leading-snug`: a line 1.375 times its size (a paragraph under a heading, a sheet's question). */
export const SNUG = 1.375;

/** What the web's `:lang(ru) .pixel { word-spacing: -0.16em }` takes from each space of a Russian title. */
export const RU_WORD_SPACING = -0.16;

const SPACE = /(\s+)/u;

/**
 * Moves a text's glyphs down by `shift` (up when negative) without moving the text in the layout, and gives it room
 * above and below: iOS clips a text to its box, and a line shorter than its font (a pixel title, a KeyFigure's line of
 * 1) has glyphs that stand out of it, an accent or a dollar sign's stroke, which the browser lets show. A transform
 * would move the box, and the clip with it; padding moves the glyphs inside a box made taller, and margins as large
 * the other way keep its place.
 */
export function headroom(shift: number, size: number, flat: TextStyle): TextStyle {
  const room = Math.ceil(size / 2) + Math.ceil(Math.abs(shift));
  // A caller's own margins and paddings are kept: added to, never replaced.
  const margin = (side: 'Top' | 'Bottom') => Number(flat[`margin${side}`] ?? flat.marginVertical ?? flat.margin ?? 0);
  const padding = (side: 'Top' | 'Bottom') => Number(flat[`padding${side}`] ?? flat.paddingVertical ?? flat.padding ?? 0);
  return {
    paddingTop: padding('Top') + room + shift,
    paddingBottom: padding('Bottom') + room,
    marginTop: margin('Top') - room,
    marginBottom: margin('Bottom') - room - shift,
  };
}

/**
 * A line height on the device's pixel grid, to the nearest pixel. iOS makes a text as tall as its lines rounded *up* to
 * a device pixel, so a line of 21.75 stood 22 tall and every text pushed what follows it down by up to a third of a
 * point more than the web; to the nearest pixel the error is at most a sixth, either way, and does not add up. A hair
 * under the grid line, so that the rounding up keeps it there.
 */
export function onGrid(line: number, density: number): number {
  return Math.round(line * density) / density - 0.001;
}

/**
 * Words that run on in the same text, after its own (the web's inline `<span>`): a text of another colour, or of the reading face inside
 * a pixel text. One Text, so one paragraph that wraps as a whole and has one line height.
 */
export interface Aside {
  text: string;
  /** Their colour, where it is not the text's own. */
  tone?: ColorToken;
  /** Italic, where the text they run on from is not (they are the text's own otherwise, as the web's span takes its parent's). */
  italic?: boolean;
  /**
   * In a pixel text, the size of the reading face (Chakra Petch; Exo 2 for Cyrillic) they are set in, where the pixel text's `font-size-adjust`
   * reaches them (the web's `font-sans text-[13px]` span): larger than the size says. Left out, they are set as the text's own are.
   */
  read?: number;
}

interface TextProps {
  /** The text itself: it is cut into runs by font, so it must be a string. */
  children: string;
  size?: number;
  tone?: ColorToken;
  /** The line, when not the text's own (a Tag's, a KeyFigure's): the line the baseline is placed in. */
  lineHeight?: number;
  /** Anything but the size and the line, which are `size` and `lineHeight`. */
  style?: Omit<TextStyle, 'fontSize' | 'lineHeight'>;
  /** Cuts the text to this many lines, with an ellipsis (the web's `truncate` is 1). */
  numberOfLines?: number;
}

/** What runs on in a reading text: its own face and size, in a colour. */
type ReadAside = Omit<Aside, 'read'>;

/**
 * A run as nested texts: on a Russian page each space of a title apart, with the web's word spacing added to it. `size` is the size the run is set at;
 * `title` the size of the text it is in, whose em the word spacing is (a span inherits the length, not the em).
 */
function pieces(run: Run, size: number, title: number, letterSpacing: number, words: boolean): Array<{ text: string; family: string; fontSize: number; letterSpacing?: number; italic?: boolean }> {
  const fontSize = size * run.scale;
  const family = faceOf(run);
  const italic = run.italic === true ? { italic: true } : null;
  if (!words) return [{ text: run.text, family, fontSize, ...italic }];
  return run.text
    .split(SPACE)
    .filter((part) => part !== '')
    .map((part) => (SPACE.test(part) ? { text: part, family, fontSize, letterSpacing: letterSpacing + RU_WORD_SPACING * title, ...italic } : { text: part, family, fontSize, ...italic }));
}

function Runs({ role, weight, size, tone, lineHeight, standard, letterSpacing, children, style, numberOfLines, after, italic = false }: TextProps & {
  after?: readonly Aside[];
  italic?: boolean;
  role: 'pixel' | 'read';
  weight: Weight;
  /** The line of this kind of text, where the caller names none. */
  standard: number;
  letterSpacing: number;
  size: number;
  tone: ColorToken;
}): ReactNode {
  const language = useContext(Language);
  const runs = runsOf(children, role, weight, language, italic);
  const words = role === 'pixel' && language === 'ru';
  const flat: TextStyle = StyleSheet.flatten(style) ?? {};
  const line = lineHeight ?? standard;
  const ios = Platform.OS === 'ios';
  const density = PixelRatio.get();
  const drawn = ios ? onGrid(line, density) : line;
  // What runs on is in the same line: its fonts are among those the line is set from, each at its own size.
  const ran = (after ?? [])
    .filter((aside) => aside.text !== '')
    .map((aside) => {
      const slanted = aside.italic ?? italic;
      return { ...aside, size: aside.read ?? size, runs: aside.read === undefined ? runsOf(aside.text, role, weight, language, slanted) : adjustedRuns(aside.text, 400, language, slanted) };
    });
  const lineRuns = ran.length === 0 ? runs : [...runs, ...ran.flatMap((aside) => aside.runs.map((run) => ({ ...run, scale: (run.scale * aside.size) / size })))];
  const shift = baselineShift(lineRuns, role, weight, size, line, drawn, Platform.OS, language);
  // Each line is drawn on the device's grid, so n lines are n × (the grid's line − the exact one) taller than the web's, and that adds up across the
  // paragraphs of a page. The box is held to n × the exact line: the lines of one paragraph are as far off as they are, and the next paragraph is not.
  // Only a text that can wrap and whose line is off the grid is asked how many lines it has. A text starts as one line, which is what nearly every one is (and a
  // text cut to one line always is): it is right in the first frame, and `setLines(1)` after the layout changes nothing, so it is never drawn again for it.
  // Only one that wraps is corrected, once, after its layout.
  const [lines, setLines] = useState(1);
  const off = ios ? line - Math.round(line * density) / density : 0;
  const asks = numberOfLines !== 1 && Math.abs(off) > 1e-6;
  const hold = (numberOfLines === 1 || asks) && Math.abs(off) > 1e-6 ? lines * off : 0;
  const room = shift ? headroom(shift, size, flat) : null;
  const held = hold === 0 ? null : { marginBottom: Number(room?.marginBottom ?? flat.marginBottom ?? flat.marginVertical ?? flat.margin ?? 0) + hold };
  return (
    <Text
      selectable={false}
      numberOfLines={numberOfLines}
      onTextLayout={asks ? (event: TextLayoutEvent) => setLines(Math.max(1, event.nativeEvent.lines.length)) : undefined}
      // No letter spacing at all where there is none: on iOS a spacing of 0 is not nothing, it turns the font's kerning off.
      // Words are never pressed (a pressable holds them): with the headroom a text's box reaches past its line, over
      // whatever stands above or below it, and must not take a tap meant for a button there.
      style={[{ color: COLORS[tone], fontSize: size, includeFontPadding: false }, letterSpacing ? { letterSpacing } : null, style, { lineHeight: drawn, pointerEvents: 'none' }, room, held]}
    >
      {runs.flatMap((run) => pieces(run, size, size, letterSpacing, words)).map((piece, i) => (
        <Text key={i} style={{ fontFamily: piece.family, fontSize: piece.fontSize, includeFontPadding: false, ...(piece.letterSpacing === undefined ? null : { letterSpacing: piece.letterSpacing }), ...(piece.italic ? { fontStyle: 'italic' as const } : null) }}>
          {piece.text}
        </Text>
      ))}
      {/* A nested text takes the letter spacing and the word spacing of the one it is in, as the web's span does: the title's, in the size of the title. */}
      {ran.map((aside, a) => (
        <Text key={`aside-${a}`} style={[{ fontSize: aside.size, includeFontPadding: false }, aside.tone ? { color: COLORS[aside.tone] } : null]}>
          {aside.runs.flatMap((run) => pieces(run, aside.size, size, letterSpacing, words)).map((piece, i) => (
            <Text key={i} style={{ fontFamily: piece.family, fontSize: piece.fontSize, includeFontPadding: false, ...(piece.letterSpacing === undefined ? null : { letterSpacing: piece.letterSpacing }), ...(piece.italic ? { fontStyle: 'italic' as const } : null) }}>
              {piece.text}
            </Text>
          ))}
        </Text>
      ))}
    </Text>
  );
}

/**
 * Titles and numbers: Jersey 15 (Oswald for Russian letters, Chakra for signs Jersey lacks), each font
 * scaled to the web's small-letter height, letter spacing 0.03 em (none with `tracking={false}`, the web's
 * `tracking-normal`), line height 1.1. On a Russian page,
 * as on the web, 0.16 em is taken off each word space.
 */
export function PixelText({ size = BODY.size, tone = BODY.color, lineHeight, children, style, numberOfLines, tracking = true, after }: TextProps & { tracking?: boolean; after?: readonly Aside[] }) {
  return (
    <Runs role="pixel" weight={400} size={size} tone={tone} lineHeight={lineHeight} standard={size * 1.1} letterSpacing={tracking ? size * 0.03 : 0} style={style} numberOfLines={numberOfLines} after={after}>
      {children}
    </Runs>
  );
}

/** Sentences: Chakra Petch 400 or 600 (Exo 2 for Russian letters), 15 pt, line height 1.45, cream. */
export function ReadText({ size = BODY.size, weight = 400, tone = BODY.color, lineHeight, children, style, numberOfLines, after, italic = false }: TextProps & { weight?: Weight; after?: readonly ReadAside[]; italic?: boolean }) {
  return (
    <Runs role="read" weight={weight} size={size} tone={tone} lineHeight={lineHeight} standard={size * BODY.lineHeight} letterSpacing={0} style={style} numberOfLines={numberOfLines} after={after} italic={italic}>
      {children}
    </Runs>
  );
}
