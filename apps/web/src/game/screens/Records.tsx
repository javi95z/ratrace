'use client';

import { LifeFace } from './LifeFace';

import { useState } from 'react';
import { useRuns, useT, useWords } from '@/game/context';
import { ageAt } from '@ratrace/core/game/present';
import { recordsOf } from '@ratrace/core/game/records';
import { Link } from '@/i18n/navigation';
import type { FinishedRun } from '@ratrace/core/session/types';
import { Tag } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { RoomHistory } from './RoomHistory';
import { RunDetail } from './RunDetail';

/** Personal bests, and every life lived to the end with its graph. */
export function Records() {
  const t = useT('records');
  const common = useT('common');
  const { content, text, fmt } = useWords();
  const runs = useRuns();
  const lifeName = (run: FinishedRun) => text.lives[run.lifeId]?.name ?? run.lifeId;
  const records = recordsOf(runs ?? []);
  // Lives lived in a game with friends are told with their game, among the multiplayer ones.
  const alone = (runs ?? []).filter((run) => !run.room);
  const together = (runs ?? []).filter((run) => run.room);
  const [open, setOpen] = useState<FinishedRun | null>(null);

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
      {/* On a device with no life of its own yet, the account's multiplayer games are still there. */}
      {runs !== null && runs.length === 0 ? <RoomHistory runs={[]} /> : null}

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

          <RoomHistory runs={together} />

          {alone.length > 0 ? (
          <section aria-label={t('history')}>
            <h2 className="pixel mb-2 text-[15px] uppercase tracking-[0.1em] text-gold-500">{t('history')}</h2>
            <ul className="flex flex-col gap-1.5">
              {alone.map((run) => (
                <li key={run.runId}>
                  {/* A line each, the face as the life is chosen: the rest of it a tap away. */}
                  <button type="button" aria-haspopup="dialog" onClick={() => setOpen(run)} className="bevel flex min-h-12 w-full items-center gap-3 bg-night-700 px-2 py-1.5 text-left">
                    <LifeFace lifeId={run.lifeId} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="pixel flex items-center gap-1.5 text-[15px]">
                        <span className="truncate">{lifeName(run)}</span>
                        {run.room ? <Tag>{t('multiplayer')}</Tag> : run.ranked ? <Tag tone="good">{t('ranked')}</Tag> : null}
                      </span>
                      <span className="block text-[12px] text-ink-300">{fmt.day(run.finishedAt)}</span>
                    </span>
                    <span className="pixel shrink-0 text-[16px] text-gold-500">{fmt.number(run.score)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          ) : null}
          <Sheet open={open !== null} onClose={() => setOpen(null)} title={open ? lifeName(open) : ''} closeLabel={common('close')}>
            {open ? <RunDetail run={open} /> : null}
          </Sheet>
        </>
      ) : null}
    </main>
  );
}
