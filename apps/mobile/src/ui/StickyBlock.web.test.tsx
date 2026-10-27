// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Text } from 'react-native';

// What the screen hands its scroll: which child the page's own scroll keeps at the top (the browser's `position: sticky`).
const scrolls = vi.hoisted(() => [] as Array<{ stickyHeaderIndices?: number[] }>);
vi.mock('react-native', async (original) => {
  const native = await original<typeof import('react-native')>();
  return {
    ...native,
    ScrollView: (props: Record<string, unknown>) => {
      scrolls.push(props);
      return <native.ScrollView {...props} />;
    },
  };
});
const { StickyScreen } = await import('./Sticky');
const { SCROLL_STICKS } = await import('./StickyBlock.web');

afterEach(() => {
  cleanup();
  scrolls.length = 0;
});

test("on the web the page's own scroll keeps the block at the top, the child after the lead, where the phone moves it itself", () => {
  expect(SCROLL_STICKS).toBe(true);
  render(
    <StickyScreen lead={<Text>the portrait</Text>} header={<Text>the figures</Text>} subHeader={<Text>the tabs</Text>}>
      <Text>the page</Text>
    </StickyScreen>,
  );
  expect(scrolls.at(-1)?.stickyHeaderIndices).toEqual([1]);
  cleanup();
  render(
    <StickyScreen header={<Text>the figures</Text>}>
      <Text>the page</Text>
    </StickyScreen>,
  );
  expect(scrolls.at(-1)?.stickyHeaderIndices).toEqual([0]);
});
