import { PAD, barRects, fitScale, lineGeometry, type BarRect, type WorthBar } from './chartGeometry';
import { COLORS, type ColorToken } from './theme';

/*
 * The web export's twin of `charts.tsx` (Metro picks it for the web): the same charts as the Next web draws them, an SVG each, from the same numbers.
 */

export { barRects, fitScale, lineGeometry };
export type { BarRect, WorthBar };

const TONE = { teal: 'teal-300', wine: 'wine-300' } as const satisfies Record<string, ColorToken>;

/** What a chart says of itself to a screen reader: an image with its label, or nothing where it has none. */
const readAs = (label: string | undefined) => (label === undefined ? ({ 'aria-hidden': true } as const) : ({ role: 'img', 'aria-label': label } as const));

/**
 * An asset's price since the start of the life: a line over a dashed baseline at the price it began at, the area between them lightly tinted, and
 * a dot on the last round (the web's `PriceChart` svg, element for element). `tone` says whether it ended up (teal) or down (wine). `points` are
 * the prices round by round, a price of 1 being where it began. It draws the box `width` x `height` (the viewBox) and fills the room it is in, as
 * the web's svg does; `label` names it.
 */
export function LineChart({ points, tone, width = 280, height = 90, label }: { points: number[]; tone: 'teal' | 'wine'; width?: number; height?: number; label?: string }) {
  const colour = COLORS[TONE[tone]];
  const { line, area, base, end } = lineGeometry(points, width, height);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} {...readAs(label)} style={{ display: 'block', width: '100%' }}>
      {points.length > 0 ? (
        <>
          <path d={area} fill={colour} opacity="0.15" />
          <line x1={PAD} x2={width - PAD} y1={base} y2={base} stroke={COLORS['ink-500']} strokeWidth="1" strokeDasharray="3 3" />
          <path d={line} fill="none" stroke={colour} strokeWidth="2" strokeLinejoin="round" />
          <circle cx={end.x} cy={end.y} r="3.5" fill={colour} />
        </>
      ) : null}
    </svg>
  );
}

/**
 * Net worth after every round of a life, one bar each (the web's `WorthGraph`, which draws with crisp edges): `zero` and `bars` are what
 * `worthBars` gives, `height` is in points and a smaller one makes the graph of a list.
 */
export function Bars({ zero, bars, barWidth, step, height, label }: { zero: number; bars: ReadonlyArray<WorthBar>; barWidth?: number; step?: number; height?: number; label?: string }) {
  const graph = barRects({ zero, bars, barWidth, step, height });
  return (
    <svg width={graph.width} height={graph.height} viewBox={`0 0 ${graph.width} ${graph.height}`} shapeRendering="crispEdges" {...readAs(label)} style={{ display: 'block', flexShrink: 0 }}>
      {graph.rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={COLORS[r.color]} />
      ))}
    </svg>
  );
}
