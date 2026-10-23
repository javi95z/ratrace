import { Circle, DashPathEffect, Group, Line, Path, Rect, vec } from '@shopify/react-native-skia';
import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Canvas } from './Canvas';
import { PAD, barRects, fitScale, lineGeometry, type BarRect, type WorthBar } from './chartGeometry';
import { COLORS, type ColorToken } from './theme';

/** The bars are the web's `crispEdges`: each edge on a pixel, no blur between. (The price line is smooth on the web, and is smooth here.) */
const CRISP = { antiAlias: false } as const;

export { barRects, fitScale, lineGeometry };
export type { BarRect, WorthBar };

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
