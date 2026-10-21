// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { webBaseline } from './fonts';
import { LinkText } from './LinkText';
import { COLORS } from './theme';

// What the phone tells a text of the lines it is laid out in: react-native-web never says it, so the outer Text of each text is recorded, and the
// test tells it, as the phone would after its layout.
const outers = vi.hoisted(() => [] as Array<(event: { nativeEvent: { lines: unknown[] } }) => void>);
vi.mock('react-native', async (orig) => {
  const rn = (await orig()) as typeof import('react-native');
  const Recorded = (props: Record<string, unknown>) => {
    if (props.selectable === false && typeof props.onTextLayout === 'function') outers.push(props.onTextLayout as never);
    return <rn.Text {...(props as Record<string, unknown>)} />;
  };
  return { ...rn, Text: Recorded };
});

afterEach(() => {
  cleanup();
  outers.length = 0;
});

/** The lines drawn under the words, top to bottom: where each stands, how wide, in what colour. */
const underlines = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('[data-testid="underline"]')].map((line) => ({ top: parseFloat(line.style.top), left: parseFloat(line.style.left || '0'), width: line.style.width, height: line.style.height, color: line.style.backgroundColor }));

/** A line as the phone reports it. */
const laid = (x: number, y: number, width: number, text: string) => ({ x, y, width, height: 17.4, ascender: 13, descender: 3, capHeight: 9, xHeight: 6, text });

/** A colour of the palette as the page writes it. */
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

test('a link of one line is underlined across its words, `offset` under the baseline the web gives its line, and is not drawn again once laid out on one line', () => {
  const { container } = render(<LinkText size={12} offset={2}>{'Switch to variable'}</LinkText>);
  const under = webBaseline('read', 400, 12, 12 * 1.45) + 2;
  // Before the layout: one line, across the words (the box the words are in).
  const one = [{ top: under, left: 0, width: '', height: '1px', color: rgb(COLORS['sky-300']) }];
  expect(underlines(container)).toEqual(one);
  const strip = container.querySelector<HTMLElement>('[data-testid="underline"]');
  expect(strip?.style.right).toBe('0px');
  // The outer text is recorded each time it is drawn: once so far.
  expect(outers).toHaveLength(1);
  // Laid out on one line, which it was taken for: nothing changes, and nothing is drawn again (a text is drawn again only when it wraps).
  act(() => outers[0]({ nativeEvent: { lines: [laid(0, 0, 104, 'Switch to variable')] } }));
  expect(outers).toHaveLength(1);
  expect(underlines(container)).toEqual(one);
  expect(container.querySelector<HTMLElement>('[data-testid="underline"]')).toBe(strip);
  expect(strip?.style.right).toBe('0px');
});

test('a link that wraps is underlined on every line it wraps to, each at its own line\'s baseline offset and as wide as its words', () => {
  const { container } = render(<LinkText size={12} offset={2} tone="teal-300">{'✓ Станет фиксированной в этом раунде'}</LinkText>);
  const under = webBaseline('read', 400, 12, 12 * 1.45) + 2;
  // As the phone lays it out in a column 140 wide: two lines, the second one a line height under the first.
  act(() => outers[outers.length - 1]({ nativeEvent: { lines: [laid(0, 0, 131, '✓ Станет фиксированной '), laid(0, 17.4, 92, 'в этом раунде')] } }));
  const lines = underlines(container);
  expect(lines).toHaveLength(2);
  expect(lines[0]).toEqual({ top: under, left: 0, width: '131px', height: '1px', color: rgb(COLORS['teal-300']) });
  expect(lines[1].top).toBeCloseTo(under + 17.4, 5);
  expect(lines[1]).toMatchObject({ left: 0, width: '92px', height: '1px', color: rgb(COLORS['teal-300']) });
  // Laid out again the same way, it is not drawn again; laid out on one line again, one line across the words again.
  const drawn = outers.length;
  act(() => outers[outers.length - 1]({ nativeEvent: { lines: [laid(0, 0, 131, '✓ Станет фиксированной '), laid(0, 17.4, 92, 'в этом раунде')] } }));
  expect(outers).toHaveLength(drawn);
  act(() => outers[outers.length - 1]({ nativeEvent: { lines: [laid(0, 0, 220, '✓ Станет фиксированной в этом раунде')] } }));
  expect(underlines(container)).toEqual([{ top: under, left: 0, width: '', height: '1px', color: rgb(COLORS['teal-300']) }]);
});

test('words that change are one line again until they are laid out: the lines of the words before are not kept for them', () => {
  const { container, rerender } = render(<LinkText size={12} offset={2}>{'Switch to variable at the next round'}</LinkText>);
  act(() => outers[outers.length - 1]({ nativeEvent: { lines: [laid(0, 0, 131, 'Switch to variable at '), laid(0, 17.4, 70, 'the next round')] } }));
  expect(underlines(container)).toHaveLength(2);
  // The switch ordered: the link says so in other words, which have not been laid out yet.
  rerender(<LinkText size={12} offset={2}>{'✓ Variable this round'}</LinkText>);
  const lines = underlines(container);
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatchObject({ left: 0, width: '' });
});

test('the lines take no touch and say nothing to a screen reader: the link is its words', () => {
  const { container } = render(<LinkText size={13} offset={4}>{'Undo'}</LinkText>);
  for (const line of container.querySelectorAll<HTMLElement>('[data-testid="underline"]')) {
    expect(line.getAttribute('aria-hidden')).toBe('true');
    expect(getComputedStyle(line).pointerEvents).toBe('none');
  }
  expect(container.textContent).toBe('Undo');
});
