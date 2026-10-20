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
vi.mock('react-native', async (orig) => {
  const rn = (await orig()) as typeof import('react-native');
  return {
    ...rn,
    ScrollView: (props: Record<string, unknown>) => {
      scrolls.push(props);
      return <rn.ScrollView {...(props as Record<string, unknown>)} />;
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
});
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
  // one sticky child holds both, the figures over the tabs
  expect(last().stickyHeaderIndices).toEqual([0]);
  const figures = getByText('the figures');
  const tabs = getByText('the tabs');
  const block = figures.parentElement!;
  expect(block.contains(tabs)).toBe(true);
  expect(figures.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(block.contains(getByText('the page'))).toBe(false);
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
