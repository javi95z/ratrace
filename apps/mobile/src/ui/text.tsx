import { createContext, useContext, type ReactNode } from 'react';
import { PixelRatio, Platform, StyleSheet, Text, type TextStyle } from 'react-native';
import { baselineShift, runsOf, type Run, type Weight } from './fonts';
import { BODY, COLORS, type ColorToken } from './theme';

/** The language the page is in (the web's `<html lang>`): Russian titles set their word spaces tighter. */
export const Language = createContext<string>('en');

/** Tailwind's `leading-tight`: a line 1.25 times its size (a Tag, a Stat's label, a hint). */
export const TIGHT = 1.25;

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
  const margin = (side: 'Top' | 'Bottom') => Number(flat[`margin${side}`] ?? flat.marginVertical ?? flat.margin ?? 0);
  return { paddingTop: room + shift, paddingBottom: room, marginTop: margin('Top') - room, marginBottom: margin('Bottom') - room - shift };
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

interface TextProps {
  /** The text itself: it is cut into runs by font, so it must be a string. */
  children: string;
  size?: number;
  tone?: ColorToken;
  style?: TextStyle;
  /** Cuts the text to this many lines, with an ellipsis (the web's `truncate` is 1). */
  numberOfLines?: number;
}

/** A run as nested texts: on a Russian page each space of a title apart, with the web's word spacing added to it. */
function pieces(run: Run, size: number, letterSpacing: number, words: boolean): Array<{ text: string; family: string; fontSize: number; letterSpacing?: number }> {
  const fontSize = size * run.scale;
  if (!words) return [{ text: run.text, family: run.family, fontSize }];
  return run.text
    .split(SPACE)
    .filter((part) => part !== '')
    .map((part) => (SPACE.test(part) ? { text: part, family: run.family, fontSize, letterSpacing: letterSpacing + RU_WORD_SPACING * size } : { text: part, family: run.family, fontSize }));
}

function Runs({ role, weight, size, tone, lineHeight, letterSpacing, children, style, numberOfLines }: TextProps & {
  role: 'pixel' | 'read';
  weight: Weight;
  lineHeight: number;
  letterSpacing: number;
  size: number;
  tone: ColorToken;
}): ReactNode {
  const language = useContext(Language);
  const runs = runsOf(children, role, weight, language);
  const words = role === 'pixel' && language === 'ru';
  // A caller's own line height (a Tag's, a KeyFigure's) is the line the baseline is placed in.
  const flat = StyleSheet.flatten(style) ?? {};
  const line = flat.lineHeight ?? lineHeight;
  const drawn = Platform.OS === 'ios' ? onGrid(line, PixelRatio.get()) : line;
  const shift = baselineShift(runs, role, weight, size, line, drawn, Platform.OS);
  return (
    <Text
      selectable={false}
      numberOfLines={numberOfLines}
      // No letter spacing at all where there is none: on iOS a spacing of 0 is not nothing, it turns the font's kerning off.
      style={[{ color: COLORS[tone], fontSize: size }, letterSpacing ? { letterSpacing } : null, style, { lineHeight: drawn }, shift ? headroom(shift, size, flat) : null]}
    >
      {runs.flatMap((run) => pieces(run, size, letterSpacing, words)).map((piece, i) => (
        <Text key={i} style={{ fontFamily: piece.family, fontSize: piece.fontSize, ...(piece.letterSpacing === undefined ? null : { letterSpacing: piece.letterSpacing }) }}>
          {piece.text}
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
export function PixelText({ size = BODY.size, tone = BODY.color, children, style, numberOfLines, tracking = true }: TextProps & { tracking?: boolean }) {
  return (
    <Runs role="pixel" weight={400} size={size} tone={tone} lineHeight={size * 1.1} letterSpacing={tracking ? size * 0.03 : 0} style={style} numberOfLines={numberOfLines}>
      {children}
    </Runs>
  );
}

/** Sentences: Chakra Petch 400 or 600 (Exo 2 for Russian letters), 15 pt, line height 1.45, cream. */
export function ReadText({ size = BODY.size, weight = 400, tone = BODY.color, children, style, numberOfLines }: TextProps & { weight?: Weight }) {
  return (
    <Runs role="read" weight={weight} size={size} tone={tone} lineHeight={size * BODY.lineHeight} letterSpacing={0} style={style} numberOfLines={numberOfLines}>
      {children}
    </Runs>
  );
}
