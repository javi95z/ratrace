// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import type { RatLook } from '@ratrace/core/game/avatar';

// Skia draws on the phone only: here each piece is a <div> that says what it was asked to draw.
vi.mock('@shopify/react-native-skia', () => {
  const node = (kind: string) => ({ children, image }: { children?: ReactNode; image?: { src?: string } | null }) => (
    <div data-skia={kind} data-image={image?.src}>{children}</div>
  );
  return {
    Canvas: node('Canvas'),
    Image: node('Image'),
    Group: node('Group'),
    Fill: node('Fill'),
    Path: node('Path'),
    Skia: { PathBuilder: { Make: () => ({ addRect: () => {}, detach: () => ({}) }) }, XYWHRect: () => ({}) },
    FilterMode: { Nearest: 0 },
    MipmapMode: { None: 0 },
  };
});
vi.mock('../sprites/sources', () => ({
  SOURCES: new Proxy({}, {
    get: (_, id) => `src:${String(id)}`,
    getOwnPropertyDescriptor: (_, id) => ({ value: `src:${String(id)}`, configurable: true, enumerable: true }),
  }),
}));

const { loadSpritesWith } = await import('./spriteImages');
const { Sprite } = await import('./Sprite');
const { RatLayers } = await import('./RatAvatar');

afterEach(() => vi.restoreAllMocks());

const all = (root: Element, kind: string) => Array.from(root.querySelectorAll(`[data-skia="${kind}"]`));
/** Lets the loads that are under way settle. */
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

test('two hundred sprites of one id in a list: one read and one decode, shared by all', async () => {
  const load = vi.fn(async (source: unknown) => ({ src: String(source) }) as never);
  loadSpritesWith(load);
  const { container } = render(<>{Array.from({ length: 200 }, (_, i) => <Sprite key={i} id="icon.cash" />)}</>);
  await settle();
  expect(load).toHaveBeenCalledTimes(1);
  const images = all(container, 'Image');
  expect(images).toHaveLength(200);
  expect(new Set(images.map((i) => i.getAttribute('data-image')))).toEqual(new Set(['src:icon.cash']));
  // One drawn later finds the picture already decoded: drawn at once, read again never.
  const later = render(<Sprite id="icon.cash" />);
  expect(all(later.container, 'Image')).toHaveLength(1);
  expect(load).toHaveBeenCalledTimes(1);
});

test('a read that fails, or a file that does not decode, shows the checkerboard and is told once, never a crash', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  loadSpritesWith(async (source) => {
    if (String(source) === 'src:icon.bond') throw new Error('no such file');
    return null;
  });
  const { container } = render(
    <>
      <Sprite id="icon.bond" />
      <Sprite id="icon.bond" />
      <Sprite id="icon.crypto" />
    </>,
  );
  await settle();
  expect(all(container, 'Image')).toHaveLength(0);
  expect(all(container, 'Path')).toHaveLength(3);
  expect(warn.mock.calls).toEqual([['sprite did not load: icon.bond'], ['sprite did not load: icon.crypto']]);
});

test('the rat\'s layers come from the same pictures: two rats of one look read each piece once', async () => {
  const load = vi.fn(async (source: unknown) => ({ src: String(source) }) as never);
  loadSpritesWith(load);
  const look: RatLook = { colour: 'teal', body: 'grey', face: 'grin', outfit: 'suit', hat: 'crown', eyes: 'round', backdrop: 'stars' };
  const { container } = render(<><RatLayers look={look} size={28} /><RatLayers look={look} size={92} /></>);
  await settle();
  expect(load).toHaveBeenCalledTimes(7);
  expect(all(container, 'Image')).toHaveLength(14);
});
