import type { FocusAction, WorkQuote } from '@ratrace/engine';
import { useT, useWords } from '../context';

export interface FocusNote {
  /** What the switch says under its name: what it gives and what it costs, or why it is closed. */
  hint: string;
  locked: boolean;
  /** A skill at its top: nothing more to learn, so it goes to the end of the list. */
  mastered: boolean;
}

/**
 * What a use of focus says beside what it gives: the toll of overtime round after round, what study
 * may still add at this rung, and why it is closed when it is. The Lifestyle tab and the focus
 * sheet say the same.
 */
export function useFocusNote(): (work: WorkQuote, action: FocusAction, gives: string) => FocusNote {
  const t = useT('finance.lifestyle');
  const { text } = useWords();
  return (work, action, gives) => {
    const lock = work.focusLocks[action];
    if (lock === 'skill-maxed') return { hint: t('mastered'), locked: true, mastered: true };
    if (lock !== null) return { hint: text.reasons[lock], locked: true, mastered: false };
    const toll = work.overtimeToll;
    const extra =
      action === 'overtime'
        ? [toll.healthPoints > 0 ? t('tired', { n: toll.healthPoints }) : '', toll.burnoutChancePct > 0 ? t('burnoutRisk', { pct: toll.burnoutChancePct }) : '']
        : action === 'studyCareer'
          ? [t('rungStudyLeft', { left: work.rungStudy.left, max: work.rungStudy.max })]
          : [];
    const more = extra.filter(Boolean);
    // A sentence that goes on loses its full stop.
    return { hint: [more.length > 0 ? gives.replace(/\.$/, '') : gives, ...more].join(' · '), locked: false, mastered: false };
  };
}

/** Uses of focus split in two: what can still be learnt, each a switch; and what is mastered, which is only named. */
export function splitMastered<T extends { note: FocusNote }>(uses: T[]): { open: T[]; mastered: T[] } {
  return { open: uses.filter((use) => !use.note.mastered), mastered: uses.filter((use) => use.note.mastered) };
}
