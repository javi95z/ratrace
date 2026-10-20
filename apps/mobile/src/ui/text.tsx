import type { ReactNode } from 'react';
import { Text, type TextStyle } from 'react-native';
import { runsOf, type Weight } from './fonts';
import { BODY, COLORS, type ColorToken } from './theme';

interface TextProps {
  /** The text itself: it is cut into runs by font, so it must be a string. */
  children: string;
  size?: number;
  tone?: ColorToken;
  style?: TextStyle;
  /** Cuts the text to this many lines, with an ellipsis (the web's `truncate` is 1). */
  numberOfLines?: number;
}

function Runs({ role, weight, size, tone, lineHeight, letterSpacing, children, style, numberOfLines }: TextProps & {
  role: 'pixel' | 'read';
  weight: Weight;
  lineHeight: number;
  letterSpacing: number;
  size: number;
  tone: ColorToken;
}): ReactNode {
  return (
    <Text selectable={false} numberOfLines={numberOfLines} style={[{ color: COLORS[tone], fontSize: size, lineHeight, letterSpacing }, style]}>
      {runsOf(children, role, weight).map((run, i) => (
        <Text key={i} style={{ fontFamily: run.family, fontSize: size * run.scale }}>
          {run.text}
        </Text>
      ))}
    </Text>
  );
}

/**
 * Titles and numbers: Jersey 15 (Oswald for Russian letters, Chakra for signs Jersey lacks), each font
 * scaled to the web's small-letter height, letter spacing 0.03 em, line height 1.1. The web also takes
 * 0.16 em off Russian word spaces; here a space between Russian words is already Oswald's own.
 */
export function PixelText({ size = BODY.size, tone = BODY.color, children, style, numberOfLines }: TextProps) {
  return (
    <Runs role="pixel" weight={400} size={size} tone={tone} lineHeight={size * 1.1} letterSpacing={size * 0.03} style={style} numberOfLines={numberOfLines}>
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
