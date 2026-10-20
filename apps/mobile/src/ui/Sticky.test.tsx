// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { createContext, useContext, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomBar } from './Page';
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
vi.mock('react-native', async (orig) => {
  const rn = (await orig()) as typeof import('react-native');
  return {
    ...rn,
    ScrollView: (props: Record<string, unknown>) => {
      scrolls.push(props);
      return <rn.ScrollView {...(props as Record<string, unknown>)} />;
    },
    View: (props: Record<string, unknown>) => {
      if (typeof props.onLayout === 'function') layouts.push(props.onLayout as Layout);
      return <rn.View {...(props as Record<string, unknown>)} />;
    },
  };
});

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

/** How far the second row has moved up, in points. */
const rise = (tabs: HTMLElement) => {
  const t = (tabs.parentElement!.parentElement as HTMLElement).style.transform;
  const m = /translateY\((-?[\d.]+)px\)/.exec(t);
  return m ? Math.abs(Number(m[1])) : 0;
};

test('the room between the rows (the 12 the web leaves under the Hud) is there at scroll 0 and closes as the page scrolls up under the stuck header', () => {
  const { getByText, container } = wrap(
    <StickyScreen lead={<Text>the portrait</Text>} header={<Text>the figures</Text>} subHeader={<Text>the tabs</Text>} subGap={12}>
      <Text>page</Text>
    </StickyScreen>,
  );
  const tabs = getByText('the tabs');
  // the room is a gap between the rows, empty, and the page ground shows in it
  const figures = getByText('the figures').parentElement!;
  const gap = figures.nextElementSibling as HTMLElement;
  expect(gap.style.height).toBe('12px');
  expect(gap.style.backgroundColor).toBe('');
  // the lead stands 16 down (the column's top) and is 100 tall: the sticky row begins at 116
  lay(16, 100);
  expect(rise(tabs)).toBe(0);
  scroll(60);
  expect(rise(tabs)).toBe(0);
  // stuck at 116; the tabs go on scrolling under it, and close the gap over the next 12
  scroll(116);
  expect(rise(tabs)).toBe(0);
  scroll(122);
  expect(rise(tabs)).toBe(6);
  scroll(128);
  expect(rise(tabs)).toBe(12);
  // and no more once they have met it
  scroll(400);
  expect(rise(tabs)).toBe(12);
  scroll(30);
  expect(rise(tabs)).toBe(0);
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
  expect(rise(a.getByText('the tabs'))).toBe(0);
  scroll(22);
  expect(rise(a.getByText('the tabs'))).toBe(6);
  a.unmount();
  // the caller's own top and gap
  const b = wrap(
    <StickyScreen lead={<Text>lead</Text>} header={<Text>h</Text>} subHeader={<Text>the tabs</Text>} subGap={12} contentStyle={{ paddingTop: 4, gap: 10 }}>
      <Text>page</Text>
    </StickyScreen>,
  );
  lay(4, 50);
  // 4 + 50 + 10
  scroll(64);
  expect(rise(b.getByText('the tabs'))).toBe(0);
  scroll(70);
  expect(rise(b.getByText('the tabs'))).toBe(6);
});

test('without a room between the rows nothing moves', () => {
  const { getByText } = wrap(
    <StickyScreen header={<Text>h</Text>} subHeader={<Text>the tabs</Text>}>
      <Text>page</Text>
    </StickyScreen>,
  );
  scroll(300);
  expect(rise(getByText('the tabs'))).toBe(0);
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

test('the scroll offset is told to the caller, and the header can ask whether the page has gone past a point without hearing every scroll', () => {
  let drawn = 0;
  function Away() {
    drawn += 1;
    return <Text>{useScrolledPast(100) ? 'away' : 'here'}</Text>;
  }
  const onScroll = vi.fn();
  const { getByText } = wrap(
    <StickyScreen header={<Away />} onScroll={onScroll}>
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
  expect(onScroll.mock.calls.map((c) => c[0])).toEqual([40, 99, 101, 400, 250, 0]);
});

test('outside a StickyScreen nothing has scrolled', () => {
  function Away() {
    return <Text>{useScrolledPast(0) ? 'away' : 'here'}</Text>;
  }
  const { getByText } = wrap(<Away />);
  expect(getByText('here')).toBeTruthy();
});
