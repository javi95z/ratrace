import { View } from 'react-native';
import { PixelText } from '../../ui/text';

/** A heading of a section of a page (the web's `pixel mb-2 text-[15px] uppercase tracking-[0.1em] text-gold-500`): the records' and the collection's. */
export function Heading({ children }: { children: string }) {
  return (
    <View accessibilityRole="header" style={{ marginBottom: 8 }}>
      <PixelText size={15} tone="gold-500" style={{ letterSpacing: 15 * 0.1, textTransform: 'uppercase' }}>{children}</PixelText>
    </View>
  );
}
