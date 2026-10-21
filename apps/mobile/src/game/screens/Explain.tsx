import { useState } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { webBaseline } from '../../ui/fonts';
import { usePress } from '../../ui/kit';
import { ReadText, SNUG } from '../../ui/text';
import { COLORS, TOUCH } from '../../ui/theme';
import { useT } from '../context';

/**
 * The line under the link, as the web draws it (`underline underline-offset-4` on Chakra Petch at 13): its top 4 points under the
 * baseline the browser gives a line of 13 × 1.45, and as thick as the font's own underline. Drawn, not asked of the font: iOS puts
 * its underline where the font says, with no offset.
 */
const UNDERLINE = { top: webBaseline('read', 400, 13, 13 * 1.45) + 4, thick: 1 };

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
      <View>
        <ReadText size={13} tone="sky-300">{t('whatIsThis')}</ReadText>
        <View style={{ position: 'absolute', left: 0, right: 0, top: UNDERLINE.top, height: UNDERLINE.thick, backgroundColor: COLORS['sky-300'] }} />
      </View>
    </Pressable>
  );
}
