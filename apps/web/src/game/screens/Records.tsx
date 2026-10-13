'use client';

import { portraitArt } from '@ratrace/content';
import { useRuns, useT, useWords } from '@/game/context';
import { ageAt } from '@/game/present';
import { recordsOf } from '@/game/records';
import { Link } from '@/i18n/navigation';
import type { FinishedRun } from '@/session/types';
import { Tag, Well } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import { WorthGraph } from './WorthGraph';

/** Personal bests, and every life lived to the end with its graph. */
export function Records() {
  const t = useT('records');
  const common = useT('common');
  const { content, text, names, fmt } = useWords();
  const runs = useRuns();
  const lifeName = (run: FinishedRun) => text.lives[run.lifeId]?.name ?? run.lifeId;
  const records = recordsOf(runs ?? []);

  const best = (label: string, run: FinishedRun | null, figure: (run: FinishedRun) => string) => (
    <li className="bevel flex items-center justify-between gap-3 bg-night-700 px-3 py-2">
      <span className="min-w-0">
        <span className="block text-[13px] text-ink-200">{label}</span>
        <span className="block truncate text-[12px] text-ink-300">{run ? lifeName(run) : t('none')}</span>
      </span>
      <span className="pixel shrink-0 text-[18px] text-gold-500">{run ? figure(run) : '—'}</span>
    </li>
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-4 px-3 pb-10 pt-4">
      <div className="flex items-center gap-2">
        <Link href="/" aria-label={common('back')} className="pixel frame-raised flex size-11 items-center justify-center bg-night-700 text-[18px] text-ink-200">
          ←
        </Link>
        <h1 className="pixel text-[24px] text-gold-500">{t('title')}</h1>
      </div>

      {runs === null ? <p className="pixel animate-blink text-center text-ink-300">{common('loading')}</p> : null}
      {runs !== null && runs.length === 0 ? <p className="frame bg-night-700 p-3 text-[14px] text-ink-200">{t('empty')}</p> : null}

      {runs !== null && runs.length > 0 ? (
        <>
          <section aria-label={t('bests')}>
            <h2 className="pixel mb-2 text-[15px] uppercase tracking-[0.1em] text-gold-500">{t('bests')}</h2>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {best(t('bestScore'), records.bestScore, (run) => fmt.number(run.score))}
              {best(t('richest'), records.richest, (run) => fmt.money(run.netWorth))}
              {best(t('youngestEscape'), records.youngestEscape, (run) => t('age', { age: ageAt(content, run.escapedAtRound ?? 0) }))}
              {best(t('mostStatus'), records.mostStatus, (run) => fmt.number(run.status))}
            </ul>
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-ink-200">
              <span>{t('lives', { count: records.lives })}</span>
              <span>{t('escaped', { count: records.escaped })}</span>
              <span>{t('bankruptcies', { count: records.bankruptcies })}</span>
            </p>
          </section>

          <section aria-label={t('history')}>
            <h2 className="pixel mb-2 text-[15px] uppercase tracking-[0.1em] text-gold-500">{t('history')}</h2>
            <ul className="flex flex-col gap-3">
              {runs.map((run) => (
                <li key={run.runId} className="bevel bg-night-700 p-3">
                  <div className="flex items-center gap-3">
                    <span className="frame shrink-0 leading-[0]">
                      <Well className="size-[68px]">
                        <Sprite id={portraitArt(run.lifeId, 58)} fallback={{ w: 64, h: 64 }} />
                      </Well>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="pixel flex flex-wrap items-center gap-x-2 text-[17px]">
                        {lifeName(run)}
                        {run.ranked ? <Tag tone="good">{t('ranked')}</Tag> : null}
                      </p>
                      <p className="text-[12px] text-ink-300">
                        {fmt.day(run.finishedAt)} · {run.cities.map((city) => names.cities[city] ?? city).join(' · ')}
                      </p>
                      <p className={`mt-0.5 text-[13px] ${run.escapedAtRound === null ? 'text-ink-200' : 'text-teal-300'}`}>
                        {run.escapedAtRound === null ? t('never') : t('escapedAt', { age: ageAt(content, run.escapedAtRound) })} · {t('badges', { count: run.badges.length })}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="pixel text-[17px] text-gold-500">{t('score', { score: fmt.number(run.score) })}</p>
                      <p className="pixel text-[14px]">{fmt.compact(run.netWorth)}</p>
                      <p className="text-[11px] text-ink-300">{t('realWorth')}</p>
                    </div>
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <WorthGraph history={run.history} label={t('graph')} height={48} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </main>
  );
}
