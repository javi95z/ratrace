'use client';

// The two charts of the game, as the web draws them, for the phone app's parity check (apps/mobile/src/ui/charts.tsx draws the
// same). Each is the svg of the screen it comes from, copied here because the screen's own chart is not exported and wants the
// whole game around it: PriceChart (game/screens/Finance.tsx) and WorthGraph (game/screens/WorthGraph.tsx).
import { worthBars } from '@ratrace/core/game/present';

/** The svg of Finance.tsx's PriceChart: a price round by round over a dashed line where it began, green above it and red below. */
export function PriceLine({ values, label }: { values: number[]; label: string }) {
  const w = 280;
  const h = 90;
  const pad = 6;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 1);
  const span = max - min || 1;
  const x = (i: number) => (values.length > 1 ? pad + (i * (w - pad * 2)) / (values.length - 1) : w / 2);
  const y = (value: number) => pad + (1 - (value - min) / span) * (h - pad * 2);
  const last = values[values.length - 1] ?? 1;
  const up = last >= 1;
  const tone = up ? 'var(--color-teal-300)' : 'var(--color-wine-300)';
  const line = values.map((value, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(value).toFixed(1)}`).join(' ');
  const base = y(1);
  const area = `${line} L${x(values.length - 1).toFixed(1)} ${base.toFixed(1)} L${x(0).toFixed(1)} ${base.toFixed(1)} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="block w-full">
      <path d={area} fill={tone} opacity="0.15" />
      <line x1={pad} x2={w - pad} y1={base} y2={base} stroke="var(--color-ink-500)" strokeWidth="1" strokeDasharray="3 3" />
      <path d={line} fill="none" stroke={tone} strokeWidth="2" strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(last)} r="3.5" fill={tone} />
    </svg>
  );
}

const BAR = 10;
const STEP = 14;

/** The svg of WorthGraph.tsx: net worth after every round, one bar each. */
export function WorthBars({ history, label, height = 96 }: { history: number[]; label: string; height?: number }) {
  const { zero, bars } = worthBars(history);
  const width = Math.max(BAR, bars.length * STEP - (STEP - BAR));
  const line = Math.min(height - 1, Math.round(zero * height));
  const last = history.length - 1;
  return (
    <div className="mx-auto" style={{ width }}>
      <svg role="img" aria-label={label} width={width} height={height} viewBox={`0 0 ${width} ${height}`} shapeRendering="crispEdges" className="block">
        {bars.map((bar, i) => {
          const tall = bar.h > 0 ? Math.max(2, Math.round(bar.h * height)) : 0;
          const top = bar.negative ? line : Math.min(Math.round(bar.y * height), line - tall);
          return <rect key={i} x={i * STEP} y={Math.max(0, top)} width={BAR} height={tall} className={bar.negative ? 'fill-wine-500' : i === last ? 'fill-gold-200' : 'fill-gold-500'} />;
        })}
        <rect x={0} y={line} width={width} height={1} className="fill-ink-300" />
      </svg>
    </div>
  );
}
