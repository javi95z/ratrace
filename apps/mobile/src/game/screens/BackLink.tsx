import type { ViewStyle } from 'react-native';
import { Raised } from '../../ui/kit';
import { PixelText } from '../../ui/text';
import { useT } from '../words';
import { useGo } from '../pages';

/**
 * The square with an arrow at the head of every page after the front door: the way back to it (the web's `Link href="/"`).
 * It dismisses what stands over the front door, or, where the page was opened with no front door under it, takes its place.
 * `place` is where the page puts it.
 */
export function BackLink({ place }: { place?: ViewStyle }) {
  const common = useT('common');
  const go = useGo();
  return (
    <Raised role="link" label={common('back')} bg="night-700" onPress={() => go.home()} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }} place={place}>
      <PixelText size={18} tone="ink-200">{'←'}</PixelText>
    </Raised>
  );
}
