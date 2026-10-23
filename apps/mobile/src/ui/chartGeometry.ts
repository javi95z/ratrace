import type { ColorToken } from './theme';

/*
 * The pure side of the charts: where their lines and bars lie. The phone draws them on a Skia canvas (`charts.tsx`), the web export as SVG
 * (`charts.web.tsx`); both read the same numbers from here.
 */

/** The web's chart is the box 6 in from each side. */
export const PAD = 6;

/**
 * The path of a price round by round, as the web's `PriceChart` works it out (Finance.tsx): the line from the first
 * round to the last across a `w` x `h` box, the area closed down to the level where it began (a price of 1), that level,
 * and the end of the line. The highest price is at the top of the box and the lowest at the foot, and the level of 1 is
 * always inside it. The path is the SVG string, to the tenth of a point, as the web writes it.
 */
export function lineGeometry(values: number[], w = 280, h = 90): { line: string; area: string; base: number; end: { x: number; y: number } } {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 1);
  const span = max - min || 1;
  const x = (i: number) => (values.length > 1 ? PAD + (i * (w - PAD * 2)) / (values.length - 1) : w / 2);
  const y = (value: number) => PAD + (1 - (value - min) / span) * (h - PAD * 2);
  const last = values[values.length - 1] ?? 1;
  const line = values.map((value, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(value).toFixed(1)}`).join(' ');
  const base = y(1);
  const area = `${line} L${x(values.length - 1).toFixed(1)} ${base.toFixed(1)} L${x(0).toFixed(1)} ${base.toFixed(1)} Z`;
  return { line, area, base, end: { x: x(values.length - 1), y: y(last) } };
}

/** How much a chart of `width` of its own is scaled to fill `room`: the web's svg is `w-full`, so it fills what it is in. One until it is measured. */
export function fitScale(room: number | null, width: number): number {
  return room === null || room <= 0 ? 1 : room / width;
}

/** One bar of the net-worth graph, as `worthBars` gives it: shares of the graph's height, `y` from the top and `h` tall. */
export type WorthBar = { y: number; h: number; negative: boolean };

export type BarRect = { kind: 'bar' | 'zero'; x: number; y: number; w: number; h: number; color: ColorToken };

/**
 * The rects of the web's `WorthGraph`: a bar `barWidth` wide every `step` points, the height of its share of `height`, and
 * never thinner than two points where it stands for something. Money owed hangs from the zero line in wine; the last
 * round is gold-200 and the rest gold-500. The zero line, one point thick, is drawn across all of them last.
 */
export function barRects({ zero, bars, barWidth = 10, step = 14, height = 96 }: { zero: number; bars: ReadonlyArray<WorthBar>; barWidth?: number; step?: number; height?: number }): { width: number; height: number; rects: BarRect[] } {
  const width = Math.max(barWidth, bars.length * step - (step - barWidth));
  const line = Math.min(height - 1, Math.round(zero * height));
  const last = bars.length - 1;
  const rects: BarRect[] = [];
  bars.forEach((bar, i) => {
    const tall = bar.h > 0 ? Math.max(2, Math.round(bar.h * height)) : 0;
    if (tall === 0) return;
    const top = bar.negative ? line : Math.min(Math.round(bar.y * height), line - tall);
    rects.push({ kind: 'bar', x: i * step, y: Math.max(0, top), w: barWidth, h: tall, color: bar.negative ? 'wine-500' : i === last ? 'gold-200' : 'gold-500' });
  });
  rects.push({ kind: 'zero', x: 0, y: line, w: width, h: 1, color: 'ink-300' });
  return { width, height, rects };
}
