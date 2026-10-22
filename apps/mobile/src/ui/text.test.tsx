// @vitest-environment jsdom
import { act, fireEvent, render } from '@testing-library/react';
import { View } from 'react-native';
import { Button } from './kit';
import { afterEach, expect, test, vi } from 'vitest';
import { PIXEL_X_HEIGHT } from '@ratrace/core/game/share';
import { X_HEIGHT } from './fontCoverage';
import { adjustedRead, JERSEY_X_HEIGHT, OSWALD_X_HEIGHT } from './fonts';
import { COLORS } from './theme';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { headroom, Language, onGrid, PixelText, ReadText, RU_WORD_SPACING, SNUG, TIGHT } from './text';

// Sprites are drawn with Skia on the phone only (the Button's module holds the kit's sprites).
vi.mock('./Sprite', () => ({ Sprite: () => null }));

// Records the style every Text is given: react-native-web drops what only a phone reads (includeFontPadding). The outer Text of a text (the one that is
// not selectable) is recorded whole, with what the phone is told of its lines, and the platform is the test's to say.
const textStyles = vi.hoisted(() => [] as unknown[]);
const outers = vi.hoisted(() => [] as Array<{ style: Record<string, unknown>; onTextLayout?: (event: { nativeEvent: { lines: unknown[] } }) => void }>);
const platform = vi.hoisted(() => ({ OS: 'web' }));
vi.mock('react-native', async (orig) => {
  const rn = (await orig()) as typeof import('react-native');
  const Recorded = (props: Record<string, unknown>) => {
    textStyles.push(rn.StyleSheet.flatten(props.style as never));
    if (props.selectable === false) outers.push({ style: rn.StyleSheet.flatten(props.style as never) as Record<string, unknown>, onTextLayout: props.onTextLayout as never });
    return <rn.Text {...(props as Record<string, unknown>)} />;
  };
  return { ...rn, Text: Recorded, Platform: { ...rn.Platform, get OS() { return platform.OS; } }, PixelRatio: { get: () => 3 } };
});

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

test('a Russian title spaced by its style (a panel\'s tab, 0.1 em) takes the word spacing off that spacing, not off its face\'s 0.03 em', () => {
  // The web adds `word-spacing` to whatever `letter-spacing` the element has: a tab's `tracking-[0.1em]` and `-0.16em` make a space of -0.06 em.
  const ru = render(<Language.Provider value="ru"><PixelText size={14} style={{ letterSpacing: 1.4 }}>{'ТВОИ ИНВЕСТИЦИИ'}</PixelText></Language.Provider>);
  const space = spans(ru.container).find((s) => s.textContent === ' ')!;
  expect(parseFloat(space.style.letterSpacing)).toBeCloseTo(1.4 + 14 * RU_WORD_SPACING, 5);
  // The words take the text's own (the style's), set on the whole.
  expect(parseFloat((ru.container.firstElementChild as HTMLElement).style.letterSpacing)).toBeCloseTo(1.4, 5);
  expect(spans(ru.container).filter((s) => s.textContent !== ' ').every((s) => s.style.letterSpacing === '')).toBe(true);
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

test('a text\'s headroom keeps a caller\'s own padding, and adds to it', () => {
  const r = headroom(2, 16, { paddingTop: 4, paddingBottom: 6, marginTop: 1 });
  const room = 8 + 2;
  expect(r.paddingTop).toBe(4 + room + 2);
  expect(r.paddingBottom).toBe(6 + room);
  expect(r.marginTop).toBe(1 - room);
  expect(Number(r.marginTop) + Number(r.paddingTop)).toBe(1 + 4 + 2);
});

test('words never take a tap: a text just below a Button lets the press through to it', () => {
  const onPress = vi.fn();
  const { container, getByText } = render(
    <View>
      <Button variant="primary" onPress={onPress}>{'Go'}</Button>
      <ReadText>{'Below the button'}</ReadText>
    </View>,
  );
  const words = getByText('Below the button').parentElement as HTMLElement;
  expect(words.style.pointerEvents).toBe('none');
  fireEvent.click(container.querySelector('[role="button"]')!);
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('a line height is a prop of its own, and the style takes neither a size nor a line height (they are the text\'s own)', () => {
  const { container } = render(<PixelText size={12} lineHeight={15}>{'Tag'}</PixelText>);
  expect(parseFloat((container.firstElementChild as HTMLElement).style.lineHeight)).toBeCloseTo(15, 0);
  const read = render(<ReadText size={11} lineHeight={13.75}>{'Cash'}</ReadText>);
  expect(parseFloat((read.container.firstElementChild as HTMLElement).style.lineHeight)).toBeCloseTo(13.75, 0);
  // @ts-expect-error a size goes in `size`
  void (<PixelText style={{ fontSize: 30 }}>{'x'}</PixelText>);
  // @ts-expect-error a line height goes in `lineHeight`
  void (<ReadText style={{ lineHeight: 30 }}>{'x'}</ReadText>);
});

test('no text is given Android\'s font padding: its lines are as tall as the web\'s', () => {
  textStyles.length = 0;
  render(<><PixelText>{'Rank'}</PixelText><ReadText>{'Hello'}</ReadText></>);
  expect(textStyles.length).toBeGreaterThan(0);
  for (const style of textStyles) expect(style).toMatchObject({ includeFontPadding: false });
});

test('the two leadings of the web\'s small text are written once, here: tight is 1.25 and snug is 1.375, and no screen has a copy of either', () => {
  expect([TIGHT, SNUG]).toEqual([1.25, 1.375]);
  const dir = join(dirname(fileURLToPath(import.meta.url)), '../game/screens');
  for (const name of readdirSync(dir).filter((file) => /\.tsx$/.test(file) && !/\.test\./.test(file))) {
    expect(readFileSync(join(dir, name), 'utf8'), name).not.toMatch(/const (SNUG|TIGHT)\b/);
  }
});

afterEach(() => {
  platform.OS = 'web';
  outers.length = 0;
});

/** The outer text now drawn, and how to tell it its lines. */
const outer = () => outers[outers.length - 1];
const told = (lines: number) => act(() => outer().onTextLayout!({ nativeEvent: { lines: Array.from({ length: lines }, () => ({})) } }));
const bottom = () => Number(outer().style.marginBottom ?? 0);

test('on iOS a paragraph is held to its lines at the exact line height: each line is on the device\'s grid, and the box is given back what that adds up to', () => {
  platform.OS = 'ios';
  // 14 × 1.375 is 19.25 pt, 57.75 device px; a line is drawn at 58, so n lines are n × 0.25 px (n × 0.083 pt) taller than the web's.
  const off = 19.25 - 58 / 3;
  render(<ReadText size={14} lineHeight={14 * SNUG}>{'A paragraph of a few lines.'}</ReadText>);
  // In its first frame it is one line, held as one: that is what nearly every text is, and it is right before anything is asked.
  const one = bottom();
  // One line is told: nothing changes (and the text is not drawn again for it, below).
  told(1);
  expect(bottom()).toBeCloseTo(one, 6);
  told(6);
  expect(bottom() - one).toBeCloseTo(5 * off, 6);
  // And again for another count: it is the lines drawn now that are given back.
  told(2);
  expect(bottom() - one).toBeCloseTo(off, 6);
});

test('a text is held to its exact line in its first frame, as one line, and a text cut to one line is held the same: before any line count is reported', () => {
  platform.OS = 'ios';
  render(<ReadText size={14} lineHeight={14 * SNUG}>{'A line, or a few'}</ReadText>);
  const wrapping = bottom();
  outers.length = 0;
  render(<ReadText size={14} lineHeight={14 * SNUG} numberOfLines={1}>{'A line, or a few'}</ReadText>);
  expect(bottom()).toBeCloseTo(wrapping, 6);
  // 19.25 pt is drawn at 58 device px (19.33): the third of a pixel is given back at once.
  outers.length = 0;
  render(<ReadText size={14} lineHeight={14 * SNUG}>{'A line, or a few'}</ReadText>);
  const first = bottom();
  told(3);
  expect(bottom() - first).toBeCloseTo(2 * (19.25 - 58 / 3), 6);
});

test('a text that is one line is not drawn again when it reports its layout: nothing is changed by it, and nothing is drawn twice', () => {
  platform.OS = 'ios';
  render(<ReadText size={14} lineHeight={14 * SNUG}>{'One line'}</ReadText>);
  const drawn = outers.length;
  told(1);
  expect(outers.length).toBe(drawn);
  // One that turns out to wrap is drawn once more, to be corrected.
  told(3);
  expect(outers.length).toBe(drawn + 1);
  told(3);
  expect(outers.length).toBe(drawn + 1);
});

test('a paragraph\'s own bottom margin is kept: what is given back is added to it', () => {
  platform.OS = 'ios';
  render(<ReadText size={14} lineHeight={14 * SNUG} style={{ marginBottom: 10 }}>{'A paragraph of a few lines.'}</ReadText>);
  const alone = bottom();
  told(4);
  expect(bottom() - alone).toBeCloseTo(3 * (19.25 - 58 / 3), 6);
  expect(bottom()).toBeLessThan(alone + 0.1);
});

test('a pixel title that wraps is held the same way', () => {
  platform.OS = 'ios';
  render(<PixelText size={17} lineHeight={17 * TIGHT}>{'A long name of a life that wraps'}</PixelText>);
  const alone = bottom();
  told(3);
  // 17 × 1.25 is 21.25 pt, 63.75 px, drawn at 64.
  expect(bottom() - alone).toBeCloseTo(2 * (21.25 - 64 / 3), 6);
});

test('a line that is on the grid already is held to nothing, and its lines are not even counted', () => {
  platform.OS = 'ios';
  render(<ReadText size={12} lineHeight={18}>{'Three lines of a text whose line is a whole number of pixels'}</ReadText>);
  expect(outer().onTextLayout).toBeUndefined();
});

test('a text that cannot wrap is not asked its lines, and neither is any text off iOS, which lays its lines as it is told', () => {
  platform.OS = 'ios';
  render(<ReadText size={14} lineHeight={14 * SNUG} numberOfLines={1}>{'One line'}</ReadText>);
  expect(outer().onTextLayout).toBeUndefined();
  outers.length = 0;
  platform.OS = 'android';
  render(<ReadText size={14} lineHeight={14 * SNUG}>{'Some lines'}</ReadText>);
  expect(outer().onTextLayout).toBeUndefined();
});

/** A theme colour as the browser writes it. */
const rgb = (token: keyof typeof COLORS) => {
  const n = parseInt(COLORS[token].slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};

test('words can run on in the same text in a colour of their own: the web\'s inline span, so one paragraph that wraps as a whole', () => {
  const { container } = render(<ReadText size={12} tone="gold-500" after={[{ text: 'Reach the top', tone: 'ink-200' }]}>{'To unlock: '}</ReadText>);
  const whole = container.firstElementChild as HTMLElement;
  expect(whole.textContent).toBe('To unlock: Reach the top');
  expect(whole.style.color).toBe(rgb('gold-500'));
  const [lead, rest] = spans(container);
  expect(lead.textContent).toBe('To unlock: ');
  expect(rest.textContent).toBe('Reach the top');
  expect(rest.style.color).toBe(rgb('ink-200'));
  expect(rest.firstElementChild!.getAttribute('style')).toContain('ChakraPetch_400Regular');
  // One text, one line height: the words that run on are not a text of their own.
  expect(whole.style.lineHeight).not.toBe('');
  expect(whole.querySelectorAll('[style*="line-height"]')).toHaveLength(0);
});

test('words that run on take the text\'s own colour, size and letter spacing unless they are told another, and nothing at all when there are none', () => {
  const { container } = render(<PixelText size={11} tone="gold-500" style={{ letterSpacing: 1.65 }} after={[{ text: '●' }, { text: '' }]}>{'●●'}</PixelText>);
  const [dots, more] = spans(container);
  expect(spans(container)).toHaveLength(2);
  expect(more.textContent).toBe('●');
  expect(more.style.color).toBe('');
  expect(parseFloat(more.style.fontSize)).toBeCloseTo(11, 5);
  // The spacing is the outer text's: a nested text inherits it.
  expect(parseFloat((container.firstElementChild as HTMLElement).style.letterSpacing)).toBeCloseTo(1.65, 5);
  expect(dots.textContent).toBe('●●');
});

test('a reading face run on after a pixel text is set where the pixel text\'s font-size-adjust reaches it: larger, as the font it falls to has it', () => {
  const { container } = render(<PixelText size={17} after={[{ text: ' · Lucía', read: 13 }]}>{'Nurse'}</PixelText>);
  const [name, aside] = spans(container);
  expect(name.textContent).toBe('Nurse');
  expect(aside.textContent).toBe(' · Lucía');
  const run = aside.firstElementChild as HTMLElement;
  expect(run.style.fontFamily).toContain('ChakraPetch_400Regular');
  expect(parseFloat(run.style.fontSize)).toBeCloseTo(adjustedRead(13), 3);
});

test('in Russian the Cyrillic of that reading face is Exo 2, adjusted to its own small letters, and its spaces are tightened by the pixel text\'s word spacing like the title\'s', () => {
  const { container } = render(<Language.Provider value="ru"><PixelText size={17} after={[{ text: ' · Люсия', read: 13 }]}>{'Медсестра'}</PixelText></Language.Provider>);
  const aside = spans(container)[1];
  const runs = Array.from(aside.children) as HTMLElement[];
  const name = runs.find((run) => run.textContent === 'Люсия')!;
  expect(name.style.fontFamily).toContain('Exo2_400Regular');
  expect(parseFloat(name.style.fontSize)).toBeCloseTo((13 * PIXEL_X_HEIGHT) / X_HEIGHT.Exo2_400Regular, 3);
  const space = runs.find((run) => run.textContent === ' ')!;
  expect(parseFloat(space.style.letterSpacing)).toBeCloseTo(17 * (0.03 + RU_WORD_SPACING), 5);
});

test('on iOS the baseline counts the fonts that run on: a text with a reading face after it sits where the line is really drawn', () => {
  platform.OS = 'ios';
  render(<PixelText size={17} lineHeight={17 * TIGHT}>{'Nurse'}</PixelText>);
  const alone = outer().style.paddingTop;
  outers.length = 0;
  // (A reading face large enough to be the deepest in the line, so that it is the one the line is set from on iOS.)
  render(<PixelText size={17} lineHeight={17 * TIGHT} after={[{ text: ' · Lucía', read: 40 }]}>{'Nurse'}</PixelText>);
  expect(outer().style.paddingTop).not.toBe(alone);
});

test('a text cut to one line is one line: nothing is asked of it, and it is held to the exact line like a text that is one (above)', () => {
  platform.OS = 'ios';
  render(<ReadText size={14} lineHeight={14 * SNUG} numberOfLines={1}>{'A line'}</ReadText>);
  expect(outer().onTextLayout).toBeUndefined();
});

test('a line that is on the grid already needs no holding, whether or not it is cut to one line', () => {
  platform.OS = 'ios';
  render(<ReadText size={12} lineHeight={18}>{'One line'}</ReadText>);
  const open = bottom();
  outers.length = 0;
  render(<ReadText size={12} lineHeight={18} numberOfLines={1}>{'One line'}</ReadText>);
  expect(bottom()).toBeCloseTo(open, 6);
});

test('an italic reading text is set in the slanted faces, on every platform, and never asked for the platform\'s italic on top of them (Android would slant it twice)', () => {
  for (const os of ['web', 'ios', 'android']) {
    platform.OS = os;
    const { container, unmount } = render(<ReadText italic>{'Someone who knows every shortcut'}</ReadText>);
    const run = spans(container)[0];
    expect(run.style.fontFamily, os).toContain('ChakraPetch_400Regular_Slant');
    expect(run.style.fontStyle, os).toBe('');
    expect((container.firstElementChild as HTMLElement).style.fontStyle, os).toBe('');
    unmount();
  }
  platform.OS = 'web';
  const russian = render(<Language.Provider value="ru"><ReadText italic weight={600}>{'Люсия'}</ReadText></Language.Provider>);
  expect(spans(russian.container)[0].style.fontFamily).toContain('Exo2_600SemiBold_Slant');
});

test('a text that is not italic is upright, and what has no slanted face is asked for the platform\'s italic once', () => {
  const upright = render(<ReadText>{'Someone who knows every shortcut'}</ReadText>);
  expect(spans(upright.container)[0].style.fontFamily).toContain('ChakraPetch_400Regular');
  expect(spans(upright.container)[0].style.fontFamily).not.toContain('Slant');
  upright.unmount();
  // A sign no font of the stack has is Arial's or the system's, which have real italics.
  const signs = render(<ReadText italic>{'Go ✓ on'}</ReadText>);
  const sign = spans(signs.container).find((run) => run.textContent?.includes('✓'))!;
  expect(sign.style.fontFamily).not.toContain('Slant');
  expect(sign.style.fontStyle).toBe('italic');
  expect(spans(signs.container)[0].style.fontStyle).toBe('');
});

test('words that run on take the text\'s italic, and may be italic where it is not (an italic quip after a pixel title)', () => {
  const inherits = render(<ReadText italic after={[{ text: ' and more' }]}>{'Some words'}</ReadText>);
  expect(Array.from(spans(inherits.container)[1].children).every((run) => (run as HTMLElement).style.fontFamily.includes('Slant'))).toBe(true);
  inherits.unmount();
  const own = render(<PixelText size={12} after={[{ text: 'Why not', read: 12, italic: true }, { text: ' and not', read: 12 }]}>{'Advisor: '}</PixelText>);
  const [, italic, upright] = spans(own.container);
  expect((italic.firstElementChild as HTMLElement).style.fontFamily).toContain('Slant');
  expect((upright.firstElementChild as HTMLElement).style.fontFamily).not.toContain('Slant');
});

test('a reading paragraph can open with words in the pixel face (the web\'s `pixel` span in a paragraph: who speaks, then what they say), at its size and its own spacing', () => {
  const { container } = render(
    <ReadText size={12} lineHeight={12 * SNUG} after={[{ text: 'YOUR ADVISER: ', tone: 'gold-200', pixel: true, tracking: 12 * 0.05 }, { text: 'All in order.', tone: 'ink-200', italic: true }]}>
      {''}
    </ReadText>,
  );
  const whole = container.firstElementChild as HTMLElement;
  expect(whole.textContent).toBe('YOUR ADVISER: All in order.');
  // One paragraph: one text, one line height, the reading face's.
  expect(whole.style.lineHeight).not.toBe('');
  const [who, said] = spans(container);
  expect(who.style.color).toBe(rgb('gold-200'));
  expect((who.firstElementChild as HTMLElement).style.fontFamily).toContain('Jersey');
  // The span's own spacing, set on it; what follows takes the paragraph's again (none: a spacing of 0 would turn iOS's kerning off).
  expect(parseFloat(who.style.letterSpacing)).toBeCloseTo(0.6, 5);
  expect(said.style.letterSpacing).toBe('');
  expect(whole.style.letterSpacing).toBe('');
  expect((said.firstElementChild as HTMLElement).style.fontFamily).toContain('Slant');
});

test('a pixel span takes the pixel face\'s 0.03 em where it has no spacing of its own, and on a Russian page its narrower word spaces', () => {
  const { container } = render(
    <Language.Provider value="ru">
      <ReadText size={12} after={[{ text: 'ТВОЙ КОНСУЛЬТАНТ: ', pixel: true }, { text: 'Всё чисто.' }]}>{''}</ReadText>
    </Language.Provider>,
  );
  const [who, said] = spans(container);
  expect(parseFloat(who.style.letterSpacing)).toBeCloseTo(12 * 0.03, 5);
  expect((who.firstElementChild as HTMLElement).style.fontFamily).toContain('Oswald');
  const space = (Array.from(who.children) as HTMLElement[]).find((run) => run.textContent === ' ')!;
  expect(parseFloat(space.style.letterSpacing)).toBeCloseTo(12 * (0.03 + RU_WORD_SPACING), 5);
  // The reading words after it keep their own spaces.
  expect((Array.from(said.children) as HTMLElement[]).every((run) => run.style.letterSpacing === '')).toBe(true);
});

test('a pixel span runs on in a reading text where the web sets one (the obituary\'s title): in the pixel face at the stack\'s small letters, with its own tracking, and the words after it in their own', () => {
  const { container } = render(<ReadText size={13} lineHeight={13 * SNUG} after={[{ text: 'OBITUARY: ', tone: 'ink-300', pixel: true, tracking: 13 * 0.05 }, { text: 'Paid every bill on time.', italic: true }]}>{''}</ReadText>);
  const whole = container.firstElementChild as HTMLElement;
  expect(whole.textContent).toBe('OBITUARY: Paid every bill on time.');
  const [title, rest] = spans(container);
  expect(title.style.color).toBe(rgb('ink-300'));
  expect(parseFloat(title.style.letterSpacing)).toBeCloseTo(13 * 0.05, 5);
  const run = title.firstElementChild as HTMLElement;
  expect(run.style.fontFamily).toContain('Jersey15_400Regular');
  expect(parseFloat(run.style.fontSize)).toBeCloseTo((13 * PIXEL_X_HEIGHT) / JERSEY_X_HEIGHT, 3);
  // The words after it are the reading text's own: no tracking of the title's, in the slanted face.
  expect(rest.style.letterSpacing).toBe('');
  expect((rest.firstElementChild as HTMLElement).style.fontFamily).toContain('ChakraPetch_400Regular_Slant');
  expect(parseFloat((rest.firstElementChild as HTMLElement).style.fontSize)).toBeCloseTo(13, 5);
});
