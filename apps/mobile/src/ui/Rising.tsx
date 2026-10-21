import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRise } from './animations';

/**
 * The web's `animate-rise` on what it holds, `delayMs` after it is drawn (the web's `animation-delay`), on the UI thread. A box of its own: the screen
 * that holds it is not drawn again as it rises. `style` is the box's own (a margin, a rule over it). Where motion is left out it stands at once.
 */
export function Rising({ delayMs = 0, style, children }: { delayMs?: number; style?: ViewStyle; children: ReactNode }) {
  const rise = useRise({ delayMs });
  return <Animated.View style={[style, rise]}>{children}</Animated.View>;
}
