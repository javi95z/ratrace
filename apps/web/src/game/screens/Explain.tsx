'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { useT } from '@/game/context';

/**
 * An explanation kept out of the way until it is wanted: a "What is this?" link, and the text in
 * its place once tapped. The figures and the things to do stay in sight; the reading does not crowd them.
 */
export function Explain({ children, className = '' }: { children: ReactNode; className?: string }) {
  const t = useT('common');
  const [open, setOpen] = useState(false);
  if (open) return <div className={`text-[13px] leading-snug text-ink-200 ${className}`}>{children}</div>;
  return (
    <button type="button" aria-expanded={false} onClick={() => setOpen(true)} className={`min-h-11 self-start text-left text-[13px] text-sky-300 underline underline-offset-4 ${className}`}>
      {t('whatIsThis')}
    </button>
  );
}
