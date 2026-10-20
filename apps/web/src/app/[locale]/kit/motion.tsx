'use client';

// The `motion-2` section of the kit: the rest of the web's motion, each effect held still at the middle of a step, and the
// pieces that go with it (sparks, the slider, the two charts) with fixed data. apps/mobile/src/ui/kitMotion.tsx shows the
// same, with the same numbers; the two are shot and compared like every other section. On the expo branch only.
import type { CSSProperties, ReactNode } from 'react';
import { Sparks } from '@/ui/Sparks';
import { Sprite } from '@/ui/Sprite';
import { PriceLine, WorthBars } from './charts';

/** How far into each effect it is held, in milliseconds: the middle of a step, away from the edge of one, so no engine reads it a step off. */
const HELD = { paper: 400, legend: 357, holo: 2050, glint: 665, medal: 427, fly: 343, fall: 350, reveal: 281, alarm: 450, tear: 445, page: 90, light: 150, spark: 350 } as const;

/** An animation held still: paused, started `ms` in the past (a negative delay), so the stylesheet's own keyframes are what is drawn. */
const hold = (name: keyof typeof HELD, more: Record<string, string> = {}) => ({ '--held': `-${HELD[name]}ms`, ...more }) as CSSProperties;

// `held` is the element itself; `held-in` is everything inside it (the sparks, whose delays are the burst's own and are put aside).
const HOLD_CSS = '.held, .held-in * { animation-play-state: paused !important; animation-delay: var(--held) !important; }';

const Cell = ({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) => (
  <div className={`relative flex size-18 items-center justify-center bg-night-900 ${className}`} style={style}>{children}</div>
);
const Row = ({ children }: { children: ReactNode }) => <div className="flex gap-2">{children}</div>;

/** A block with a corner of another colour, so that a turn or a flip can be told from a fade. */
const Flag = ({ w, h, body, corner, className = '', style }: { w: number; h: number; body: string; corner: string; className?: string; style?: CSSProperties }) => (
  <div className={`${body} ${className}`} style={{ width: w, height: h, ...style }}>
    <div className={`size-3 ${corner}`} />
  </div>
);

/** The history the net-worth bars are drawn from, in cents: money made, a time in debt, and a good end. */
const HISTORY = [100_000, 400_000, 900_000, 700_000, -200_000, -50_000, 600_000, 1_500_000, 2_200_000, 3_000_000];
/** What a price did, round by round, from 1 where it began. */
const PRICE = [1, 1.15, 1.08, 1.32, 1.21, 1.55, 1.42, 1.7];
const noop = () => {};

export function MotionTwo() {
  return (
    <>
      <style>{HOLD_CSS}</style>
      {/* A legendary card's picture: a rainbow slid half way, and a band of light half way across. */}
      <div className="relative self-start overflow-hidden border-2 border-cream leading-[0]">
        <Sprite id="card.airport" fallback={{ w: 288, h: 120 }} />
        <span
          aria-hidden
          className="held pointer-events-none absolute inset-0 animate-holo opacity-40 mix-blend-overlay"
          style={{ backgroundImage: 'linear-gradient(110deg, #d1495b, #f2c14e, #7fd1b9, #9ad1d4, #3b6ea5, #d1495b)', backgroundSize: '200% 100%', ...hold('holo') }}
        />
        <span aria-hidden className="held pointer-events-none absolute inset-y-0 left-0 w-1/5 animate-glint bg-white/40" style={hold('glint')} />
      </div>
      <Row>
        <Cell><Flag w={36} h={44} body="bg-cream" corner="bg-wine-500" className="held animate-paper" style={hold('paper')} /></Cell>
        <Cell><Flag w={36} h={44} body="bg-cream" corner="bg-gold-500" className="held animate-legend" style={hold('legend')} /></Cell>
        <Cell><Flag w={36} h={36} body="bg-gold-500" corner="bg-night-900" className="held animate-medal" style={hold('medal')} /></Cell>
        <Cell><span className="held absolute left-5 top-5 size-3 animate-fly bg-gold-500" style={hold('fly', { '--dx': '30px', '--dy': '20px' })} /></Cell>
      </Row>
      <Row>
        <Cell><span className="held absolute left-8 top-0 size-2 animate-fall bg-gold-500" style={hold('fall')} /></Cell>
        <Cell>
          {/* uncovered from the left: four stripes of 14, two of them shown */}
          <div className="held flex h-8 w-14 animate-reveal" style={hold('reveal')}>
            {['bg-teal-300', 'bg-gold-500', 'bg-wine-500', 'bg-sky-500'].map((c) => (
              <div key={c} className={`h-8 w-3.5 ${c}`} />
            ))}
          </div>
        </Cell>
        <Cell><div className="held size-5 animate-alarm bg-cream" style={hold('alarm')} /></Cell>
        <Cell><Flag w={32} h={40} body="bg-cream" corner="bg-ink-900" className="held origin-top-left animate-tear" style={hold('tear')} /></Cell>
      </Row>
      <Row>
        <Cell><Flag w={36} h={36} body="bg-sky-300" corner="bg-ink-900" className="held animate-page" style={hold('page')} /></Cell>
        <Cell><div className="held size-5 animate-light bg-gold-500" style={hold('light')} /></Cell>
        <Cell>
          <span className="held absolute left-1/2 top-1/2 -ml-[3px] -mt-[3px] size-[6px] animate-spark bg-cream" style={hold('spark', { '--sx': '24px', '--sy': '-16px' })} />
        </Cell>
        <Cell className="held-in" style={hold('spark')}>
          <Sparks colours={['bg-gold-500', 'bg-gold-200', 'bg-cream']} count={8} reach={30} size={4} />
        </Cell>
      </Row>
      <input type="range" className="range" aria-label="Amount" min={0} max={1000} step={10} value={400} onChange={noop} />
      <div className="bg-night-900 p-2">
        <PriceLine values={PRICE} label="Price" />
      </div>
      <WorthBars history={HISTORY} label="Net worth" />
    </>
  );
}
