import type { ComponentProps } from 'react';
import { View } from 'react-native';

/**
 * The web export's twin of `GestureRoot.tsx` (Metro picks it for the web): a plain view. The gesture handler needs no root of its own in a browser
 * (it asks for one on the phone only), so the handler is loaded with the screens that drag (the cards, the slider), never by the first page.
 */
export function GestureRoot(props: ComponentProps<typeof View>) {
  return <View {...props} />;
}
