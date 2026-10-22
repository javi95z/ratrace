// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { createContext, createRef, useContext } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import dots from '../../assets/ui/dots.png';
import { TILE } from '../../scripts/dots';
import { BottomBar, LIST_WINDOW, ListScreen, PAGE_GROUND, Page, Screen, scrollToShow } from './Page';
import type { ScreenScroller } from './Page';
import { COLORS } from './theme';

// The library's web build needs a native module vitest cannot load: a stand-in with the same two pieces Page uses.
vi.mock('react-native-safe-area-context', () => {
  const Ctx = createContext({ top: 0, bottom: 0, left: 0, right: 0 });
  return {
    SafeAreaProvider: ({ initialMetrics, children }: { initialMetrics: { insets: object }; children: React.ReactNode }) => (
      <Ctx.Provider value={initialMetrics.insets as never}>{children}</Ctx.Provider>
    ),
    useSafeAreaInsets: () => useContext(Ctx),
  };
});

// Reanimated needs the worklets runtime: the shared reactive fake stands in for it (a Screen that follows its scroll on the UI thread takes its scroll view and handler).
vi.mock('react-native-reanimated', async () => (await import('./testing/reanimated')).reanimatedFake());

// Records what Page hands the ground's image: react-native-web does not tile, so the props are what the app controls. And what a ListScreen
// hands its list, which is the real one here (this test has none of the phone tests' stand-ins: it windows its rows).
const seen: Array<{ source: unknown; resizeMode: unknown; style: unknown }> = [];
const listed: Array<Record<string, unknown>> = [];
// And what a Screen hands its scroll, which platform the page is drawn on, and the box that leaves the keyboard its room on Android.
const scrollProps: Array<Record<string, unknown>> = [];
const avoiding: Array<Record<string, unknown>> = [];
const platform = vi.hoisted(() => ({ OS: 'ios' as string }));
vi.mock('react-native', async (orig) => {
  const rn = (await orig()) as typeof import('react-native');
  return {
    ...rn,
    Platform: { ...rn.Platform, get OS() { return platform.OS; } },
    ScrollView: Object.assign(
      (props: Record<string, unknown>) => {
        scrollProps.push(props);
        const Scroll = rn.ScrollView as unknown as (shown: Record<string, unknown>) => React.ReactElement;
        return <Scroll {...props} />;
      },
      { displayName: 'ScrollView' },
    ),
    KeyboardAvoidingView: (props: Record<string, unknown>) => {
      avoiding.push(props);
      return <rn.View testID="keyboard-room">{props.children as React.ReactNode}</rn.View>;
    },
    Image: (props: Record<string, unknown>) => {
      seen.push({ source: props.source, resizeMode: props.resizeMode, style: props.style });
      return <rn.Image {...(props as Record<string, unknown>)} />;
    },
    FlatList: (props: Record<string, unknown>) => {
      listed.push(props);
      const List = rn.FlatList as unknown as (shown: Record<string, unknown>) => React.ReactElement;
      return <List {...props} />;
    },
  };
});

const frame = { x: 0, y: 0, width: 390, height: 844 };
function wrap(inset: { top: number; bottom: number; left: number; right: number }, ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={{ frame, insets: inset }}>{ui}</SafeAreaProvider>);
}
const none = { top: 0, bottom: 0, left: 0, right: 0 };
afterEach(() => {
  cleanup();
  platform.OS = 'ios';
  scrollProps.length = 0;
  avoiding.length = 0;
});

test('Page puts no column round its children: the screens are each their own column, so a bar can span the screen', () => {
  const { getByText } = wrap({ ...none, left: 5, right: 7 }, <Page><Text>hi</Text></Page>);
  for (let el = getByText('hi').parentElement; el; el = el.parentElement) {
    expect(el.style.maxWidth).toBe('');
    expect(el.style.paddingLeft).toBe('');
    expect(el.style.paddingRight).toBe('');
  }
});

/** The nearest box round `el` (itself included) whose style passes `test`. */
function up(el: HTMLElement | null, test: (s: CSSStyleDeclaration) => boolean): HTMLElement | null {
  while (el && !test(el.style)) el = el.parentElement;
  return el;
}

test('a Screen scrolls, and its 12 gutter is inside what scrolls (the web\'s px-3): the outer edge of a frame against it is never cut', () => {
  const { getByText } = wrap({ ...none, bottom: 34, left: 5, right: 7 }, <Screen><Text>hi</Text></Screen>);
  const column = up(getByText('hi'), (s) => s.maxWidth === '448px')!;
  expect(column).not.toBeNull();
  // The column is what scrolls: the content of the scroll, centred, the gutter its padding.
  expect(column.style.alignSelf).toBe('center');
  expect(column.style.width).toBe('100%');
  expect(column.style.paddingLeft).toBe('12px');
  expect(column.style.paddingRight).toBe('12px');
  // Room at the foot for a frame's drop, and past the home indicator.
  expect(column.style.paddingBottom).toBe(`${16 + 34}px`);
  // The scroll itself, which clips, has no gutter of its own: it stands in from the side insets only.
  const scroll = column.parentElement!;
  expect(scroll.style.paddingLeft).toBe('');
  expect(scroll.style.marginLeft).toBe('5px');
  expect(scroll.style.marginRight).toBe('7px');
});

test('what is fixed over a Screen stands in the screen\'s whole box, outside what scrolls (the web\'s position: fixed)', () => {
  const { getByText } = wrap(none, <Screen fixed={<Text>toast</Text>}><Text>hi</Text></Screen>);
  const column = up(getByText('hi'), (s) => s.maxWidth === '448px')!;
  expect(column.contains(getByText('toast'))).toBe(false);
  expect(column.parentElement!.parentElement!.contains(getByText('toast'))).toBe(true);
});

test('a Screen with a bar: the bar is under the scroll, across the screen, and the scroll pads 16 only, since the bar already adds the inset', () => {
  const { getByText } = wrap(
    { ...none, bottom: 34, left: 5, right: 7 },
    <Screen bar={<BottomBar><Text>bar</Text></BottomBar>}><Text>hi</Text></Screen>,
  );
  const column = up(getByText('hi'), (s) => s.maxWidth === '448px')!;
  expect(column.style.paddingBottom).toBe('16px');
  // The bar is a sibling after the scroll, in the screen's one box: it does not scroll away.
  const scroll = column.parentElement!;
  const box = scroll.parentElement!;
  expect(scroll.contains(getByText('bar'))).toBe(false);
  expect(box.contains(getByText('bar'))).toBe(true);
  expect(box.lastElementChild!.contains(getByText('bar'))).toBe(true);
  expect(box.style.flexGrow).toBe('1');
  // The inset is the bar's, once: the home indicator is cleared by the bar, not by the scroll as well.
  const bar = up(getByText('bar'), (s) => s.paddingBottom !== '')!;
  expect(bar.style.paddingBottom).toBe('34px');
  expect(bar.parentElement).toBe(box);
  // Full width: the screen's box has no side padding for the bar to fit inside (the bar pads its own side insets).
  expect(box.style.paddingLeft).toBe('');
  expect(bar.style.paddingLeft).toBe('5px');
  expect(bar.style.paddingRight).toBe('7px');
});

test('a Screen whose bar is not shown this time pads as one with none: the scroll clears the home indicator itself', () => {
  const { getByText } = wrap({ ...none, bottom: 34 }, <Screen bar={false}><Text>hi</Text></Screen>);
  const column = up(getByText('hi'), (s) => s.maxWidth === '448px')!;
  expect(column.style.paddingBottom).toBe(`${16 + 34}px`);
});

test('a Screen with a bar and something fixed keeps both: the bar under the scroll, the fixed piece over the whole box', () => {
  const { getByText } = wrap(
    { ...none, bottom: 34 },
    <Screen bar={<BottomBar><Text>bar</Text></BottomBar>} fixed={<Text>toast</Text>}><Text>hi</Text></Screen>,
  );
  const column = up(getByText('hi'), (s) => s.maxWidth === '448px')!;
  const box = column.parentElement!.parentElement!;
  expect(box.contains(getByText('bar'))).toBe(true);
  expect(box.contains(getByText('toast'))).toBe(true);
  expect(column.contains(getByText('toast'))).toBe(false);
});

test('a Screen takes the caller\'s own spacing of its content', () => {
  const { getByText } = wrap(none, <Screen contentStyle={{ gap: 16, paddingTop: 4 }}><Text>hi</Text></Screen>);
  const column = up(getByText('hi'), (s) => s.maxWidth === '448px')!;
  expect(column.style.paddingTop).toBe('4px');
  expect(column.style.gap).toBe('16px');
  expect(column.style.paddingLeft).toBe('12px');
});

test('the ground is the dots tile, repeated, 6 pt', () => {
  expect(PAGE_GROUND.source).toBe(dots);
  expect(PAGE_GROUND.resizeMode).toBe('repeat');
  expect(PAGE_GROUND.tile).toBe(TILE);
});

test('Page paints the ground with exactly those props, and the top inset night-900', () => {
  seen.length = 0;
  const { container } = wrap({ ...none, top: 47, left: 5, right: 7 }, <Page><Text>hi</Text></Page>);
  expect(seen).toHaveLength(1);
  expect(seen[0].source).toBe(PAGE_GROUND.source);
  expect(seen[0].resizeMode).toBe(PAGE_GROUND.resizeMode);
  // An image laid over the whole screen behind the column (ImageBackground is deprecated in RN 0.88).
  expect(seen[0].style).toMatchObject({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 });
  // In a box with no padding, so its 100 % is the whole screen: in the padded one it fell short of the foot by the top inset.
  const ground = Array.from(container.querySelectorAll('div')).find((d) => d.style.backgroundColor === hexToRgb(COLORS['night-800']))!;
  expect(ground.style.paddingTop).toBe('');
  expect(Array.from(ground.querySelectorAll('div')).some((d) => d.style.paddingTop === '47px')).toBe(true);
  const strips = Array.from(container.querySelectorAll('div')).filter(
    (d) => d.style.height === '47px' && d.style.position === 'absolute',
  );
  expect(strips.length).toBe(1);
  expect(strips[0].style.backgroundColor).toBe(hexToRgb(COLORS['night-900']));
});

test('BottomBar spans the screen on night-900 (the web\'s fixed inset-x-0 pt-3 pb-safe) and holds a 448 column with the 12 gutter', () => {
  const a = wrap({ ...none, bottom: 34, left: 5, right: 7 }, <BottomBar><Text>bar</Text></BottomBar>);
  const column = up(a.getByText('bar'), (s) => s.maxWidth === '448px')!;
  expect(column.style.alignSelf).toBe('center');
  expect(column.style.width).toBe('100%');
  expect(column.style.paddingLeft).toBe('12px');
  expect(column.style.paddingRight).toBe('12px');
  const bar = up(column.parentElement, (s) => s.paddingBottom !== '')!;
  expect(bar.style.backgroundColor).toBe(hexToRgb(COLORS['night-900']));
  expect(bar.style.maxWidth).toBe('');
  expect(bar.style.paddingTop).toBe('12px');
  expect(bar.style.paddingBottom).toBe('34px');
  expect(bar.style.paddingLeft).toBe('5px');
  expect(bar.style.paddingRight).toBe('7px');
  a.unmount();
  const b = wrap(none, <BottomBar><Text>bar</Text></BottomBar>);
  const low = up(up(b.getByText('bar'), (s) => s.maxWidth === '448px')!.parentElement, (s) => s.paddingBottom !== '')!;
  expect(low.style.paddingBottom).toBe('12px');
});

function hexToRgb(h: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

test('what a screen asks of the page it stands in: nothing when the box is in view, the least that brings it in otherwise, with room to spare', () => {
  // A page 600 tall, scrolled 100: it shows 100 to 700.
  expect(scrollToShow(100, 600, 200, 100, 12)).toBeNull();
  // Below it: the box's foot at the page's foot, and the room.
  expect(scrollToShow(100, 600, 900, 100, 12)).toBe(900 + 100 + 12 - 600);
  // Above it: the box's top at the page's top, and the room.
  expect(scrollToShow(100, 600, 40, 100, 12)).toBe(28);
  expect(scrollToShow(100, 600, 5, 100, 12)).toBe(0);
  // Cut off by the foot, or by the top: it is brought in.
  expect(scrollToShow(0, 600, 560, 100, 0)).toBe(60);
  expect(scrollToShow(100, 600, 90, 50, 0)).toBe(90);
  // A box taller than the page shows its top, and does not jump about for its foot.
  expect(scrollToShow(0, 600, 1000, 800, 12)).toBe(988);
  // Until the page has said how tall it is there is nothing to judge by.
  expect(scrollToShow(0, 0, 900, 100, 12)).toBeNull();
});

/** The scroll of a Screen: it is told its height and how far it is scrolled as the phone tells it, and what it is asked to scroll to is recorded. */
function scrolled(viewport: number, offset = 0) {
  const scroller = createRef<ScreenScroller>();
  const view = wrap(none, <Screen scroller={scroller}><Text>page</Text></Screen>);
  const node = Array.from(view.container.querySelectorAll<HTMLElement>('*')).find((el) => typeof (el as unknown as { __reactLayoutHandler?: unknown }).__reactLayoutHandler === 'function')!;
  expect(node).toBeTruthy();
  const to = vi.fn();
  (node as unknown as { scrollTo: unknown }).scrollTo = to;
  act(() => (node as unknown as { __reactLayoutHandler: (e: unknown) => void }).__reactLayoutHandler({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height: viewport } } }));
  if (offset > 0) {
    Object.defineProperty(node, 'scrollTop', { configurable: true, value: offset });
    fireEvent.scroll(node);
  }
  return { scroller, to };
}

test('a Screen that has a scroller scrolls to show what it is asked to, if it is not in view: the web\'s scrollIntoView, nearest', () => {
  const { scroller, to } = scrolled(600);
  act(() => scroller.current!.reveal(300, 100));
  expect(to).not.toHaveBeenCalled();
  act(() => scroller.current!.reveal(900, 100));
  expect(to).toHaveBeenCalledWith({ y: 900 + 100 + 12 - 600, animated: true });
  // Where motion is left out, it jumps.
  act(() => scroller.current!.reveal(1500, 100, false));
  expect(to).toHaveBeenLastCalledWith({ y: 1500 + 100 + 12 - 600, animated: false });
});

test('a Screen follows how far it is scrolled, for the scroller: what is below is brought in from there, what is above is brought down', () => {
  const { scroller, to } = scrolled(600, 700);
  act(() => scroller.current!.reveal(800, 100));
  expect(to).not.toHaveBeenCalled();
  act(() => scroller.current!.reveal(100, 100));
  expect(to).toHaveBeenCalledWith({ y: 88, animated: true });
});

test('a Screen with no scroller and no onScroll asks nothing of the scroll: its callers are as they were', () => {
  const view = wrap(none, <Screen><Text>page</Text></Screen>);
  const handlers = Array.from(view.container.querySelectorAll<HTMLElement>('*')).filter((el) => typeof (el as unknown as { __reactLayoutHandler?: unknown }).__reactLayoutHandler === 'function');
  expect(handlers).toHaveLength(0);
});

test('a Screen given a scroll offset to follow writes it as the page scrolls (on the UI thread on the phone), and its scroller reads it there', () => {
  const scroller = createRef<ScreenScroller>();
  const seenY: number[] = [];
  let offset: SharedValue<number> | null = null;
  function Followed() {
    const scrollY = useSharedValue(0);
    offset = scrollY;
    return (
      <Screen scroller={scroller} scrollY={scrollY} onScroll={(y) => seenY.push(y)}>
        <Text>page</Text>
      </Screen>
    );
  }
  const view = wrap(none, <Followed />);
  const node = Array.from(view.container.querySelectorAll<HTMLElement>('*')).find((el) => typeof (el as unknown as { __reactLayoutHandler?: unknown }).__reactLayoutHandler === 'function')!;
  const to = vi.fn();
  (node as unknown as { scrollTo: unknown }).scrollTo = to;
  act(() => (node as unknown as { __reactLayoutHandler: (e: unknown) => void }).__reactLayoutHandler({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 600 } } }));
  Object.defineProperty(node, 'scrollTop', { configurable: true, value: 700 });
  act(() => void fireEvent.scroll(node));
  expect(offset!.value).toBe(700);
  // React's side hears nothing of it: the offset is the UI thread's.
  expect(seenY).toEqual([]);
  act(() => scroller.current!.reveal(100, 100));
  expect(to).toHaveBeenCalledWith({ y: 88, animated: true });
});

/** What the phone tells a view once it has laid it out: react-native-web keeps the handler on the node, and calling it is what its observer does after it measures. */
type Laid = HTMLElement & { __reactLayoutHandler?: (event: unknown) => void };
const laidOut = (root: HTMLElement) => Array.from(root.querySelectorAll<Laid>('*')).filter((el) => typeof el.__reactLayoutHandler === 'function');

test('a ListScreen is a Screen whose rows are a list that draws only those near the screen (a FlatList): the same column, the gutter inside what scrolls, its head first', () => {
  const rows = Array.from({ length: 40 }, (_, i) => `row ${i}`);
  const { getByText, queryByText } = wrap({ ...none, bottom: 34, left: 5, right: 7 }, <ListScreen head={<Text>head</Text>} data={rows} keyOf={(row) => row} item={(row) => <Text>{row}</Text>} />);
  const column = up(getByText('head'), (s) => s.maxWidth === '448px')!;
  expect(column).not.toBeNull();
  expect(column.style.alignSelf).toBe('center');
  expect(column.style.width).toBe('100%');
  expect(column.style.paddingLeft).toBe('12px');
  expect(column.style.paddingRight).toBe('12px');
  expect(column.style.paddingTop).toBe('16px');
  expect(column.style.paddingBottom).toBe(`${16 + 34}px`);
  // The rows are in the same column, after the head.
  expect(column.contains(getByText('row 0'))).toBe(true);
  expect(getByText('head').compareDocumentPosition(getByText('row 0')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  // The scroll stands in from the side insets only.
  const scroll = column.parentElement!;
  expect(scroll.style.marginLeft).toBe('5px');
  expect(scroll.style.marginRight).toBe('7px');
  // Only the first rows are drawn at once, about a screen of them (jsdom lays nothing out, so it never draws the next): the list is a virtual one.
  expect(queryByText('row 7')).not.toBeNull();
  expect(queryByText('row 8')).toBeNull();
  expect(queryByText('row 39')).toBeNull();
});

test('a ListScreen draws little of its list at a time: about a screen at first, a few rows a batch, and only two screens either side of what is seen', () => {
  expect(LIST_WINDOW).toEqual({ initialNumToRender: 8, maxToRenderPerBatch: 6, windowSize: 5 });
  listed.length = 0;
  wrap(none, <ListScreen head={<Text>head</Text>} data={['a', 'b']} keyOf={(row) => row} item={(row) => <Text>{row}</Text>} />);
  expect(listed.at(-1)).toMatchObject({ initialNumToRender: 8, maxToRenderPerBatch: 6, windowSize: 5, strictMode: true });
});

test('a ListScreen hands its list one renderer for as long as it is drawn, which draws a row with the latest `item`: a page drawn again for its head draws no row again', () => {
  listed.length = 0;
  const drawn: string[] = [];
  const page = (head: string, rows: readonly string[], mark: string) => (
    <ListScreen
      head={<Text>{head}</Text>}
      data={rows}
      keyOf={(row) => `${row}`}
      item={(row) => {
        drawn.push(`${mark}:${row}`);
        return <Text>{`${mark}:${row}`}</Text>;
      }}
    />
  );
  const rows = ['a', 'b'];
  const view = wrap(none, page('first', rows, 'one'));
  expect(drawn).toEqual(['one:a', 'one:b']);
  const [renderItem, keyExtractor] = [listed[0].renderItem, listed[0].keyExtractor];
  // Drawn again with a new head, new closures and the same rows: the same renderer, the same names.
  view.rerender(<SafeAreaProvider initialMetrics={{ frame, insets: none }}>{page('second', rows, 'two')}</SafeAreaProvider>);
  expect(view.getByText('second')).toBeTruthy();
  expect(listed.at(-1)?.renderItem).toBe(renderItem);
  expect(listed.at(-1)?.keyExtractor).toBe(keyExtractor);
  // New rows are drawn by the latest `item`.
  view.rerender(<SafeAreaProvider initialMetrics={{ frame, insets: none }}>{page('third', ['a', 'b', 'c'], 'three')}</SafeAreaProvider>);
  expect(view.getByText('three:c')).toBeTruthy();
  expect(listed.at(-1)?.renderItem).toBe(renderItem);
});

test('a ListScreen takes the caller\'s own spacing, names its list for a screen reader, and tells the width inside its gutter (what the web\'s container queries measure) as it is laid out', () => {
  const widths: number[] = [];
  const { getByText, container } = wrap(
    none,
    <ListScreen head={<Text>head</Text>} data={['a']} keyOf={(row) => row} item={(row) => <Text>{row}</Text>} contentStyle={{ paddingBottom: 40 }} role="list" label="Past lives" onWidth={(width) => widths.push(width)} />,
  );
  const column = up(getByText('head'), (s) => s.maxWidth === '448px')!;
  expect(column.style.paddingBottom).toBe('40px');
  const scroll = column.parentElement!;
  expect(scroll.getAttribute('role')).toBe('list');
  expect(scroll.getAttribute('aria-label')).toBe('Past lives');
  // The scroll is the first box laid out; the column inside it is at most 448 wide, the gutter 12 on each side.
  const [node] = laidOut(container);
  expect(node).toBe(scroll);
  act(() => node.__reactLayoutHandler!({ nativeEvent: { layout: { x: 0, y: 0, width: 402, height: 800 } } }));
  act(() => node.__reactLayoutHandler!({ nativeEvent: { layout: { x: 0, y: 0, width: 700, height: 800 } } }));
  expect(widths).toEqual([378, 424]);
});

test('a page\'s scroll gives a tap to the button tapped while a field has the keyboard up, and keeps the field above the keyboard: a Screen, one that follows its scroll on the UI thread, and a ListScreen', () => {
  wrap(none, <Screen><Text>page</Text></Screen>);
  expect(scrollProps.at(-1)).toMatchObject({ keyboardShouldPersistTaps: 'handled', automaticallyAdjustKeyboardInsets: true });
  cleanup();
  scrollProps.length = 0;
  function Followed() {
    const y = useSharedValue(0);
    return <Screen scrollY={y}><Text>page</Text></Screen>;
  }
  wrap(none, <Followed />);
  expect(scrollProps.at(-1)).toMatchObject({ keyboardShouldPersistTaps: 'handled', automaticallyAdjustKeyboardInsets: true });
  cleanup();
  listed.length = 0;
  wrap(none, <ListScreen head={<Text>head</Text>} data={['a']} keyOf={(row) => row} item={(row) => <Text>{row}</Text>} />);
  expect(listed.at(-1)).toMatchObject({ keyboardShouldPersistTaps: 'handled', automaticallyAdjustKeyboardInsets: true });
  // On iOS the scroll leaves the keyboard its room itself: no box round it.
  expect(avoiding).toEqual([]);
});

test('on Android a page stands in a box that leaves the keyboard its room (the app draws edge to edge, where the window is not made smaller for it), with its bar and what is fixed outside it', () => {
  platform.OS = 'android';
  const { getByTestId, getByText } = wrap(none, <Screen bar={<Text>bar</Text>} fixed={<Text>toast</Text>}><Text>page</Text></Screen>);
  expect(avoiding.at(-1)).toMatchObject({ behavior: 'padding', style: { flex: 1 } });
  expect(getByTestId('keyboard-room').contains(getByText('page'))).toBe(true);
  expect(getByTestId('keyboard-room').contains(getByText('bar'))).toBe(false);
  expect(getByTestId('keyboard-room').contains(getByText('toast'))).toBe(false);
  cleanup();
  avoiding.length = 0;
  const list = wrap(none, <ListScreen head={<Text>head</Text>} data={['a']} keyOf={(row) => row} item={(row) => <Text>{row}</Text>} />);
  expect(avoiding).toHaveLength(1);
  expect(list.getByTestId('keyboard-room').contains(list.getByText('a'))).toBe(true);
});
