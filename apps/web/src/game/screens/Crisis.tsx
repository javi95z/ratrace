'use client';

import type { WorldState } from '@ratrace/engine';
import { useState } from 'react';
import { useT, useWords } from '@/game/context';
import { Sheet } from '@/ui/overlay';

type Crisis = NonNullable<WorldState['crisis']>;

/** One lamp for each round of a crisis: lit for those gone by, pulsing for the one being lived. */
function Years({ crisis }: { crisis: Crisis }) {
  return (
    <span aria-hidden className="flex shrink-0 gap-1">
      {Array.from({ length: crisis.of }, (_, i) => (
        <span key={i} className={`size-2.5 ${i + 1 < crisis.year ? 'bg-wine-300' : i + 1 === crisis.year ? 'animate-alarm bg-cream' : 'bg-wine-900'}`} />
      ))}
    </span>
  );
}

/** What a crisis is and what each of its rounds does, the one being lived marked. */
export function CrisisDetails({ crisis }: { crisis: Crisis }) {
  const t = useT('crisis');
  const { text } = useWords();
  const written = text.crises[crisis.id];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] leading-snug">{written.intro}</p>
      <ol className="flex flex-col gap-1.5">
        {written.years.map((line, i) => {
          const now = i + 1 === crisis.year;
          const past = i + 1 < crisis.year;
          return (
            <li key={i} aria-current={now ? 'step' : undefined} className={`frame flex items-start gap-2.5 px-2.5 py-2 ${now ? 'bg-wine-700' : 'bg-night-700'} ${past ? 'text-ink-300' : ''}`}>
              <span className="pixel shrink-0 text-[13px] uppercase tracking-wider">{t('year', { n: i + 1 })}</span>
              <span className="text-[14px] leading-snug">{line}</span>
            </li>
          );
        })}
      </ol>
      <p className="text-[12px] text-ink-300">{t('advice')}</p>
    </div>
  );
}

/**
 * The bar of a crisis: its name, how far through it the world is, and what this round of it
 * brings. A tap opens the whole of it. Nothing is drawn in ordinary times.
 */
export function CrisisBar({ crisis, compact = false }: { crisis: Crisis | null; compact?: boolean }) {
  const t = useT('crisis');
  const common = useT('common');
  const { text } = useWords();
  const [open, setOpen] = useState(false);
  if (!crisis) return null;
  const written = text.crises[crisis.id];

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={t('open', { crisis: written.name, year: crisis.year, of: crisis.of })}
        onClick={() => setOpen(true)}
        className={`frame-raised frame-wine flex w-full items-center gap-3 bg-wine-700 text-left text-cream ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2.5'}`}
      >
        <span className="min-w-0 flex-1">
          <span className="pixel block text-[12px] uppercase tracking-[0.12em] text-wine-300">{t('label', { year: crisis.year, of: crisis.of })}</span>
          <span className={`pixel block truncate ${compact ? 'text-[16px]' : 'text-[20px]'}`}>{written.name}</span>
          {compact ? null : <span className="mt-0.5 block text-[13px] leading-snug">{written.years[crisis.year - 1]}</span>}
        </span>
        <Years crisis={crisis} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={written.name} closeLabel={common('close')} tone="wine">
        <CrisisDetails crisis={crisis} />
      </Sheet>
    </>
  );
}
