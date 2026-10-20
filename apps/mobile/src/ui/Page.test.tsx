// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { createContext, useContext } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import dots from '../../assets/ui/dots.png';
import { TILE } from '../../scripts/dots';
import { BottomBar, PAGE_GROUND, Page, Screen } from './Page';
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

// Records what Page hands the ground's image: react-native-web does not tile, so the props are what the app controls.
const seen: Array<{ source: unknown; resizeMode: unknown; style: unknown }> = [];
vi.mock('react-native', async (orig) => {
  const rn = (await orig()) as typeof import('react-native');
  return {
    ...rn,
    Image: (props: Record<string, unknown>) => {
      seen.push({ source: props.source, resizeMode: props.resizeMode, style: props.style });
      return <rn.Image {...(props as Record<string, unknown>)} />;
    },
  };
});

const frame = { x: 0, y: 0, width: 390, height: 844 };
function wrap(inset: { top: number; bottom: number; left: number; right: number }, ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={{ frame, insets: inset }}>{ui}</SafeAreaProvider>);
}
const none = { top: 0, bottom: 0, left: 0, right: 0 };
afterEach(cleanup);

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
