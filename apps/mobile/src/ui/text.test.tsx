// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { PIXEL_X_HEIGHT } from '@ratrace/core/game/share';
import { JERSEY_X_HEIGHT, OSWALD_X_HEIGHT } from './fonts';
import { headroom, Language, onGrid, PixelText, ReadText, RU_WORD_SPACING } from './text';

const spans = (container: HTMLElement) => Array.from(container.firstElementChild!.children) as HTMLElement[];

test('on a Russian page PixelText lays Jersey and Oswald runs in one outer text, each at its own scaled size', () => {
  const { container } = render(<Language.Provider value="ru"><PixelText size={20}>{'Ранг 3'}</PixelText></Language.Provider>);
  // The space is apart, for the Russian word spacing.
  const [cyr, space, fig] = spans(container);
  expect(space.textContent).toBe(' ');
  expect(cyr.textContent).toBe('Ранг');
  expect(cyr.style.fontFamily).toContain('Oswald_500Medium');
  expect(parseFloat(cyr.style.fontSize)).toBeCloseTo((20 * PIXEL_X_HEIGHT) / OSWALD_X_HEIGHT, 1);
  expect(fig.textContent).toBe('3');
  expect(fig.style.fontFamily).toContain('Jersey15_400Regular');
  expect(parseFloat(fig.style.fontSize)).toBeCloseTo((20 * PIXEL_X_HEIGHT) / JERSEY_X_HEIGHT, 1);
  const outer = container.firstElementChild as HTMLElement;
  expect(parseFloat(outer.style.lineHeight)).toBeCloseTo(22, 5);
});

test('ReadText is 15 pt, line height 1.45, cream, Chakra', () => {
  const { container } = render(<ReadText>{'Hello'}</ReadText>);
  const outer = container.firstElementChild as HTMLElement;
  expect(outer.style.fontSize).toBe('15px');
  expect(parseFloat(outer.style.lineHeight)).toBeCloseTo(21.75, 5);
  expect(outer.style.color).toBe('rgb(244, 241, 228)');
  expect(spans(container)[0].style.fontFamily).toContain('ChakraPetch_400Regular');
});

test('on a Russian page each space of a title is set 0.16 em tighter, as the web\'s :lang(ru) word spacing; elsewhere not', () => {
  const ru = render(<Language.Provider value="ru"><PixelText size={20}>{'Ранг 3'}</PixelText></Language.Provider>);
  const space = spans(ru.container).find((s) => s.textContent === ' ')!;
  expect(parseFloat(space.style.letterSpacing)).toBeCloseTo(20 * (0.03 + RU_WORD_SPACING), 5);
  ru.unmount();
  const en = render(<PixelText size={20}>{'Rank 3'}</PixelText>);
  expect(spans(en.container).every((s) => s.style.letterSpacing === '')).toBe(true);
});

test('a reading text never takes the word spacing', () => {
  const { container } = render(<Language.Provider value="ru"><ReadText>{'Ранг 3'}</ReadText></Language.Provider>);
  expect(spans(container).every((s) => s.style.letterSpacing === '')).toBe(true);
});

test('on iOS a line height is put on the pixel grid, to the nearest pixel, so iOS\'s rounding up keeps it there', () => {
  // 21.75 at 3×: 65.25 device pixels → 65, a hair under, so that iOS's ceiling stays at 65 (21.67), not 66 (22).
  expect(onGrid(21.75, 3)).toBeCloseTo(65 / 3, 2);
  expect(Math.ceil(onGrid(21.75, 3) * 3)).toBe(65);
  expect(Math.ceil(onGrid(18.7, 3) * 3)).toBe(56);
  expect(Math.ceil(onGrid(13.75, 2) * 2)).toBe(28);
});

test('where there is no letter spacing none is set: on iOS a spacing of 0 turns the font\'s kerning off', () => {
  const read = render(<ReadText>{'Your salary'}</ReadText>);
  expect((read.container.firstElementChild as HTMLElement).style.letterSpacing).toBe('');
  read.unmount();
  const plain = render(<PixelText size={20} tracking={false}>{'12.346 $'}</PixelText>);
  expect((plain.container.firstElementChild as HTMLElement).style.letterSpacing).toBe('');
  plain.unmount();
  const tracked = render(<PixelText size={20}>{'Go'}</PixelText>);
  expect(parseFloat((tracked.container.firstElementChild as HTMLElement).style.letterSpacing)).toBeCloseTo(0.6, 5);
});

test('a text moved to the browser\'s baseline keeps its place in the layout, with room for glyphs that stand out of its line', () => {
  for (const [shift, margin] of [[2.33, 0], [-1, 12]] as const) {
    const r = headroom(shift, 28, { marginBottom: margin });
    const [pt, pb, mt, mb] = [r.paddingTop, r.paddingBottom, r.marginTop, r.marginBottom].map(Number);
    // The glyphs move by `shift`; the box's place and the caller's own margin stay as they were.
    expect(mt + pt).toBeCloseTo(shift, 6);
    expect(pt + pb + mt + mb).toBeCloseTo(margin, 6);
    // At least half the size of room above and below the glyphs' line, inside the box (iOS clips a text to its box).
    expect(pt - shift).toBeGreaterThanOrEqual(14);
    expect(pb).toBeGreaterThanOrEqual(14);
    expect(pt).toBeGreaterThanOrEqual(0);
  }
});
