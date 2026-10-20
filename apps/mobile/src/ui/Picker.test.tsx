// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { ViewStyle } from 'react-native';

// Sprites are drawn with Skia on the phone only: here each is a <div> that names its id and keeps its place.
vi.mock('./Sprite', () => ({ Sprite: ({ id, style }: { id: string; style?: ViewStyle }) => <div data-sprite={id} style={style as never} /> }));
vi.mock('react-native-reanimated', async () => (await import('./testing/reanimated')).reanimatedFake());
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const { Face } = await import('./Picker');

afterEach(cleanup);

const sprite = (c: HTMLElement, id: string) => c.querySelector(`[data-sprite="${id}"]`) as HTMLElement;

test('a face is the middle of a 64 pixel portrait, cut out at its own size: 32 for an icon, 44 for a line of a list', () => {
  for (const [size, box, left, top] of [['sm', 32, '-16px', '-6px'], ['md', 44, '-10px', '-4px']] as const) {
    const { container, unmount } = render(<Face id="portrait.a" size={size} />);
    const root = container.firstElementChild as HTMLElement;
    expect([root.style.width, root.style.height, root.style.overflowX, root.style.overflowY]).toEqual([`${box}px`, `${box}px`, 'hidden', 'hidden']);
    expect([sprite(container, 'portrait.a').style.left, sprite(container, 'portrait.a').style.top]).toEqual([left, top]);
    unmount();
  }
});

test('with a backdrop (a city\'s sky) it lies behind the face, its middle at the middle of the box', () => {
  for (const [size, centred] of [['sm', '-16px'], ['md', '-10px']] as const) {
    const { container, unmount } = render(<Face id="portrait.a" backdrop="backdrop.madrid" size={size} />);
    const behind = sprite(container, 'backdrop.madrid');
    const face = sprite(container, 'portrait.a');
    // 64 wide in a box of 32 or 44: it overhangs by half of what it is wider on each side, and the box clips it
    expect([behind.style.position, behind.style.left, behind.style.top]).toEqual(['absolute', centred, centred]);
    // drawn first, so the face is over it
    expect(behind.compareDocumentPosition(face) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    unmount();
  }
});

test('without a backdrop there is none', () => {
  const { container } = render(<Face id="portrait.a" />);
  expect(container.querySelectorAll('[data-sprite]')).toHaveLength(1);
});
