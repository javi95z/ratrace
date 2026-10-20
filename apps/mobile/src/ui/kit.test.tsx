// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { COLORS } from './theme';
import { Bare, Button, KeyFigure, Panel, Row, Tag, Tile, Well } from './kit';
import { TapProvider } from './tap';

afterEach(cleanup);

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};

/** The nearest element at or above `el` that paints a background. */
function backed(el: HTMLElement): HTMLElement {
  let cur: HTMLElement | null = el;
  while (cur && cur.style.backgroundColor === '') cur = cur.parentElement;
  return cur!;
}

/** The outer Text of a PixelText/ReadText holding `text`. */
function textOf(text: string): HTMLElement {
  return screen.getByText(text).parentElement as HTMLElement;
}

const VARIANTS = [
  ['primary', 'gold-500', 'ink-900'],
  ['secondary', 'night-600', 'cream'],
  ['danger', 'wine-700', 'cream'],
  ['quiet', 'night-700', 'ink-200'],
] as const;

test.each(VARIANTS)('Button %s has its background and text colour', (variant, bg, fg) => {
  render(<Button variant={variant} onPress={() => {}}>{'Go'}</Button>);
  expect(backed(screen.getByText('Go')).style.backgroundColor).toBe(rgb(COLORS[bg]));
  const label = textOf('Go');
  expect(label.style.color).toBe(rgb(COLORS[fg]));
  expect(label.style.fontSize).toBe('17px');
});

test('Button is at least 44 high with 16 x 8 padding', () => {
  render(<Button variant="secondary" onPress={() => {}}>{'Go'}</Button>);
  const box = backed(screen.getByText('Go'));
  expect(box.style.minHeight).toBe('44px');
  expect(box.style.paddingLeft).toBe('16px');
  expect(box.style.paddingTop).toBe('8px');
});

test('Button press calls onPress and the tap sound', () => {
  const onPress = vi.fn();
  const tap = vi.fn();
  render(
    <TapProvider value={tap}>
      <Button variant="primary" onPress={onPress}>{'Go'}</Button>
    </TapProvider>,
  );
  fireEvent.click(screen.getByText('Go'));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(tap).toHaveBeenCalledTimes(1);
});

test('a disabled Button is at 0.45 opacity and does not press or tap', () => {
  const onPress = vi.fn();
  const tap = vi.fn();
  render(
    <TapProvider value={tap}>
      <Button variant="primary" disabled onPress={onPress}>{'Go'}</Button>
    </TapProvider>,
  );
  fireEvent.click(screen.getByText('Go'));
  expect(onPress).not.toHaveBeenCalled();
  expect(tap).not.toHaveBeenCalled();
  let cur: HTMLElement | null = screen.getByText('Go');
  while (cur && cur.style.opacity === '') cur = cur.parentElement;
  expect(cur?.style.opacity).toBe('0.45');
});

test('a wide Button fills its width', () => {
  render(<Button variant="secondary" wide onPress={() => {}}>{'Go'}</Button>);
  let cur: HTMLElement | null = screen.getByText('Go');
  while (cur && cur.style.width !== '100%') cur = cur.parentElement;
  expect(cur).not.toBeNull();
});

test('Tile presses with the tap sound, on night-600', () => {
  const onPress = vi.fn();
  const tap = vi.fn();
  render(
    <TapProvider value={tap}>
      <Tile onPress={onPress}><Bare><span>{'pic'}</span></Bare></Tile>
    </TapProvider>,
  );
  expect(backed(screen.getByText('pic')).style.backgroundColor).toBe(rgb(COLORS['night-600']));
  fireEvent.click(screen.getByText('pic'));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(tap).toHaveBeenCalledTimes(1);
});

test('Panel with a title renders the tab and pads 20 on top', () => {
  render(<Panel title="Wages"><span>{'body'}</span></Panel>);
  const panel = backed(screen.getByText('body'));
  expect(panel.style.backgroundColor).toBe(rgb(COLORS['night-700']));
  expect(panel.style.paddingTop).toBe('20px');
  expect(panel.style.marginTop).toBe('12px');
  expect(panel.style.paddingLeft).toBe('12px');
  const title = textOf('WAGES');
  expect(title.style.color).toBe(rgb(COLORS['ink-900']));
  expect(title.style.fontSize).toBe('14px');
  expect(backed(title).style.backgroundColor).toBe(rgb(COLORS['gold-500']));
});

test('Panel without a title pads 12 all round', () => {
  render(<Panel><span>{'body'}</span></Panel>);
  const panel = backed(screen.getByText('body'));
  expect(panel.style.paddingTop).toBe('12px');
  expect(panel.style.marginTop).not.toBe('12px');
});

test('Tag tones map to their colours', () => {
  const tones = [
    ['good', 'teal-800', 'cream'],
    ['bad', 'wine-700', 'cream'],
    ['plain', 'night-600', 'ink-200'],
  ] as const;
  for (const [tone, bg, fg] of tones) {
    const { unmount } = render(<Tag tone={tone}>{tone}</Tag>);
    expect(backed(screen.getByText(tone)).style.backgroundColor).toBe(rgb(COLORS[bg]));
    expect(textOf(tone).style.color).toBe(rgb(COLORS[fg]));
    expect(textOf(tone).style.fontSize).toBe('12px');
    unmount();
  }
});

test('Well is a sunk ink-900 box', () => {
  render(<Well><span>{'x'}</span></Well>);
  expect(backed(screen.getByText('x')).style.backgroundColor).toBe(rgb(COLORS['ink-900']));
});

test('Row shows left, sub and right', () => {
  render(<Row left="Rent" sub="monthly" right="-200" />);
  expect(screen.getByText('Rent')).toBeTruthy();
  expect(textOf('monthly').style.color).toBe(rgb(COLORS['ink-300']));
  expect(textOf('monthly').style.fontSize).toBe('12px');
  expect(screen.getByText('-200')).toBeTruthy();
});

test('KeyFigure is 28 pt in its tone', () => {
  const tones = { gold: 'gold-500', teal: 'teal-300', wine: 'wine-300', cream: 'cream' } as const;
  for (const [tone, token] of Object.entries(tones) as Array<[keyof typeof tones, keyof typeof COLORS]>) {
    const { unmount } = render(<KeyFigure tone={tone}>{'1,234'}</KeyFigure>);
    const el = textOf('1,234');
    expect(el.style.fontSize).toBe('28px');
    expect(el.style.color).toBe(rgb(COLORS[token]));
    unmount();
  }
});
