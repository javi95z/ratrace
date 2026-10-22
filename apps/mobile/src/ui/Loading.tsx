import Animated from 'react-native-reanimated';
import { useBlink } from './animations';
import { PixelText } from './text';

/**
 * Something is being read (the web's `pixel animate-blink text-center text-ink-300`): the game opening, the records, a ranking, a life behind a
 * line. `children` is the word for it, the screen's `common.loading`. A file of its own beside the kit (`kit.tsx` takes no animation of Reanimated's).
 */
export function Loading({ children }: { children: string }) {
  const blink = useBlink();
  return (
    <Animated.View style={blink}>
      <PixelText tone="ink-300" style={{ textAlign: 'center' }}>{children}</PixelText>
    </Animated.View>
  );
}
