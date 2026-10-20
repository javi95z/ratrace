// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { createContext, useContext } from 'react';
import { expect, test, vi } from 'vitest';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomBar, Page } from './Page';
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

const frame = { x: 0, y: 0, width: 390, height: 844 };
function wrap(inset: { top: number; bottom: number; left: number; right: number }, ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={{ frame, insets: inset }}>{ui}</SafeAreaProvider>);
}
const none = { top: 0, bottom: 0, left: 0, right: 0 };

test('Page puts its children in a centred column at most 448 wide with a 12 gutter', () => {
  const { getByText } = wrap(none, <Page><Text>hi</Text></Page>);
  let el = getByText('hi') as HTMLElement | null;
  while (el && el.style.maxWidth !== '448px') el = el.parentElement;
  expect(el).not.toBeNull();
  expect(el!.style.alignSelf).toBe('center');
  expect(el!.style.paddingLeft).toBe('12px');
  expect(el!.style.paddingRight).toBe('12px');
});

test('Page repeats the dots tile and paints the top inset night-900', () => {
  const { container } = wrap({ ...none, top: 47, left: 5, right: 7 }, <Page><Text>hi</Text></Page>);
  const img = container.querySelector('[style*="repeat"]') ?? container.querySelector('img');
  expect(container.innerHTML).toMatch(/dots/);
  expect(img).not.toBeNull();
  const strips = Array.from(container.querySelectorAll('div')).filter(
    (d) => d.style.height === '47px' && d.style.position === 'absolute',
  );
  expect(strips.length).toBe(1);
  expect(strips[0].style.backgroundColor).toBe(hexToRgb(COLORS['night-900']));
});

test('BottomBar pads by the larger of 12 and the bottom inset, on night-900', () => {
  const a = wrap({ ...none, bottom: 34 }, <BottomBar><Text>bar</Text></BottomBar>);
  let el = a.getByText('bar') as HTMLElement;
  while (el.style.paddingBottom === '') el = el.parentElement!;
  expect(el.style.paddingBottom).toBe('34px');
  expect(el.style.backgroundColor).toBe(hexToRgb(COLORS['night-900']));
  a.unmount();
  const b = wrap({ ...none, bottom: 0 }, <BottomBar><Text>bar</Text></BottomBar>);
  el = b.getByText('bar') as HTMLElement;
  while (el.style.paddingBottom === '') el = el.parentElement!;
  expect(el.style.paddingBottom).toBe('12px');
});

function hexToRgb(h: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}
