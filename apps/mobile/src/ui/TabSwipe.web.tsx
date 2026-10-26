import type { ReactNode } from 'react';

/** Nothing on the web: a page's tabs are chosen in their strip, never swiped (the phone's is `TabSwipe.tsx`). */
export function TabSwipe<T extends string>({ children }: { tabs: readonly T[]; value: T; onChange(tab: T): void; children: ReactNode }) {
  return <>{children}</>;
}
