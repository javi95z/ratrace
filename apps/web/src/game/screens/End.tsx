'use client';

import { portraitArt } from '@ratrace/content';
import { netWorth, realNetWorth, scoreBreakdown } from '@ratrace/engine';
import { useGame, useT, useWords } from '@/game/context';
import { ageAt, START_AGE, worthBars } from '@/game/present';
import { Link } from '@/i18n/navigation';
import { Panel, Row, Well } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';

/** One bar of the graph, in screen pixels: ten of bar and four of gap. */
const BAR = 10;
const STEP = 14;
const HEIGHT = 96;

/** Net worth after every round, one pixel bar each, in the dollars of age 22 so the rounds can be compared. */
function WorthGraph({ history, label }: { history: number[]; label: string }) {
  const { fmt } = useWords();
  const { zero, bars } = worthBars(history);
  const width = bars.length * STEP - (STEP - BAR);
  const line = Math.min(HEIGHT - 1, Math.round(zero * HEIGHT));
  const last = history.length - 1;

  return (
    <div className="mx-auto" style={{ width }}>
      <div className="mb-1 flex justify-between text-[11px] text-ink-300">
        <span>{fmt.compact(Math.max(0, ...history))}</span>
      </div>
      <svg role="img" aria-label={label} width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} shapeRendering="crispEdges" className="block">
        {bars.map((bar, i) => {
          // A bar that stands for something is never thinner than two pixels, so a small fortune still shows.
          const tall = bar.h > 0 ? Math.max(2, Math.round(bar.h * HEIGHT)) : 0;
          const top = bar.negative ? line : Math.min(Math.round(bar.y * HEIGHT), line - tall);
          return <rect key={i} x={i * STEP} y={Math.max(0, top)} width={BAR} height={tall} className={bar.negative ? 'fill-wine-500' : i === last ? 'fill-gold-200' : 'fill-gold-500'} />;
        })}
        <rect x={0} y={line} width={width} height={1} className="fill-ink-300" />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-ink-300">
        <span>{START_AGE}</span>
        <span>{START_AGE + last * 2}</span>
      </div>
    </div>
  );
}

function Part({ label, value }: { label: string; value: string }) {
  return (
    <div className="frame bg-night-900 px-1 py-2">
      <div className="pixel text-[20px]">{value}</div>
      <div className="text-[11px] leading-tight text-ink-300">{label}</div>
    </div>
  );
}

/** How the life ended: the score and the three parts it is made of, the graph of a lifetime, and the way to another. */
export function End() {
  const t = useT('end');
  const { content, text, names, fmt } = useWords();
  const view = useGame((s) => s.view);
  const history = useGame((s) => s.history);
  const bankruptcies = useGame((s) => s.bankruptcies);
  const lifeId = useGame((s) => s.lifeId) ?? '';
  if (!view) return null;

  const p = view.player;
  // The engine's own breakdown: nothing about the score is worked out here.
  const score = scoreBreakdown(content, view);
  const escaped = score.multiplierPct > 100;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-3 pb-8 pt-6">
      <header className="flex items-center gap-3">
        <span className="frame shrink-0 leading-[0]">
          <Well className="size-[68px]">
            <Sprite id={portraitArt(lifeId, 58)} fallback={{ w: 64, h: 64 }} />
          </Well>
        </span>
        <div className="min-w-0">
          <h1 className="pixel text-[30px] leading-none text-gold-500">{t('title')}</h1>
          <p className="mt-1 text-[13px] text-ink-300">
            <span>{t('age', { age: ageAt(content, view.round) })}</span>
            {' · '}
            <span>
              {text.lives[lifeId]?.name ?? lifeId} · {names.cities[p.cityId]}
            </span>
          </p>
        </div>
      </header>

      <section role="group" aria-label={t('score')} className="frame frame-gold animate-rise bg-night-700 p-4 text-center">
        <p className="pixel text-[13px] uppercase tracking-wider text-ink-300">{t('score')}</p>
        <p className="pixel mt-1 text-[60px] leading-none text-gold-500">{fmt.number(score.total)}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Part label={t('wealth')} value={fmt.number(score.wealth)} />
          <Part label={t('status')} value={fmt.number(score.status)} />
          <Part label={escaped ? t('bonus', { multiplier: fmt.factor(score.multiplierPct) }) : t('noBonus')} value={`×${fmt.factor(score.multiplierPct)}`} />
        </div>
        <p className="mt-3 text-[12px] text-ink-300">{t('statusHint')}</p>
      </section>

      <Panel>
        <p className={`pixel text-[17px] ${escaped ? 'text-teal-300' : ''}`}>
          {p.escapedAtRound === null ? t('never') : t('escapedAt', { age: ageAt(content, p.escapedAtRound) })}
        </p>
        <p className="mt-1 text-[13px] text-ink-300">{t('bankruptcies', { count: bankruptcies })}</p>
      </Panel>

      <Panel title={t('netWorth')}>
        <Row left={t('netWorth')} right={<span className="text-[19px] text-gold-500">{fmt.money(netWorth(p))}</span>} />
        <Row left={t('realNetWorth')} right={fmt.money(realNetWorth(view))} />
        <div className="mt-3">
          <WorthGraph history={history} label={t('graph')} />
        </div>
        <p className="mt-2 text-center text-[12px] text-ink-300">{t('graph')}</p>
      </Panel>

      <div className="mt-auto flex flex-col gap-3 pt-2">
        <Link href="/new" className="pixel frame-raised frame-gold flex min-h-12 items-center justify-center bg-gold-500 px-4 py-2 text-center text-[19px] text-ink-900">
          {t('again')}
        </Link>
        <Link href="/" className="pixel frame-raised flex min-h-11 items-center justify-center bg-night-600 px-4 py-2 text-center text-[17px] text-cream">
          {t('home')}
        </Link>
      </div>
    </main>
  );
}
