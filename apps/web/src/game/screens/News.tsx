'use client';

import { cityArt } from '@ratrace/content';
import { headlineHeld } from '@ratrace/engine';
import { useGame, useT, useWords } from '@/game/context';
import { ageAt, headlineText } from '@/game/present';
import { Panel, Well } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';

/** One gauge of the economy: an icon, what it is, and where it stands. */
function Gauge({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Well className="size-9">
        <Sprite id={icon} />
      </Well>
      <div className="min-w-0">
        <div className="pixel truncate text-[15px]">{value}</div>
        <div className="truncate text-[11px] text-ink-300">{label}</div>
      </div>
    </div>
  );
}

/** The headlines about the next two years, and the gauges of the economy. */
export function Headlines({ hint = true }: { hint?: boolean }) {
  const t = useT('news');
  const words = useWords();
  const { text, fmt } = words;
  const view = useGame((s) => s.view);
  if (!view) return null;
  const world = view.timeline[view.round];

  return (
    <div className="flex flex-col gap-3">
      <Panel title={t('title')}>
        <ul className="flex flex-col gap-2">
          {world.news.map((h, i) => (
            <li key={i} className="frame frame-cream bg-cream px-3 py-2 text-[15px] leading-snug text-ink-900">
              {headlineText(words, h)}
            </li>
          ))}
        </ul>
        {hint ? <p className="mt-2 text-[12px] text-ink-300">{t('hint')}</p> : null}
      </Panel>

      <Panel>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <Gauge icon="icon.rates" label={t('rates')} value={fmt.rate(world.policyRateBp)} />
          <Gauge icon="icon.inflation" label={t('inflation')} value={fmt.rate(world.inflationBp)} />
          <Gauge icon="icon.mood" label={t('economy')} value={text.regimes[world.regime]} />
          <Gauge icon="icon.crypto" label={t('crypto')} value={text.cryptoPhases[world.cryptoPhase]} />
        </div>
      </Panel>
    </div>
  );
}

/** How last round's headlines turned out. Nothing in the first round. */
export function LastHeadlines() {
  const t = useT('news');
  const words = useWords();
  const view = useGame((s) => s.view);
  if (!view || view.round === 0) return null;
  const world = view.timeline[view.round];
  const before = view.timeline[view.round - 1];
  if (before.news.length === 0) return null;

  return (
    <Panel title={t('lastRound')}>
      <ul className="flex flex-col gap-1.5 text-[14px]">
        {before.news.map((h, i) => {
          const held = headlineHeld(words.content, h, before, world);
          return (
            <li key={i} className="flex items-start gap-2">
              <span aria-hidden className={`pixel mt-0.5 flex size-5 shrink-0 items-center justify-center text-[13px] ${held ? 'bg-teal-800' : 'bg-wine-700'}`}>
                {held ? '✓' : '✗'}
              </span>
              <span className={held ? '' : 'text-ink-300'}>
                {headlineText(words, h)}
                <span className="sr-only"> — {held ? t('held') : t('missed')}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/** The news as a phone shows it: the headlines, the gauges, and how last round's turned out. */
export function NewsPanel() {
  return (
    <div className="flex flex-col gap-3">
      <Headlines />
      <LastHeadlines />
    </div>
  );
}

/** How a round opens on a wide screen, where the headlines already sit at the side. */
export function RoundOpener() {
  const t = useT('news');
  const common = useT('common');
  const { content, names } = useWords();
  const view = useGame((s) => s.view);
  if (!view) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="frame mx-auto flex max-w-full justify-center overflow-hidden bg-night-900 leading-[0]" style={{ width: 'calc(312px * var(--art))' }}>
        <Sprite id={cityArt(view.player.cityId)} scale="art" alt={names.cities[view.player.cityId]} fallback={{ w: 312, h: 66 }} className="max-w-none" />
      </div>
      <Panel className="text-center">
        <p className="pixel text-[13px] uppercase tracking-wider text-ink-300">{common('round', { n: view.round + 1, total: content.rounds })}</p>
        <p className="pixel mt-1 text-[32px] leading-none text-gold-500">{common('age', { age: ageAt(content, view.round) })}</p>
        <p className="mt-1 text-ink-200">{names.cities[view.player.cityId]}</p>
        <p className="mx-auto mt-3 max-w-sm text-[13px] text-ink-300">{t('opener')}</p>
      </Panel>
      <LastHeadlines />
    </div>
  );
}
