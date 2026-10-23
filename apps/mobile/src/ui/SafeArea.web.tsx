import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/**
 * The web's twin of `SafeArea.tsx`. expo-router's provider on the web gives every screen no safe areas at all (its `SafeAreaProvider` answers zero
 * insets, so that streamed pages hydrate unchanged), and a page that reaches under an iPhone's notch and home bar (`viewport-fit=cover`, public/index.html,
 * as the Next web's) would draw under them. The library's own provider measures what the browser gives the page (`env(safe-area-inset-*)`), and the
 * screens clear it as the Next web's `pt-safe` and `pb-safe` do.
 */
export function SafeArea({ children }: { children: ReactNode }): ReactNode {
  return <SafeAreaProvider style={{ flex: 1 }}>{children}</SafeAreaProvider>;
}
