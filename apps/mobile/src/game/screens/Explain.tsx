import { useState } from 'react';
import { Pressable, type ViewStyle } from 'react-native';
import { usePress } from '../../ui/kit';
import { LinkText } from '../../ui/LinkText';
import { ReadText, SNUG } from '../../ui/text';
import { TOUCH } from '../../ui/theme';
import { useT } from '../context';

/**
 * An explanation kept out of the way until it is wanted: a "What is this?" link, and the text in
 * its place once tapped. The figures and the things to do stay in sight; the reading does not crowd them.
 * `style` is where its parent places it (the web's `className`: `mb-1` in a sheet of figures).
 */
export function Explain({ children, style }: { children: string; style?: ViewStyle }) {
  const t = useT('common');
  const [open, setOpen] = useState(false);
  const press = usePress({ onPress: () => setOpen(true) });
  if (open) {
    return (
      <ReadText size={13} lineHeight={13 * SNUG} tone="ink-200" style={style}>
        {children}
      </ReadText>
    );
  }
  return (
    // The web's link is a button: 44 tall, its line in the middle of it, as wide as its words.
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: false }}
      aria-expanded={false}
      onPress={press}
      style={[{ minHeight: TOUCH, alignSelf: 'flex-start', justifyContent: 'center' }, style]}
    >
      {/* The web's `underline underline-offset-4` on Chakra Petch at 13, under every line. */}
      <LinkText size={13} offset={4}>{t('whatIsThis')}</LinkText>
    </Pressable>
  );
}
