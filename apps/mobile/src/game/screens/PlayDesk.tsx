import type { Stage } from '@ratrace/core/game/store';
import type { ReactNode, Ref } from 'react';
import type { ScreenScroller } from '../../ui/Page';

/*
 * The desk's Play: a life in three columns on a wide screen, the web's (`PlayDesk.web.tsx`). The phone has no desk (`useIsDesk` is never true on
 * it), so Play never draws this here, and the phone carries none of it.
 */

/** What Play hands the desk: the pieces it makes of the round, the desk laying them out in its columns. */
export interface PlayDeskProps {
  stage: Stage;
  /** The page's heading, for a screen reader (the web's `sr-only` h1). */
  heading: string;
  /** What the stage is called, for someone who cannot see it change. */
  stageName: string;
  /** In a room, its bar over the stage. */
  bar?: ReactNode;
  /** The stage and what follows it (in a room, its order under a round's ledger). */
  main: ReactNode;
  /** The next thing to do, or null where the stage itself is the choice. */
  actions: ReactNode | null;
  /** What stands over the page and does not scroll (toasts, the coins, the calendar, the moments). */
  fixed: ReactNode;
  /** How Play takes a new stage back to the top. */
  scroller?: Ref<ScreenScroller>;
}

/** Nothing on the phone: Play draws its own one column there. */
export function PlayDesk(props: PlayDeskProps): ReactNode {
  void props;
  return null;
}

/** At desk width, a row stuck to the top of the page as it scrolls (the finances' tabs). The phone has no desk: it is its row as it is. */
export function StuckTop({ children }: { children: ReactNode }): ReactNode {
  return children;
}
