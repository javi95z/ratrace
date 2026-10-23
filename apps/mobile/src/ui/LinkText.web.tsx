import type { TextStyle } from 'react-native';
import { ReadText } from './text';
import { COLORS, type ColorToken } from './theme';

/**
 * The web's twin of `LinkText.tsx`: the words of a link, in the reading face, underlined by the browser, as the Next web's `underline
 * underline-offset-N` is (`offset`, or the font's own place for `'auto'`: the web's `underline` alone). The browser draws the line under every line
 * the words wrap to, as wide as its words, and round the descenders (`text-decoration-skip-ink`), where the phone draws its lines by hand.
 */
export function LinkText({ size, offset, tone = 'sky-300', children }: { size: number; offset: number | 'auto'; tone?: ColorToken; children: string }) {
  // `text-underline-offset` is no style of React Native's: react-native-web writes it as it is given.
  const underline = { textDecorationLine: 'underline', textDecorationColor: COLORS[tone], textUnderlineOffset: offset === 'auto' ? 'auto' : `${offset}px` } as TextStyle;
  return (
    <ReadText size={size} tone={tone} style={underline}>
      {children}
    </ReadText>
  );
}
