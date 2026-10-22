// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { useRef, type RefObject } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { Text, View } from 'react-native';

// The page's edges are the phone's to say: none here.
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

/** Where each view stands on the screen, as the phone measures it on its UI thread: the column, the part, and the row that sticks. */
const boxes = vi.hoisted(() => ({ column: { pageY: 100, height: 2000 }, part: { pageY: 400, height: 600 }, head: { pageY: 400, height: 50 } }));
// The UI thread is the fake's: a shared value is reactive, and an animated style is worked out again whenever one changes. Measuring a view answers
// where this test says it stands: the column by its test id, the part by the row it starts with, the row by what it holds.
vi.mock('react-native-reanimated', async () => {
  const fake = await (await import('./testing/reanimated')).reanimatedFake();
  const of = (node: HTMLElement | null) => {
    if (node === null) return null;
    if (node.getAttribute('data-testid') === 'column') return boxes.column;
    if (node.querySelector(':scope > [data-testid="head"]')) return boxes.head;
    if (node.firstElementChild?.querySelector(':scope > [data-testid="head"]')) return boxes.part;
    return null;
  };
  return { ...fake, measure: (ref: RefObject<HTMLElement | null>) => of(ref.current) };
});
const { default: Animated, useSharedValue } = await import('react-native-reanimated');
const { PageScroll, StickyPart } = await import('./Sticky');

afterEach(cleanup);

/** How far the row is moved down, as react-native-web writes it. */
const shift = () => (screen.getByTestId('head').parentElement as HTMLElement).style.transform;

function Page({ scroll }: { scroll: { set?: (y: number) => void } }) {
  const scrollY = useSharedValue(0);
  const column = useRef(null) as never;
  scroll.set = (y) => void (scrollY.value = y);
  return (
    <PageScroll.Provider value={{ scrollY, column, top: 16 }}>
      <Animated.View ref={column} testID="column">
        <StickyPart head={<View testID="head"><Text>tabs</Text></View>}>
          <Text>choices</Text>
        </StickyPart>
      </Animated.View>
    </PageScroll.Provider>
  );
}

test('a part\'s first row stays at the top of the page while the part scrolls under it, and goes with the part once its foot comes up', () => {
  const scroll: { set?: (y: number) => void } = {};
  render(<Page scroll={scroll} />);
  // The part starts 316 down what scrolls: the column's 16, and 300 into the column.
  expect(shift()).toBe('translateY(0px)');
  act(() => scroll.set?.(316));
  expect(shift()).toBe('translateY(0px)');
  act(() => scroll.set?.(400));
  expect(shift()).toBe('translateY(84px)');
  // No further than the part's foot: the row's own height above it.
  act(() => scroll.set?.(2000));
  expect(shift()).toBe('translateY(550px)');
  act(() => scroll.set?.(0));
  expect(shift()).toBe('translateY(0px)');
});

test('a part drawn on a page of its own, outside a page that scrolls it, is its rows as they are', () => {
  render(
    <StickyPart head={<View testID="head"><Text>tabs</Text></View>}>
      <Text>choices</Text>
    </StickyPart>,
  );
  expect(shift()).toBe('translateY(0px)');
  expect(screen.getByText('choices')).toBeTruthy();
});
