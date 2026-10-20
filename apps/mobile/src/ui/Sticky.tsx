import { createContext, useContext, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { Screen } from './Page';
import { COLORS, GUTTER } from './theme';

/** How far the page has scrolled, kept outside React so that a scroll does not draw every screen: only what asks about it. */
interface ScrollOffset {
  get(): number;
  set(y: number): void;
  subscribe(notify: () => void): () => void;
}

function scrollOffset(): ScrollOffset {
  let y = 0;
  const watchers = new Set<() => void>();
  return {
    get: () => y,
    set(next) {
      y = next;
      watchers.forEach((notify) => notify());
    },
    subscribe(notify) {
      watchers.add(notify);
      return () => void watchers.delete(notify);
    },
  };
}

/** What a `StickyScreen` holds out to what is inside it; a screen that is not one has never scrolled. */
const Offset = createContext<ScrollOffset>(scrollOffset());

/**
 * Whether the page of the `StickyScreen` this stands in has scrolled past `px` points. This is what the web's
 * `IntersectionObserver` is for the Hud's "away" strip: it draws again when the answer changes, never for a scroll that
 * leaves it as it was.
 */
export function useScrolledPast(px: number): boolean {
  const offset = useContext(Offset);
  return useSyncExternalStore(offset.subscribe, () => offset.get() > px, () => false);
}

/** The sticky block: night-800 across the page's width, out over the gutter so that a frame's outline passing under it is hidden. */
const BLOCK: ViewStyle = { backgroundColor: COLORS['night-800'], marginHorizontal: -GUTTER, paddingHorizontal: GUTTER };

/**
 * A `Screen` whose `header` stays at the top, under the top inset, while the column scrolls (the web's `sticky top-safe`):
 * the scroll's first child is the one that sticks (`stickyHeaderIndices`). `subHeader` is a second row under it that
 * stays with it (the Finance tabs under the Hud). React Native's sticky rows do not stack, the next one pushes the last
 * off, so both rows are one sticky child. `onScroll` hears the offset in points; a header that only needs to know whether
 * the page has gone past a point asks `useScrolledPast`. `fixed`, `bar` and `contentStyle` are the Screen's own.
 */
export function StickyScreen({
  header,
  subHeader,
  children,
  fixed,
  bar,
  contentStyle,
  onScroll,
}: {
  header: ReactNode;
  subHeader?: ReactNode;
  children?: ReactNode;
  fixed?: ReactNode;
  bar?: ReactNode;
  contentStyle?: ViewStyle;
  onScroll?: (y: number) => void;
}) {
  const offset = useRef<ScrollOffset | null>(null);
  offset.current ??= scrollOffset();
  const store = offset.current;
  return (
    <Offset.Provider value={store}>
      <Screen
        sticky={[0]}
        onScroll={(y) => {
          store.set(y);
          onScroll?.(y);
        }}
        fixed={fixed}
        bar={bar}
        contentStyle={contentStyle}
      >
        <View style={BLOCK}>
          {header}
          {subHeader}
        </View>
        {children}
      </Screen>
    </Offset.Provider>
  );
}
