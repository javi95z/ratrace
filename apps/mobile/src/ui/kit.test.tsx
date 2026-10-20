// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { View } from 'react-native';
import { COLORS } from './theme';
import { TabTitle, Bare, Bar, Button, KeyFigure, Panel, Row, Segmented, Stat, Tag, TickerBadge, Tile, Toggle, Well } from './kit';
import { TapProvider } from './tap';

// Sprites are drawn with Skia on the phone only: here each is a <div> that names its id.
vi.mock('./Sprite', () => ({ Sprite: ({ id }: { id: string }) => <div data-sprite={id} /> }));

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

test('a Button holds an icon beside its words', () => {
  render(<Button variant="secondary" onPress={() => {}}>{[<View key="i" testID="icon" />, 'Keep']}</Button>);
  expect(screen.getByTestId('icon')).toBeTruthy();
  expect(textOf('Keep').style.fontSize).toBe('17px');
});

test('a Row holds mixed left, sub and right', () => {
  render(<Row left={[<View key="i" testID="ico" />, 'Rent']} sub={['a', 'b']} right={[7, 'x']} />);
  expect(screen.getByTestId('ico')).toBeTruthy();
  for (const t of ['Rent', 'a', 'b', '7', 'x']) expect(screen.getByText(t)).toBeTruthy();
});

test('a long TabTitle and a Row stay on one line', () => {
  render(<Panel title={'A very long title indeed'}><Row left="Long left" sub="Long sub" /></Panel>);
  const oneLine = (t: string) => /r-textOverflow-/.test(textOf(t).className);
  for (const t of ['A VERY LONG TITLE INDEED', 'Long left', 'Long sub']) expect(oneLine(t)).toBe(true);
});

test('a Panel is named only when given a label, by its title where it has one', () => {
  const named = (c: HTMLElement) => c.querySelector('[aria-label]');
  let r = render(<Panel title="Wages" label="the wages"><span>b</span></Panel>);
  expect(named(r.container)?.getAttribute('aria-label')).toBe('Wages');
  r.unmount();
  r = render(<Panel label="Money"><span>b</span></Panel>);
  expect(named(r.container)?.getAttribute('aria-label')).toBe('Money');
  r.unmount();
  r = render(<Panel title="Wages"><span>b</span></Panel>);
  expect(named(r.container)).toBeNull();
});

test('numbers are accepted as figure, title and tag text', () => {
  render(<><KeyFigure>{1234}</KeyFigure><TabTitle>{7}</TabTitle><Tag>{3}</Tag></>);
  expect(screen.getAllByText('1234')).toHaveLength(1);
  expect(screen.getByText('7')).toBeTruthy();
  expect(screen.getByText('3')).toBeTruthy();
});

test('a Button inside a labelled Panel stays reachable and the Panel is not accessible', () => {
  const onPress = vi.fn();
  const { container } = render(
    <Panel title="Wages" label="the wages"><Button variant="primary" onPress={onPress}>{'Go'}</Button></Panel>,
  );
  const labelled = container.querySelector('[aria-label]')!;
  expect(labelled.getAttribute('tabindex')).toBeNull();
  expect(labelled.getAttribute('role')).toBeNull();
  fireEvent.click(screen.getByRole('button'));
  expect(onPress).toHaveBeenCalledTimes(1);
});

/**
 * Fires the layout event the way React Native does. react-native-web hands `onLayout` to a
 * ResizeObserver, which jsdom lacks, and keeps the handler on the node as `__reactLayoutHandler`:
 * calling that is exactly what the observer does after it measures.
 */
function layOut(el: HTMLElement, width: number) {
  const handler = (el as unknown as { __reactLayoutHandler?: (e: unknown) => void }).__reactLayoutHandler;
  expect(handler).toBeTypeOf('function');
  act(() => handler!({ nativeEvent: { layout: { x: 0, y: 0, width, height: 40 } } }));
}

test('a Bar with 5 of 16 lights exactly 5 lamps', () => {
  render(<Bar value={5} max={16} label="Progress" tone="gold" />);
  expect(screen.getAllByTestId('lamp-lit')).toHaveLength(5);
  expect(screen.getAllByTestId('lamp-dark')).toHaveLength(11);
  const bar = screen.getByRole('progressbar');
  expect(bar.getAttribute('aria-valuenow')).toBe('31');
});

test.each([
  ['gold', 'gold-500', 'gold-200', 'gold-700'],
  ['teal', 'teal-300', 'sky-100', 'teal-600'],
] as const)('a %s Bar paints lit lamps in %s with %s above and %s below', (tone, base, hi, lo) => {
  render(<Bar value={16} max={16} label="P" tone={tone} />);
  const lamp = screen.getAllByTestId('lamp-lit')[0];
  expect(lamp.style.backgroundColor).toBe(rgb(COLORS[base]));
  const strips = Array.from(lamp.children).map((c) => (c as HTMLElement).style.backgroundColor);
  expect(strips).toContain(rgb(COLORS[hi]));
  expect(strips).toContain(rgb(COLORS[lo]));
});

test('a Bar clamps: empty lights none, over the max lights all 16', () => {
  render(<Bar value={0} max={0} label="P" />);
  expect(screen.queryAllByTestId('lamp-lit')).toHaveLength(0);
  cleanup();
  render(<Bar value={99} max={16} label="P" />);
  expect(screen.getAllByTestId('lamp-lit')).toHaveLength(16);
});

test('a Bar door is shut until the last lamp is lit', () => {
  render(<Bar value={15} max={16} label="P" door />);
  expect(screen.getByTestId('door').getAttribute('data-state')).toBe('shut');
  cleanup();
  render(<Bar value={16} max={16} label="P" door />);
  expect(screen.getByTestId('door').getAttribute('data-state')).toBe('open');
  cleanup();
  render(<Bar value={16} max={16} label="P" />);
  expect(screen.queryByTestId('door')).toBeNull();
});

test('a Stat shows its value and label, with its icon', () => {
  render(<Stat icon="coin" value="1,200" label="Cash" />);
  expect(screen.getByText('1,200')).toBeTruthy();
  expect(screen.getByText('Cash')).toBeTruthy();
  expect(textOf('1,200').style.fontSize).toBe('16px');
  expect(textOf('Cash').style.fontSize).toBe('11px');
  expect(textOf('Cash').style.color).toBe(rgb(COLORS['ink-200']));
  expect(document.querySelector('[data-sprite="coin"]')).toBeTruthy();
});

test('a Stat laid out at 300 hides its icon and at 360 shows it', () => {
  render(<Stat icon="coin" value="1" label="Cash" />);
  const box = screen.getByTestId('stat');
  layOut(box, 300);
  expect(document.querySelector('[data-sprite="coin"]')).toBeNull();
  layOut(box, 360);
  expect(document.querySelector('[data-sprite="coin"]')).toBeTruthy();
});

test('a Stat tones its value', () => {
  render(<Stat icon="coin" value="+5" label="Net" tone="good" />);
  expect(textOf('+5').style.color).toBe(rgb(COLORS['teal-300']));
  cleanup();
  render(<Stat icon="coin" value="-5" label="Net" tone="bad" />);
  expect(textOf('-5').style.color).toBe(rgb(COLORS['wine-300']));
});

test('a Stat with onOpen is a button that taps and opens; without it, it is not', () => {
  const onOpen = vi.fn();
  const tap = vi.fn();
  render(
    <TapProvider value={tap}>
      <Stat icon="coin" value="1" label="Cash" onOpen={onOpen} />
    </TapProvider>,
  );
  expect(screen.getByText('▸')).toBeTruthy();
  fireEvent.click(screen.getByRole('button'));
  expect(onOpen).toHaveBeenCalledTimes(1);
  expect(tap).toHaveBeenCalledTimes(1);
  cleanup();
  render(<Stat icon="coin" value="1" label="Cash" />);
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.queryByText('▸')).toBeNull();
});

const KINDS = [
  ['bond', 'sky-500', 'cream'],
  ['equity', 'teal-800', 'cream'],
  ['crypto', 'gold-700', 'ink-900'],
  ['gold', 'gold-500', 'ink-900'],
] as const;

test.each(KINDS)('a %s TickerBadge is 56 x 36 on %s with %s text', (kind, bg, fg) => {
  render(<TickerBadge ticker="ABC" kind={kind} />);
  const box = backed(screen.getByText('ABC'));
  expect(box.style.backgroundColor).toBe(rgb(COLORS[bg]));
  expect(box.style.width).toBe('56px');
  expect(box.style.height).toBe('36px');
  expect(textOf('ABC').style.color).toBe(rgb(COLORS[fg]));
  expect(textOf('ABC').style.fontSize).toBe('14px');
});

test('a TickerBadge with a logo draws the logo and not the ticker', () => {
  render(<TickerBadge ticker="ABC" kind="equity" logo="logo-abc" />);
  expect(document.querySelector('[data-sprite="logo-abc"]')).toBeTruthy();
  expect(screen.queryByText('ABC')).toBeNull();
});

const CHOICES = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];

test('Segmented marks the chosen option and calls onChange with the other', () => {
  const onChange = vi.fn();
  const tap = vi.fn();
  render(
    <TapProvider value={tap}>
      <Segmented label="Pick" options={CHOICES} value="a" onChange={onChange} orientation="horizontal" />
    </TapProvider>,
  );
  expect(screen.getByRole('radiogroup')).toBeTruthy();
  const [alpha, beta] = screen.getAllByRole('radio');
  expect(alpha.getAttribute('aria-checked')).toBe('true');
  expect(beta.getAttribute('aria-checked')).toBe('false');
  expect(backed(screen.getByText('Alpha')).style.backgroundColor).toBe(rgb(COLORS.cream));
  expect(textOf('Alpha').style.color).toBe(rgb(COLORS['ink-900']));
  expect(backed(screen.getByText('Beta')).style.backgroundColor).toBe(rgb(COLORS['night-600']));
  expect(textOf('Beta').style.color).toBe(rgb(COLORS['ink-200']));
  expect(textOf('Beta').style.fontSize).toBe('14px');
  fireEvent.click(beta);
  expect(onChange).toHaveBeenCalledWith('b');
  expect(tap).toHaveBeenCalledTimes(1);
});

test('a disabled Segmented option does not change or tap', () => {
  const onChange = vi.fn();
  const tap = vi.fn();
  render(
    <TapProvider value={tap}>
      <Segmented label="Pick" options={[CHOICES[0], { ...CHOICES[1], disabled: true }]} value="a" onChange={onChange} orientation="vertical" />
    </TapProvider>,
  );
  fireEvent.click(screen.getAllByRole('radio')[1]);
  expect(onChange).not.toHaveBeenCalled();
  expect(tap).not.toHaveBeenCalled();
});

test('Segmented sets a hint under the label and an icon above it', () => {
  render(<Segmented label="Pick" options={[{ value: 1, label: 'One', hint: 'First', icon: 'ic' }]} value={1} onChange={() => {}} orientation="horizontal" />);
  expect(textOf('First').style.fontSize).toBe('11px');
  expect(textOf('First').style.color).toBe(rgb(COLORS['ink-500']));
  expect(document.querySelector('[data-sprite="ic"]')).toBeTruthy();
});

test('Toggle reports on through its checked state, and a press flips it', () => {
  const onChange = vi.fn();
  const tap = vi.fn();
  const { rerender } = render(
    <TapProvider value={tap}>
      <Toggle on={false} onChange={onChange} label="Sound" hint="Beeps" />
    </TapProvider>,
  );
  const sw = screen.getByRole('switch');
  expect(sw.getAttribute('aria-checked')).toBe('false');
  expect(screen.getByText('Beeps')).toBeTruthy();
  expect(screen.getByTestId('switch').style.backgroundColor).toBe(rgb(COLORS['night-900']));
  expect(screen.getByTestId('knob').style.left).toBe('0px');
  fireEvent.click(sw);
  expect(onChange).toHaveBeenCalledWith(true);
  expect(tap).toHaveBeenCalledTimes(1);
  rerender(
    <TapProvider value={tap}>
      <Toggle on onChange={onChange} label="Sound" />
    </TapProvider>,
  );
  expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  expect(screen.getByTestId('switch').style.backgroundColor).toBe(rgb(COLORS['teal-600']));
  expect(screen.getByTestId('knob').style.left).toBe('20px');
  expect(screen.getByTestId('knob').style.backgroundColor).toBe(rgb(COLORS.cream));
});

test('a disabled Toggle does not change or tap', () => {
  const onChange = vi.fn();
  const tap = vi.fn();
  render(
    <TapProvider value={tap}>
      <Toggle on={false} onChange={onChange} label="Sound" disabled />
    </TapProvider>,
  );
  fireEvent.click(screen.getByRole('switch'));
  expect(onChange).not.toHaveBeenCalled();
  expect(tap).not.toHaveBeenCalled();
});
