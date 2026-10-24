import type { ComponentProps } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

/**
 * The one gesture root round every screen, so that a drag can be read anywhere (phase 2's card swipe). On the phone it is the gesture handler's own
 * root, which every gesture needs; the web's twin (`GestureRoot.web.tsx`) is a plain view, so the first page loads none of the handler.
 */
export function GestureRoot(props: ComponentProps<typeof GestureHandlerRootView>) {
  return <GestureHandlerRootView {...props} />;
}
