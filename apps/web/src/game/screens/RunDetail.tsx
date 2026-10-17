'use client';

import { useT, useWords } from '@/game/context';
import { ageAt } from '@/game/present';
import type { FinishedRun } from '@/session/types';
import { Tag } from '@/ui/kit';
import { WorthGraph } from './WorthGraph';

/** The whole of a finished life: its kind, where it was lived, how it ended, its score, its net worth and its graph. */
export function RunDetail({ run, tags = true }: { run: FinishedRun; tags?: boolean }) {
  const t = useT('records');
  const { content, names, fmt } = useWords();
  return (
    <div className="flex flex-col gap-2">
      {tags && (run.ranked || run.room || run.challenge) ? (
        <div className="flex flex-wrap gap-1.5">
          {run.ranked ? <Tag tone="good">{t('ranked')}</Tag> : null}
          {run.room ? <Tag>{t('multiplayer')}</Tag> : null}
          {run.challenge ? <Tag>{t(run.ranked ? 'challenge' : 'practice', { week: run.challenge })}</Tag> : null}
        </div>
      ) : null}
      <p className="text-[13px] text-ink-300">
        {fmt.day(run.finishedAt)} · {run.cities.map((city) => names.cities[city] ?? city).join(' · ')}
      </p>
      <p className={`text-[14px] ${run.escapedAtRound === null ? 'text-ink-200' : 'text-teal-300'}`}>
        {run.escapedAtRound === null ? t('never') : t('escapedAt', { age: ageAt(content, run.escapedAtRound) })} · {t('badges', { count: run.badges.length })}
      </p>
      <div className="flex items-baseline justify-between gap-3 border-t-2 border-night-900 pt-2">
        <span className="pixel text-[18px] text-gold-500">{t('score', { score: fmt.number(run.score) })}</span>
        <span className="text-right">
          <span className="pixel block text-[16px]">{fmt.compact(run.netWorth)}</span>
          <span className="block text-[11px] text-ink-300">{t('realWorth')}</span>
        </span>
      </div>
      <div className="overflow-x-auto">
        <WorthGraph history={run.history} label={t('graph')} height={64} />
      </div>
    </div>
  );
}
