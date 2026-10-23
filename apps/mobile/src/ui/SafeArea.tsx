import type { ReactNode } from 'react';

/**
 * Where the screens learn the safe areas of the screen they are drawn on. On the phone the router's own provider measures them (expo-router's
 * `SafeAreaProvider`, round every route), so nothing is added: the web's twin (`SafeArea.web.tsx`) measures them where the router does not.
 */
export function SafeArea({ children }: { children: ReactNode }): ReactNode {
  return children;
}
