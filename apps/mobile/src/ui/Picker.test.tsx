// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { ViewStyle } from 'react-native';

// Sprites are drawn with Skia on the phone only: here each is a <div> that names its id and keeps its place; the layers of one canvas are its box,
// and each layer a <div> that names its id and says where it lies on the canvas and how large.
vi.mock('./Sprite', () => ({
  Sprite: ({ id, style }: { id: string; style?: ViewStyle }) => <div data-sprite={id} style={style as never} />,
  SpriteLayers: ({ size, layers }: { size: { w: number; h: number }; layers: Array<{ id: string; x: number; y: number; w: number; h: number }> }) => (
    <div data-canvas={`${size.w}x${size.h}`}>
      {layers.map((layer) => (
        <div key={layer.id} data-sprite={layer.id} data-at={`${layer.x},${layer.y}`} data-size={`${layer.w}x${layer.h}`} />
      ))}
    </div>
  ),
}));
vi.mock('react-native-reanimated', async () => (await import('./testing/reanimated')).reanimatedFake());
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const { Face } = await import('./Picker');

afterEach(cleanup);

const sprite = (c: HTMLElement, id: string) => c.querySelector(`[data-sprite="${id}"]`) as HTMLElement;

test('a face is the middle of a 64 pixel portrait, cut out at its own size: 32 for an icon, 44 for a line of a list', () => {
  for (const [size, box, at] of [['sm', 32, '-16,-6'], ['md', 44, '-10,-4']] as const) {
    const { container, unmount } = render(<Face id="portrait.a" size={size} />);
    // One canvas of the box, which cuts what lies outside it.
    expect(container.querySelector('[data-canvas]')?.getAttribute('data-canvas')).toBe(`${box}x${box}`);
    expect([sprite(container, 'portrait.a').getAttribute('data-at'), sprite(container, 'portrait.a').getAttribute('data-size')]).toEqual([at, '64x64']);
    unmount();
  }
});

test('with a backdrop (a city\'s sky) it lies behind the face, its middle at the middle of the box, on the same canvas', () => {
  for (const [size, centred] of [['sm', '-16,-16'], ['md', '-10,-10']] as const) {
    const { container, unmount } = render(<Face id="portrait.a" backdrop="backdrop.madrid" size={size} />);
    const behind = sprite(container, 'backdrop.madrid');
    const face = sprite(container, 'portrait.a');
    // 64 wide in a box of 32 or 44: it overhangs by half of what it is wider on each side, and the canvas cuts it
    expect(behind.getAttribute('data-at')).toBe(centred);
    expect(container.querySelectorAll('[data-canvas]')).toHaveLength(1);
    // drawn first, so the face is over it
    expect(behind.compareDocumentPosition(face) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    unmount();
  }
});

test('without a backdrop there is none', () => {
  const { container } = render(<Face id="portrait.a" />);
  expect(container.querySelectorAll('[data-sprite]')).toHaveLength(1);
});
