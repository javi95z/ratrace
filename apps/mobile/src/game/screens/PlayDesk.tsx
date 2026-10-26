import type { Stage } from '@ratrace/core/game/store';
import { useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import { ScrollView, View, useWindowDimensions, type ScrollViewInstance, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Panel } from '../../ui/kit';
import { KEYBOARD, scrollToShow, type ScreenScroller } from '../../ui/Page';
import { ArtScale } from '../../ui/Sprite';
import { COLORS, GUTTER } from '../../ui/theme';
import { useT } from '../context';
import { BasketList, FinanceTabs } from './Finance';
import { Hud } from './Hud';
import { Headlines } from './News';
import { Leave, ProfileBody } from './Profile';

/*
 * A life on a tablet held sideways (the web's desk, `PlayDesk.web.tsx`, from `useIsDesk`'s width): three columns side by side, each scrolling on
 * its own as a tablet's own split views do: who you are (the Hud, flush, and the profile), the round, and the world with this round's orders. The
 * round's column holds the finances' tabs over what scrolls and the next thing to do under it, at the foot, where the thumb is; its art is drawn
 * twice as large where the column has room for a card that wide. The window's safe areas are left to the sides and the foot.
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

/** The web's grid: `minmax(280px,372px) minmax(360px,1fr) minmax(260px,340px)`, `gap-4 px-4`, `max-w-[1480px]`. */
const GRID = { max: 1480, pad: 16, gap: 16, left: [280, 372], middle: 360, right: [260, 340] } as const;

/**
 * The widths of the three columns on a screen `width` wide, as the web's grid sizes them: each column starts at its least; the room left goes to the
 * two sides equally until each reaches its most (the right first, at 340), and then all of it to the middle (the `1fr`).
 */
export function deskColumns(width: number): { left: number; middle: number; right: number } {
  const inner = Math.min(width, GRID.max) - 2 * GRID.pad - 2 * GRID.gap;
  let free = Math.max(0, inner - GRID.left[0] - GRID.middle - GRID.right[0]);
  const both = Math.min(free / 2, GRID.left[1] - GRID.left[0], GRID.right[1] - GRID.right[0]);
  let left = GRID.left[0] + both;
  const right = GRID.right[0] + both;
  free -= 2 * both;
  const more = Math.min(free, GRID.left[1] - left);
  left += more;
  free -= more;
  return { left, middle: GRID.middle + free, right };
}

/** The round's column at most this wide (the web's `max-w-[680px]`), and its art at twice its size from this width of its column. */
const STAGE = { max: 680, artFrom: 640 } as const;

/** A side column: scrolling on its own, its scrollbar hidden, the foot's safe area left under what it holds. */
function Aside({ label, width, bottom, style, children }: { label: string; width: number; bottom: number; style: ViewStyle; children: ReactNode }) {
  return (
    <ScrollView
      {...KEYBOARD}
      role="complementary"
      aria-label={label}
      showsVerticalScrollIndicator={false}
      style={{ width, flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={[{ paddingHorizontal: 4, gap: 12, paddingBottom: bottom + 20 }, style]}
    >
      {children}
    </ScrollView>
  );
}

/** At desk width the finances' tabs are drawn by the desk itself, over what scrolls in the round's column (`PlayDesk`): nothing where Play puts them. */
export function StuckTop(props: { children: ReactNode }): ReactNode {
  void props;
  return null;
}

/** Play on a tablet held sideways (`PlayDeskProps`, made by Play). */
export function PlayDesk({ stage, heading, stageName, bar, main, actions, fixed, scroller }: PlayDeskProps) {
  const profile = useT('profile');
  const news = useT('news');
  const finance = useT('finance');
  const window = useWindowDimensions();
  const inset = useSafeAreaInsets();
  // The width the columns share once laid out (the window's less its side insets); the window's until then.
  const [page, setPage] = useState<number | null>(null);
  const columns = deskColumns(page ?? window.width - inset.left - inset.right);
  const scrolling = useRef<ScrollViewInstance>(null);
  const where = useRef({ offset: 0, viewport: 0 });
  useImperativeHandle(
    scroller,
    () => ({
      reveal(y, height, animated = true) {
        const to = scrollToShow(where.current.offset, where.current.viewport, y, height, GUTTER);
        if (to !== null) scrolling.current?.scrollTo({ y: to, animated });
      },
    }),
    [],
  );
  const finances = stage === 'finance';
  const art = Math.min(columns.middle, STAGE.max) >= STAGE.artFrom ? 2 : 1;
  const column: ViewStyle = { width: '100%', maxWidth: STAGE.max, alignSelf: 'center', paddingHorizontal: GUTTER };
  const foot = Math.max(16, inset.bottom);
  return (
    <View style={{ flex: 1 }}>
      <View
        onLayout={(event) => setPage(event.nativeEvent.layout.width)}
        style={{ flex: 1, width: '100%', maxWidth: GRID.max, alignSelf: 'center', flexDirection: 'row', gap: GRID.gap, paddingLeft: GRID.pad + inset.left, paddingRight: GRID.pad + inset.right }}
      >
        <Aside label={profile('title')} width={columns.left} bottom={inset.bottom} style={{ paddingTop: 8 }}>
          {/* The Hud flush with the column: its portrait's row, the figures and the way out, 8 apart. No skyline, no sticking. */}
          <View style={{ paddingTop: 12, gap: 8 }}>
            <Hud part="lead" skyline={false} flush />
            <Hud part="header" flush />
            <Hud part="wayOut" />
          </View>
          <ProfileBody />
          <Leave />
        </Aside>

        <View style={{ width: columns.middle, minWidth: 0, flexShrink: 0 }}>
          {/* The finances' tabs stand over what scrolls, as a tablet's own tabs over their pages. */}
          {finances ? (
            <View style={[column, { paddingTop: 8 }]}>
              <FinanceTabs />
            </View>
          ) : null}
          <ScrollView
            {...KEYBOARD}
            ref={scrolling}
            onLayout={(event) => void (where.current.viewport = event.nativeEvent.layout.height)}
            onScroll={(event) => void (where.current.offset = event.nativeEvent.contentOffset.y)}
            scrollEventThrottle={16}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: actions !== null ? 16 : foot + 16 }}
          >
            {bar ? <View style={[column, { paddingTop: 12 }]}>{bar}</View> : null}
            <ArtScale.Provider value={art}>
              <View role="main" aria-label={`${heading}. ${stageName}`} style={[column, { paddingTop: finances ? 4 : 20 }]}>
                {main}
              </View>
            </ArtScale.Provider>
          </ScrollView>
          {/* The next thing to do, at the foot of the round's column, where the thumb is. */}
          {actions !== null ? (
            <View style={{ backgroundColor: COLORS['night-900'], paddingTop: 12, paddingBottom: foot }}>
              <View style={{ width: '100%', maxWidth: 448, alignSelf: 'center', paddingHorizontal: GUTTER }}>{actions}</View>
            </View>
          ) : null}
        </View>

        <Aside label={news('title')} width={columns.right} bottom={inset.bottom} style={{ paddingTop: 20 }}>
          <Headlines />
          {finances ? (
            <Panel title={finance('basketTitle')}>
              <BasketList />
            </Panel>
          ) : null}
        </Aside>
      </View>
      {fixed}
    </View>
  );
}
