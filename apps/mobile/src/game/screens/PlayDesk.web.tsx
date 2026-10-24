import { useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions, type ScrollViewInstance, type ViewStyle } from 'react-native';
import { Framed } from '../../ui/Frame';
import { Panel, SrOnly } from '../../ui/kit';
import { KEYBOARD, scrollToShow } from '../../ui/Page';
import { ArtScale } from '../../ui/Sprite';
import { PixelText } from '../../ui/text';
import { COLORS, GUTTER } from '../../ui/theme';
import { useT } from '../context';
import { BasketList } from './Finance';
import { Hud } from './Hud';
import { Headlines } from './News';
import type { PlayDeskProps } from './PlayDesk';
import { Leave, ProfileBody } from './Profile';

export type { PlayDeskProps } from './PlayDesk';

/*
 * A life on a wide screen, as the Next web lays it from 1024 px (apps/web/src/game/screens/Play.tsx, its `desk`): three columns in one page that
 * scrolls, at most 1480 wide with 16 at its sides and between the columns: who you are (the Hud, flush, and the profile), the round, and the world
 * with this round's orders. The two sides stick to the top of the window and scroll on their own when taller than it, their scrollbars hidden (the
 * web's `no-scrollbar sticky top-safe max-h-safe overflow-y-auto`). The round's column is at most 680 wide, its art drawn twice as large where the
 * column has room for a card that wide (640: the web's `@container` with `@min-[640px]:[--art:2]`), and in the finances its button sticks to the
 * foot. Skip links lead the keyboard to each column (`docs/keyboard.md`), out of sight until one has the focus.
 */

/** The web's grid: `minmax(280px,372px) minmax(360px,1fr) minmax(260px,340px)`, `gap-4 px-4`, `max-w-[1480px]`. */
const GRID = { max: 1480, pad: 16, gap: 16, left: [280, 372], middle: 360, right: [260, 340] } as const;

/**
 * The widths of the three columns on a page `width` wide, as Chrome sizes the web's grid: each column starts at its least; the room left goes to
 * the two sides equally until each reaches its most (the right first, at 340), and then all of it to the middle (the `1fr`).
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

/** The round's column at most this wide (the web's `max-w-[680px]`), and its art at twice its size from this width of its column (`@min-[640px]`). */
const STAGE = { max: 680, artFrom: 640 } as const;

/** CSS react-native-web passes through that React Native's types do not name: `position: sticky`, `fixed`. */
const css = (style: Record<string, unknown>): ViewStyle => style as ViewStyle;

/** A skip link: a gold button that leads the focus to a part of the page (`id`), drawn only while it, or another of them, has the focus. */
function SkipLink({ target, label, onFocus, onBlur }: { target: string; label: string; onFocus(): void; onBlur(): void }) {
  return (
    <Pressable
      accessibilityRole="link"
      onFocus={onFocus}
      onBlur={onBlur}
      onPress={() => {
        // The address is left as it is (no `#`): the router would take a new hash for a page to open.
        const to = document.getElementById(target);
        to?.focus();
        to?.scrollIntoView?.({ block: 'nearest' });
      }}
    >
      <Framed kind="raised" style={{ backgroundColor: COLORS['gold-500'], paddingHorizontal: 12, paddingVertical: 8 }}>
        <PixelText tone="ink-900">{label}</PixelText>
      </Framed>
    </Pressable>
  );
}

/** The skip links of the desk, in the web's order: the round, the profile, the news, the orders (in the finances), the round's actions. */
function SkipLinks({ finance, actions }: { finance: boolean; actions: boolean }) {
  const t = useT('keyboard.skip');
  const [focused, setFocused] = useState(0);
  const on = () => setFocused((n) => n + 1);
  const off = () => setFocused((n) => Math.max(0, n - 1));
  const links: Array<[string, string]> = [
    ['round-stage', t('stage')],
    ['player-profile', t('profile')],
    ['round-news', t('news')],
    ...(finance ? ([['round-orders', t('orders')]] as Array<[string, string]>) : []),
    ...(actions ? ([['round-actions', t('actions')]] as Array<[string, string]>) : []),
  ];
  return (
    // The web's `.skip-links`: fixed 12 from the top left, over everything, lifted out of sight until one of them has the focus (`:focus-within`).
    <View
      role="navigation"
      aria-label={t('stage')}
      style={css({ position: 'fixed', left: 12, top: 12, zIndex: 80, flexDirection: 'row', gap: 8, transform: focused > 0 ? 'translateY(0)' : 'translateY(-180%)' })}
    >
      {links.map(([target, label]) => (
        <SkipLink key={target} target={target} label={label} onFocus={on} onBlur={off} />
      ))}
    </View>
  );
}

/** A side column: sticky to the top of the window, as tall as it at most, scrolling on its own, its scrollbar hidden. */
function Aside({ id, label, width, height, style, children }: { id: string; label: string; width: number; height: number; style: ViewStyle; children: ReactNode }) {
  return (
    <ScrollView
      {...KEYBOARD}
      nativeID={id}
      {...{ tabIndex: -1 }}
      role="complementary"
      aria-label={label}
      showsVerticalScrollIndicator={false}
      style={css({ position: 'sticky', top: 0, width, maxHeight: height, flexGrow: 0, flexShrink: 0, alignSelf: 'flex-start' })}
      contentContainerStyle={[{ paddingHorizontal: 4, gap: 12 }, style]}
    >
      {children}
    </ScrollView>
  );
}

/**
 * A row stuck to the top of the page as it scrolls, on the page's ground, across the round's whole column (the web's finances' tabs at desk width,
 * `sticky top-0 z-10 bg-night-800`): the column's gutter is its own, given back to what it holds.
 */
export function StuckTop({ children }: { children: ReactNode }) {
  return <View style={css({ position: 'sticky', top: 0, zIndex: 10, backgroundColor: COLORS['night-800'], marginHorizontal: -GUTTER, paddingHorizontal: GUTTER })}>{children}</View>;
}

/** Play at desk width (`PlayDeskProps`, made by Play). */
export function PlayDesk({ stage, heading, stageName, bar, main, actions, fixed, scroller }: PlayDeskProps) {
  const profile = useT('profile');
  const news = useT('news');
  const finance = useT('finance');
  const window = useWindowDimensions();
  // The page's own width once laid out (a classic scrollbar takes its own off the window's); the window's until then.
  const [page, setPage] = useState<number | null>(null);
  const columns = deskColumns(page ?? window.width);
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
  const column: ViewStyle = { width: '100%', maxWidth: STAGE.max, alignSelf: 'center' };
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        {...KEYBOARD}
        ref={scrolling}
        onLayout={(event) => {
          where.current.viewport = event.nativeEvent.layout.height;
          setPage(event.nativeEvent.layout.width);
        }}
        onScroll={(event) => void (where.current.offset = event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
        contentContainerStyle={{ width: '100%', maxWidth: GRID.max, alignSelf: 'center', minHeight: window.height, flexDirection: 'row', gap: GRID.gap, paddingHorizontal: GRID.pad }}
      >
        <SkipLinks finance={finances} actions={actions !== null} />
        <Aside id="player-profile" label={profile('title')} width={columns.left} height={window.height} style={{ paddingTop: 8, paddingBottom: 20 }}>
          <View accessibilityRole="header" style={{ position: 'absolute' }}>
            <SrOnly>{heading}</SrOnly>
          </View>
          {/* The Hud flush with the column: its portrait's row, the figures and the way out, 8 apart, under the header's 12. No skyline, no sticking. */}
          <View style={{ paddingTop: 12, gap: 8 }}>
            <Hud part="lead" skyline={false} flush />
            <Hud part="header" flush />
            <Hud part="wayOut" />
          </View>
          <ProfileBody />
          <Leave />
        </Aside>

        <View style={{ width: columns.middle, minWidth: 0, minHeight: window.height, flexShrink: 0 }}>
          {bar ? <View style={[column, { paddingHorizontal: GUTTER, paddingTop: 12 }]}>{bar}</View> : null}
          <ArtScale.Provider value={art}>
            <View
              nativeID="round-stage"
              {...{ tabIndex: -1 }}
              role="main"
              aria-label={stageName}
              style={[column, css({ outlineStyle: 'none' }), { paddingHorizontal: GUTTER, paddingTop: 20, paddingBottom: finances ? 24 : 16, flexGrow: finances ? 1 : 0 }]}
            >
              {main}
            </View>
          </ArtScale.Provider>
          {actions !== null ? (
            // The finances are long, so their button stays in reach at the bottom. Everywhere else it follows what was just read.
            <View
              nativeID="round-actions"
              {...{ tabIndex: -1 }}
              style={finances ? css({ position: 'sticky', bottom: 0, zIndex: 20, backgroundColor: COLORS['night-800'], paddingTop: 12, paddingBottom: 20 }) : { paddingBottom: 32 }}
            >
              <View style={{ width: '100%', maxWidth: 448, alignSelf: 'center', paddingHorizontal: GUTTER }}>{actions}</View>
            </View>
          ) : null}
        </View>

        <Aside id="round-news" label={news('title')} width={columns.right} height={window.height} style={{ paddingVertical: 20 }}>
          <Headlines />
          {finances ? (
            <View nativeID="round-orders" {...{ tabIndex: -1 }}>
              <Panel title={finance('basketTitle')}>
                <BasketList />
              </Panel>
            </View>
          ) : null}
        </Aside>
      </ScrollView>
      {fixed}
    </View>
  );
}
