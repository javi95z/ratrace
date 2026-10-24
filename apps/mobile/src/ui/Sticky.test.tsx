// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { createContext, createRef, Profiler, useContext, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomBar, type ScreenScroller } from './Page';
import { COLORS } from './theme';

vi.mock('react-native-safe-area-context', () => {
  const Ctx = createContext({ top: 0, bottom: 0, left: 0, right: 0 });
  return {
    SafeAreaProvider: ({ initialMetrics, children }: { initialMetrics: { insets: object }; children: ReactNode }) => (
      <Ctx.Provider value={initialMetrics.insets as never}>{children}</Ctx.Provider>
    ),
    useSafeAreaInsets: () => useContext(Ctx),
  };
});

// What the screen hands its ScrollView, which only the phone acts on: which children stick, and the scroll events.
type ScrollProps = { stickyHeaderIndices?: number[]; onScroll?: (e: { nativeEvent: { contentOffset: { y: number } } }) => void; scrollEventThrottle?: number };
const scrolls = vi.hoisted(() => [] as Array<Record<string, unknown>>);
// onLayout is the phone's to send: the test sends the lead's.
type Layout = (event: { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } }) => void;
const layouts = vi.hoisted(() => [] as Layout[]);
/** The onLayout of each View that has one, with its style: the rows' own are found by their look. */
const laidOut = vi.hoisted(() => [] as Array<{ onLayout: Layout; style: unknown }>);
vi.mock('react-native', async (orig) => {
  const rn = (await orig()) as typeof import('react-native');
  return {
    ...rn,
    ScrollView: (props: Record<string, unknown>) => {
      scrolls.push(props);
      return <rn.ScrollView {...(props as Record<string, unknown>)} />;
    },
    View: (props: Record<string, unknown>) => {
      if (typeof props.onLayout === 'function') {
        layouts.push(props.onLayout as Layout);
        laidOut.push({ onLayout: props.onLayout as Layout, style: props.style });
      }
      return <rn.View {...(props as Record<string, unknown>)} />;
    },
  };
});

// The UI thread is the fake's: a shared value is reactive, and an animated style is worked out once and kept (`rea.styles`) for the test to work
// out again, as the phone does on its UI thread with no word to React. A function of React's side called from a worklet runs at once.
vi.mock('react-native-reanimated', async () => (await import('./testing/reanimated')).reanimatedFake());
vi.mock('react-native-worklets', () => ({ scheduleOnRN: (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => fn(...args) }));
const { rea } = await import('./testing/reanimated');

const { Screen } = await import('./Page');
const { StickyScreen, useScrolledPast } = await import('./Sticky');

const frame = { x: 0, y: 0, width: 390, height: 844 };
const none = { top: 0, bottom: 0, left: 0, right: 0 };
const wrap = (ui: React.ReactElement, insets = none) => render(<SafeAreaProvider initialMetrics={{ frame, insets }}>{ui}</SafeAreaProvider>);
const last = () => scrolls[scrolls.length - 1] as unknown as ScrollProps;
const scroll = (y: number) => act(() => last().onScroll!({ nativeEvent: { contentOffset: { y } } }));

beforeEach(() => {
  scrolls.length = 0;
  layouts.length = 0;
  laidOut.length = 0;
  rea.restyle = false;
  rea.styles.length = 0;
});
afterEach(() => {
  rea.restyle = true;
});
/** The lead stands `y` down the column and is `height` tall. */
const lay = (y: number, height: number) => act(() => layouts[layouts.length - 1]({ nativeEvent: { layout: { x: 0, y, width: 390, height } } }));
afterEach(cleanup);

test('a Screen lets the caller say which of its children stick, and hears the scroll', () => {
  const onScroll = vi.fn();
  wrap(<Screen sticky={[0, 2]} onScroll={onScroll}><Text>a</Text><Text>b</Text><Text>c</Text></Screen>);
  expect(last().stickyHeaderIndices).toEqual([0, 2]);
  expect(last().scrollEventThrottle).toBe(16);
  scroll(120);
  expect(onScroll).toHaveBeenCalledWith(120);
});

test('a Screen that is not asked for either neither sticks anything nor listens', () => {
  wrap(<Screen><Text>a</Text></Screen>);
  expect(last().stickyHeaderIndices).toBeUndefined();
  expect(last().onScroll).toBeUndefined();
});

test('StickyScreen: the header is the first child of what scrolls, and the one that sticks, on night-800 across the gutter', () => {
  const { getByText } = wrap(
    <StickyScreen header={<Text>the figures</Text>}>
      <Text>the page</Text>
    </StickyScreen>,
  );
  expect(last().stickyHeaderIndices).toEqual([0]);
  const header = getByText('the figures').parentElement!;
  // night-800 over the ground, so the page does not show through it; out over the 12 gutter, where a frame's 2 point outline would
  const block = [header, header.parentElement!].find((el) => el.style.backgroundColor === 'rgb(20, 27, 51)')!;
  expect(block).toBeTruthy();
  expect(block.style.backgroundColor).toBe(`rgb(${[1, 3, 5].map((i) => parseInt(COLORS['night-800'].slice(i, i + 2), 16)).join(', ')})`);
  expect(block.style.marginLeft).toBe('-12px');
  expect(block.style.marginRight).toBe('-12px');
  expect(block.style.paddingLeft).toBe('12px');
  expect(block.style.paddingRight).toBe('12px');
  // the page comes after it, in the same column: the first child of the column is the block (inside the sticky wrapper the web build adds)
  const column = (() => {
    for (let el: HTMLElement | null = block; el; el = el.parentElement) if (el.style.maxWidth === '448px') return el;
    throw new Error('no column');
  })();
  expect(column.contains(getByText('the page'))).toBe(true);
  expect(block.contains(getByText('the page'))).toBe(false);
  expect(column.children[0].contains(block)).toBe(true);
  expect(column.children[1]).toBe(getByText('the page'));
});

test('a second row, the Finance tabs, stands under the first and sticks with it: React Native\'s sticky rows push each other off, they do not stack', () => {
  const { getByText } = wrap(
    <StickyScreen header={<Text>the figures</Text>} subHeader={<Text>the tabs</Text>}>
      <Text>the page</Text>
    </StickyScreen>,
  );
  // one sticky child holds both, the figures over the tabs, each on night-800 across the gutter
  expect(last().stickyHeaderIndices).toEqual([0]);
  const figures = getByText('the figures');
  const tabs = getByText('the tabs');
  expect(figures.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  for (const row of [figures.parentElement!, tabs.parentElement!]) {
    expect(row.style.backgroundColor).toBe('rgb(20, 27, 51)');
    expect(row.style.marginLeft).toBe('-12px');
    expect(row.style.paddingLeft).toBe('12px');
  }
  // the page is not in what sticks
  const sticks = (figures.parentElement!.parentElement as HTMLElement);
  expect(sticks.contains(tabs)).toBe(true);
  expect(sticks.contains(getByText('the page'))).toBe(false);
});

test('a lead scrolls away above what sticks: the sticky child is the one after it, and the page comes last', () => {
  const { getByText } = wrap(
    <StickyScreen lead={<Text>the portrait</Text>} header={<Text>the figures</Text>}>
      <Text>the page</Text>
    </StickyScreen>,
  );
  expect(last().stickyHeaderIndices).toEqual([1]);
  const lead = getByText('the portrait');
  const figures = getByText('the figures');
  const page = getByText('the page');
  expect(lead.compareDocumentPosition(figures) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(figures.compareDocumentPosition(page) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  // the lead is outside the sticky row: it scrolls
  const stuck = figures.parentElement!;
  expect(stuck.contains(lead)).toBe(false);
});

test('with no lead, or one that is not shown this time, the first child is the one that sticks', () => {
  wrap(<StickyScreen header={<Text>h</Text>} lead={null}><Text>page</Text></StickyScreen>);
  expect(last().stickyHeaderIndices).toEqual([0]);
  cleanup();
  wrap(<StickyScreen header={<Text>h</Text>} lead={false}><Text>page</Text></StickyScreen>);
  expect(last().stickyHeaderIndices).toEqual([0]);
});

test('the Hud\'s "away" strip: the page has scrolled past the lead once the offset is more than the lead is tall', () => {
  function Away() {
    return <Text>{useScrolledPast(96) ? 'away' : 'here'}</Text>;
  }
  const { getByText } = wrap(
    <StickyScreen lead={<Text>the portrait</Text>} header={<Away />}>
      <Text>page</Text>
    </StickyScreen>,
  );
  expect(getByText('here')).toBeTruthy();
  scroll(96);
  expect(getByText('here')).toBeTruthy();
  scroll(97);
  expect(getByText('away')).toBeTruthy();
});

/**
 * How far the second row has moved up, in points, as the UI thread works it out from the page's offset now: its animated style (the last screen
 * drawn has the last one), worked out again.
 */
const rise = () => {
  const style = rea.styles[rea.styles.length - 1]() as { transform: Array<{ translateY: number }> };
  return Math.abs(style.transform[0].translateY);
};

test('the room between the rows (the 12 the web leaves under the Hud) is there at scroll 0 and closes as the page scrolls up under the stuck header', () => {
  const { getByText, container } = wrap(
    <StickyScreen lead={<Text>the portrait</Text>} header={<Text>the figures</Text>} subHeader={<Text>the tabs</Text>} subGap={12}>
      <Text>page</Text>
    </StickyScreen>,
  );
  const tabs = getByText('the tabs');
  // the room is a gap between the rows, empty, and the page ground shows in it; it takes no touch
  const gap = tabs.parentElement!.previousElementSibling as HTMLElement;
  expect(gap.style.height).toBe('12px');
  expect(gap.style.backgroundColor).toBe('');
  expect(gap.classList.contains(touchClass('none'))).toBe(true);
  // the lead stands 16 down (the column's top) and is 100 tall: the sticky row begins at 116
  lay(16, 100);
  expect(rise()).toBe(0);
  scroll(60);
  expect(rise()).toBe(0);
  // stuck at 116; the tabs go on scrolling under it, and close the gap over the next 12
  scroll(116);
  expect(rise()).toBe(0);
  scroll(122);
  expect(rise()).toBe(6);
  scroll(128);
  expect(rise()).toBe(12);
  // and no more once they have met it
  scroll(400);
  expect(rise()).toBe(12);
  scroll(30);
  expect(rise()).toBe(0);
  expect(container).toBeTruthy();
});

test('the sticky row\'s place is counted from the column\'s own top and gap: no lead, or the lead and the room round it', () => {
  // no lead: the column's top padding, 16 by default
  const a = wrap(
    <StickyScreen header={<Text>h</Text>} subHeader={<Text>the tabs</Text>} subGap={12}>
      <Text>page</Text>
    </StickyScreen>,
  );
  scroll(16);
  expect(rise()).toBe(0);
  scroll(22);
  expect(rise()).toBe(6);
  a.unmount();
  // the caller's own top and gap
  wrap(
    <StickyScreen lead={<Text>lead</Text>} header={<Text>h</Text>} subHeader={<Text>the tabs</Text>} subGap={12} contentStyle={{ paddingTop: 4, gap: 10 }}>
      <Text>page</Text>
    </StickyScreen>,
  );
  lay(4, 50);
  // 4 + 50 + 10
  scroll(64);
  expect(rise()).toBe(0);
  scroll(70);
  expect(rise()).toBe(6);
});

test('without a room between the rows nothing moves', () => {
  wrap(
    <StickyScreen header={<Text>h</Text>} subHeader={<Text>the tabs</Text>}>
      <Text>page</Text>
    </StickyScreen>,
  );
  scroll(300);
  expect(rise()).toBe(0);
});

test('what is fixed over it and the bar under it are the screen\'s, as for any Screen', () => {
  const { getByText } = wrap(
    <StickyScreen header={<Text>h</Text>} fixed={<Text>toast</Text>} bar={<BottomBar><Text>bar</Text></BottomBar>}>
      <Text>page</Text>
    </StickyScreen>,
  );
  expect(getByText('toast')).toBeTruthy();
  expect(getByText('bar')).toBeTruthy();
});

test('the header can ask whether the page has gone past a point without hearing every scroll', () => {
  let drawn = 0;
  function Away() {
    drawn += 1;
    return <Text>{useScrolledPast(100) ? 'away' : 'here'}</Text>;
  }
  const { getByText } = wrap(
    <StickyScreen header={<Away />}>
      <Text>page</Text>
    </StickyScreen>,
  );
  expect(getByText('here')).toBeTruthy();
  const first = drawn;
  scroll(40);
  scroll(99);
  expect(getByText('here')).toBeTruthy();
  expect(drawn).toBe(first);
  scroll(101);
  expect(getByText('away')).toBeTruthy();
  scroll(400);
  scroll(250);
  expect(getByText('away')).toBeTruthy();
  scroll(0);
  expect(getByText('here')).toBeTruthy();
});

test('outside a StickyScreen nothing has scrolled', () => {
  function Away() {
    return <Text>{useScrolledPast(0) ? 'away' : 'here'}</Text>;
  }
  const { getByText } = wrap(<Away />);
  expect(getByText('here')).toBeTruthy();
});

test('a StickyScreen hands its Screen the scroller a screen asks its page to scroll by (Play takes a new stage back to the top)', () => {
  const scroller = createRef<ScreenScroller>();
  wrap(<StickyScreen header={<Text>figures</Text>} scroller={scroller}><Text>page</Text></StickyScreen>);
  expect(typeof scroller.current?.reveal).toBe('function');
  // The page follows its scroll for it, as for the header.
  expect(last().scrollEventThrottle).toBe(16);
});

test('what stands between the rows (the strip of a crisis, a tip of the guide) is there at scroll 0, and scrolls away under the stuck header as the page does: the second row follows it until it meets the first', () => {
  const { getByText } = wrap(
    <StickyScreen lead={<Text>the portrait</Text>} header={<Text>the figures</Text>} subHeader={<Text>the tabs</Text>} subGap={12} between={<Text>the tip</Text>}>
      <Text>page</Text>
    </StickyScreen>,
  );
  const figures = getByText('the figures');
  const tip = getByText('the tip');
  const tabs = getByText('the tabs');
  // In order, all of it in what sticks: the figures, what is between, the gap, the tabs.
  expect(figures.compareDocumentPosition(tip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(tip.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect((tabs.parentElement!.previousElementSibling as HTMLElement).style.height).toBe('12px');
  expect(last().stickyHeaderIndices).toEqual([1]);
  // The figures are drawn over what scrolls up under them.
  expect(Number(figures.parentElement!.style.zIndex)).toBeGreaterThan(0);
  // The lead stands 16 down and is 100 tall: the sticky row begins at 116. The tabs stand 150 under the figures' foot (the tip, then the gap):
  // that is the room that closes.
  const lead = laidOut.find((one) => !hasBackground(one.style))!;
  const row = laidOut.find((one) => hasBackground(one.style))!;
  act(() => lead.onLayout({ nativeEvent: { layout: { x: 0, y: 16, width: 390, height: 100 } } }));
  act(() => row.onLayout({ nativeEvent: { layout: { x: 0, y: 150, width: 390, height: 60 } } }));
  scroll(116);
  expect(rise()).toBe(0);
  scroll(196);
  expect(rise()).toBe(80);
  scroll(266);
  expect(rise()).toBe(150);
  scroll(900);
  expect(rise()).toBe(150);
  // The tip goes up with the tabs, at the page's pace: one block.
  expect(tip.parentElement).toBe(tabs.parentElement!.parentElement);
  // A tip read and gone: the room is what is left.
  act(() => row.onLayout({ nativeEvent: { layout: { x: 0, y: 12, width: 390, height: 60 } } }));
  expect(rise()).toBe(12);
});

test('what sticks takes no touch where it draws nothing: the room left under the tabs once they have met the figures lets the page under it be pressed', () => {
  const { getByText } = wrap(
    <StickyScreen header={<Text>the figures</Text>} subHeader={<Text>the tabs</Text>} subGap={12} between={<Text>the tip</Text>}>
      <Text>page</Text>
    </StickyScreen>,
  );
  const sticky = getByText('the figures').parentElement!.parentElement as HTMLElement;
  // As a style too: React Native's sticky header takes its child's style as its own, and with it this.
  expect(sticky.classList.contains(touchClass('box-none'))).toBe(true);
  const closing = getByText('the tabs').parentElement!.parentElement as HTMLElement;
  expect(closing.classList.contains(touchClass('box-none'))).toBe(true);
});

/** The class react-native-web gives a View that takes a press in that way (`box-none`: not itself, its children; `none`: neither), read from one drawn here. */
function touchClass(kind: 'box-none' | 'none'): string {
  const { container, unmount } = render(<View pointerEvents={kind} />);
  const found = [...(container.firstElementChild as HTMLElement).classList].find((name) => name.startsWith('r-pointerEvents-'));
  unmount();
  if (found === undefined) throw new Error(`react-native-web gave no class for ${kind}`);
  return found;
}

/** Whether a View's style paints a background (a sticky row does; the lead's box does not). */
function hasBackground(style: unknown): boolean {
  const flat = (Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style) as { backgroundColor?: string } | undefined;
  return Boolean(flat?.backgroundColor);
}

test('a scroll is followed on the UI thread: React draws nothing of the screen again for it, the rows closing included, and hears only of a point passed', () => {
  let commits = 0;
  let asked = 0;
  function Away() {
    asked += 1;
    // The lead's foot (it is laid 16 down, 100 tall): the one point asked about.
    return <Text>{useScrolledPast(116) ? 'away' : 'here'}</Text>;
  }
  const { getByText } = wrap(
    <Profiler id="sticky" onRender={() => void (commits += 1)}>
      <StickyScreen lead={<Text>the portrait</Text>} header={<Away />} subHeader={<Text>the tabs</Text>} subGap={12} between={<Text>the tip</Text>}>
        <Text>page</Text>
      </StickyScreen>
    </Profiler>,
  );
  const lead = laidOut.find((one) => !hasBackground(one.style))!;
  const row = laidOut.find((one) => hasBackground(one.style))!;
  act(() => lead.onLayout({ nativeEvent: { layout: { x: 0, y: 16, width: 390, height: 100 } } }));
  act(() => row.onLayout({ nativeEvent: { layout: { x: 0, y: 200, width: 390, height: 60 } } }));
  const before = { commits, asked };
  // A fling through the whole room (116 to 316), a frame at a time, short of the lead's foot first: nothing drawn again, the rows moved all the same.
  for (let y = 0; y <= 116; y += 4) scroll(y);
  expect({ commits, asked }).toEqual(before);
  expect(getByText('here')).toBeTruthy();
  // Past the lead's foot (116): the one point asked about, and the one drawing it takes (the header's word, nothing else).
  for (let y = 117; y <= 340; y += 3) scroll(y);
  expect(getByText('away')).toBeTruthy();
  expect(asked).toBe(before.asked + 1);
  expect(commits).toBe(before.commits + 1);
  // And the rows have closed all the same, on the UI thread: the tabs have met the figures.
  expect(rise()).toBe(200);
});
