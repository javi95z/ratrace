import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { RefreshControl } from 'react-native';
import { COLORS } from './theme';

/** The least time the spinner is shown once pulled: an answer quicker than this would flash it, and a pull would seem to do nothing. */
export const REFRESH_AT_LEAST_MS = 450;

/**
 * Pulling a page down past its top to read it again, as the phone's own lists are (`RefreshControl`: iOS's UIRefreshControl, Android's swipe to
 * refresh), in the game's gold on its night. `refresh` is asked once a pull is let go past the platform's point; the spinner turns until it has
 * answered (and at least `REFRESH_AT_LEAST_MS`), whatever it answers: a page that could not be read says so itself. A page with nothing to read
 * again (`refresh` undefined) is pulled as before, with no spinner. On the web nothing: a browser has its own pull to reload (`refresh.web.tsx`).
 */
export function usePullRefresh(refresh: (() => Promise<unknown>) | undefined): ReactElement | undefined {
  const [refreshing, setRefreshing] = useState(false);
  const asked = useRef(refresh);
  asked.current = refresh;
  // Gone while it turned, it sets nothing.
  const live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
    },
    [],
  );
  const onRefresh = useCallback(() => {
    const read = asked.current;
    if (!read) return;
    setRefreshing(true);
    const shown = new Promise((done) => setTimeout(done, REFRESH_AT_LEAST_MS));
    void Promise.all([read().catch(() => undefined), shown]).then(() => {
      if (live.current) setRefreshing(false);
    });
  }, []);
  if (!refresh) return undefined;
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={COLORS['gold-500']}
      colors={[COLORS['gold-500']]}
      progressBackgroundColor={COLORS['night-700']}
    />
  );
}
