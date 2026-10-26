import type { ReactNode } from 'react';

/** Nothing on the web: a row is taken away by its own button, never swiped (the phone's is `SwipeAway.tsx`). */
export function SwipeAway({ children }: { label: string; gap?: number; onAway(): void; children: ReactNode }) {
  return <>{children}</>;
}
