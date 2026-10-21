// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Text } from 'react-native';
import { Framed, placeOf } from './Frame';
import { anchorsOf, resolveAnchor } from './frames';
import { paintOf } from './testing/paint';
import { COLORS, grey } from './theme';

/** A colour as jsdom gives a style's back: `rgb(r, g, b)`. */
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)).join(', ')})`;

test('Framed draws its strips on the first render and leaves the children alone', () => {
  const { container } = render(
    <Framed kind="bevel" tone={{}}>
      <Text>hello</Text>
    </Framed>,
  );
  const root = container.firstElementChild as HTMLElement;
  const kids = Array.from(root.children) as HTMLElement[];
  const n = anchorsOf('bevel', {}).length;
  expect(kids).toHaveLength(n + 1);
  for (const strip of kids.slice(0, n)) {
    expect(strip.style.position).toBe('absolute');
    // Its colour is its fill, or the border at the far edge it is anchored to (`placeOf`).
    expect(paintOf(strip)).not.toBe('');
  }
  expect(kids[n].textContent).toBe('hello');
  expect(kids[n].style.position).not.toBe('absolute');
});

test('a greyed frame (under the web\'s `grayscale` filter) draws each strip in the grey of its colour', () => {
  const { container } = render(
    <Framed kind="bevel" tone={{ frame: 'gold-900', hi: 'gold-200', lo: 'gold-700' }} grey>
      <Text>hello</Text>
    </Framed>,
  );
  const strips = (Array.from((container.firstElementChild as HTMLElement).children) as HTMLElement[]).filter((kid) => kid.style.position === 'absolute');
  const colours = anchorsOf('bevel', { frame: 'gold-900', hi: 'gold-200', lo: 'gold-700' }).map(({ color }) => grey(COLORS[color]));
  expect(strips.map((strip) => paintOf(strip))).toEqual(colours.map(rgb));
  // Ungreyed, the same frame is in its own colours.
  const plain = render(<Framed kind="frame"><Text>x</Text></Framed>).container.firstElementChild as HTMLElement;
  const first = plain.firstElementChild as HTMLElement;
  expect(paintOf(first)).toBe(rgb(COLORS['night-900']));
});

test('a strip anchored to the box\'s far edge is laid from the near edge with its colour as the border there: it covers what the anchor says, and its far edge is the parent\'s own', () => {
  // A box 100 × 50: each strip of every kind, laid as `placeOf` lays it, covers the rectangle its anchor names.
  for (const kind of ['frame', 'bevel', 'sunk', 'raised', 'lamp', 'double', 'tab'] as const) {
    for (const anchor of anchorsOf(kind, {})) {
      const style = placeOf(anchor, '#000000');
      const { x, y, w, h } = resolveAnchor(anchor, 100, 50);
      const top = Number(style.top ?? 50 - Number(style.bottom) - Number(style.height));
      const bottom = style.bottom !== undefined ? 50 - Number(style.bottom) : top + Number(style.height);
      const left = Number(style.left ?? 100 - Number(style.right) - Number(style.width));
      const right = style.right !== undefined ? 100 - Number(style.right) : left + Number(style.width);
      // The painted part: the whole box, or its border at the far edge.
      const painted = style.borderBottomWidth !== undefined ? { x: left, y: bottom - Number(style.borderBottomWidth), w: right - left, h: Number(style.borderBottomWidth) } : style.borderRightWidth !== undefined ? { x: right - Number(style.borderRightWidth), y: top, w: Number(style.borderRightWidth), h: bottom - top } : { x: left, y: top, w: right - left, h: bottom - top };
      expect(painted, `${kind} ${JSON.stringify(anchor)}`).toEqual({ x, y, w, h });
      // Never placed from the far edge by a size: either the near edge is set (0, or where it is), or the strip is stretched between the two.
      expect(style.top !== undefined || (style.bottom !== undefined && style.height === undefined) || style.borderBottomWidth !== undefined).toBe(true);
    }
  }
  // The bottom strip of a frame, as it is laid: from the box's top to 2 under its bottom, its border 2 deep.
  expect(placeOf({ bottom: -2, height: 2, left: 0, right: 0, color: 'night-900' }, '#0b1022')).toEqual({ position: 'absolute', top: 0, bottom: -2, borderBottomWidth: 2, borderBottomColor: '#0b1022', left: 0, right: 0, width: undefined });
});
