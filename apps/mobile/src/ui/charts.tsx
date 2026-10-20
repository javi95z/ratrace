import { Canvas, Circle, DashPathEffect, Group, Line, Path, Rect, vec } from '@shopify/react-native-skia';
import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { COLORS, type ColorToken } from './theme';

/** The bars are the web's `crispEdges`: each edge on a pixel, no blur between. (The price line is smooth on the web, and is smooth here.) */
const CRISP = { antiAlias: false } as const;

/** The web's chart is the box 6 in from each side. */
const PAD = 6;

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

const TONE = { teal: 'teal-300', wine: 'wine-300' } as const satisfies Record<string, ColorToken>;

/**
 * An asset's price since the start of the life: a line over a dashed baseline at the price it began at, the area between
 * them lightly tinted, and a dot on the last round (the figure inside the web's `PriceChart`). It is smoothed as the web's
 * svg is (the plan said unsmoothed; shot beside the web's, the unsmoothed line was the one difference left in the chart).
 * `tone` says whether it ended up
 * (teal) or down (wine). `points` are the prices round by round, a price of 1 being where it began. It draws the box
 * `width` x `height` (the web's viewBox) and fills the room it is in, as the web's svg does; `label` names it.
 */
export function LineChart({ points, tone, width = 280, height = 90, label }: { points: number[]; tone: 'teal' | 'wine'; width?: number; height?: number; label?: string }) {
  const [room, setRoom] = useState<number | null>(null);
  const scale = fitScale(room, width);
  const colour = COLORS[TONE[tone]];
  const { line, area, base, end } = lineGeometry(points, width, height);
  return (
    <View
      accessible={label !== undefined}
      accessibilityRole={label === undefined ? undefined : 'image'}
      accessibilityLabel={label}
      onLayout={(event: LayoutChangeEvent) => setRoom(event.nativeEvent.layout.width)}
      style={{ width: '100%', aspectRatio: width / height }}
    >
      <Canvas style={{ width: width * scale, height: height * scale }}>
        <Group transform={[{ scale }]}>
          {points.length > 0 ? (
            <>
              <Path path={area} color={colour} opacity={0.15} />
              <Line p1={vec(PAD, base)} p2={vec(width - PAD, base)} color={COLORS['ink-500']} style="stroke" strokeWidth={1}>
                <DashPathEffect intervals={[3, 3]} />
              </Line>
              <Path path={line} color={colour} style="stroke" strokeWidth={2} strokeJoin="round" />
              <Circle cx={end.x} cy={end.y} r={3.5} color={colour} />
            </>
          ) : null}
        </Group>
      </Canvas>
    </View>
  );
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

/**
 * Net worth after every round of a life, one bar each (the web's `WorthGraph`, which draws with crisp edges): `zero` and
 * `bars` are what `worthBars` gives, `height` is in points and a smaller one makes the graph of a list.
 */
export function Bars({ zero, bars, barWidth, step, height, label }: { zero: number; bars: ReadonlyArray<WorthBar>; barWidth?: number; step?: number; height?: number; label?: string }) {
  const graph = barRects({ zero, bars, barWidth, step, height });
  return (
    <View
      accessible={label !== undefined}
      accessibilityRole={label === undefined ? undefined : 'image'}
      accessibilityLabel={label}
      style={{ width: graph.width, height: graph.height }}
    >
      <Canvas style={{ width: graph.width, height: graph.height }}>
        {graph.rects.map((r, i) => (
          <Rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} color={COLORS[r.color]} {...CRISP} />
        ))}
      </Canvas>
    </View>
  );
}
