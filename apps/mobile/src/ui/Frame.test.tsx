// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Text } from 'react-native';
import { Framed } from './Frame';
import { anchorsOf } from './frames';
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
    expect(strip.style.backgroundColor).not.toBe('');
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
  expect(strips.map((strip) => strip.style.backgroundColor)).toEqual(colours.map(rgb));
  // Ungreyed, the same frame is in its own colours.
  const plain = render(<Framed kind="frame"><Text>x</Text></Framed>).container.firstElementChild as HTMLElement;
  expect((plain.firstElementChild as HTMLElement).style.backgroundColor).toBe(rgb(COLORS['night-900']));
});
