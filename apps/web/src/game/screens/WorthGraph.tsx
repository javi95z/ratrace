'use client';

import { useWords } from '@/game/context';
import { START_AGE } from '@ratrace/content';
import { worthBars } from '@/game/present';

/** One bar of the graph, in screen pixels: ten of bar and four of gap. */
const BAR = 10;
const STEP = 14;

/**
 * Net worth after every round of a life, one pixel bar each, in the dollars of age 22 so that
 * the rounds can be compared. `height` is in screen pixels; a smaller one makes the graph of a list.
 */
export function WorthGraph({ history, label, height = 96, growMs }: { history: number[]; label: string; height?: number; /** If set, the last bar grows from the line after this long: the round just played. */ growMs?: number }) {
  const { content, fmt } = useWords();
  const { zero, bars } = worthBars(history);
  const width = Math.max(BAR, bars.length * STEP - (STEP - BAR));
  const line = Math.min(height - 1, Math.round(zero * height));
  const last = history.length - 1;

  return (
    <div className="mx-auto" style={{ width }}>
      <div className="mb-1 flex justify-between text-[11px] text-ink-300">
        <span>{fmt.compact(Math.max(0, ...history))}</span>
      </div>
      <svg role="img" aria-label={label} width={width} height={height} viewBox={`0 0 ${width} ${height}`} shapeRendering="crispEdges" className="block">
        {bars.map((bar, i) => {
          // A bar that stands for something is never thinner than two pixels, so a small fortune still shows.
          const tall = bar.h > 0 ? Math.max(2, Math.round(bar.h * height)) : 0;
          const top = bar.negative ? line : Math.min(Math.round(bar.y * height), line - tall);
          const grows = growMs !== undefined && i === last;
          return (
            <rect
              key={i}
              x={i * STEP}
              y={Math.max(0, top)}
              width={BAR}
              height={tall}
              className={`${bar.negative ? 'fill-wine-500' : i === last ? 'fill-gold-200' : 'fill-gold-500'} ${grows ? 'animate-grow' : ''}`}
              style={grows ? { transformBox: 'fill-box', transformOrigin: bar.negative ? 'top' : 'bottom', animationDelay: `${growMs}ms` } : undefined}
            />
          );
        })}
        <rect x={0} y={line} width={width} height={1} className="fill-ink-300" />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-ink-300">
        <span>{START_AGE}</span>
        <span>{START_AGE + Math.max(0, last) * content.yearsPerRound}</span>
      </div>
    </div>
  );
}
