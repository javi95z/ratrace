'use client';

import { useRef, useState } from 'react';
import { useGame, useGuide, useRuns, useT } from '@/game/context';
import { nextTip } from '@/game/guide';
import { Button } from '@/ui/kit';

/**
 * The tip of the guided first life that is due on this screen, if any. It is a note in the flow
 * of the page, not a dialog: it blocks nothing, and the game can be played straight past it.
 * A tip stays until it is read, so one that was passed by is there the next time. Reading one
 * does not bring up the next in line: that waits for the next visit to the stage.
 */
export function Guide() {
  const t = useT('guide');
  const stage = useGame((s) => s.stage);
  const round = useGame((s) => s.view?.round ?? 0);
  // The player as the orders of this round will leave them: someone who has just put money to work needs no telling.
  const player = useGame((s) => s.preview?.player ?? s.view?.player ?? null);
  const guide = useGuide();
  const runs = useRuns();
  const note = useRef<HTMLElement>(null);
  // The visit to a stage in which a tip was last read.
  const [read, setRead] = useState<string | null>(null);
  const visit = `${round}:${stage}`;
  // Until the device has said whether a life was ever finished, say nothing: a veteran must not see a flash of tips.
  if (runs === null || player === null) return null;

  const hasInvested = player.deposit > 0 || Object.keys(player.positions).length > 0;
  const tip = nextTip({ stage, round, seen: guide.seen, off: guide.off, livesFinished: runs.length, hasInvested });
  if (tip === null || read === visit) return null;

  // The button pressed is about to go, and the focus with it: the stage takes it back, so the keyboard carries on from there.
  const leave = () => note.current?.closest<HTMLElement>('main')?.focus({ preventScroll: true });

  return (
    <aside ref={note} role="note" aria-label={t('title')} className="frame frame-gold mx-3 mb-3 animate-rise bg-night-700 p-3">
      <p className="pixel mb-1 text-[12px] uppercase tracking-wider text-gold-500">{t('title')}</p>
      <p className="text-[14px] leading-snug">{t(tip)}</p>
      <div className="mt-3 flex gap-2">
        <Button
          className="flex-1 text-[15px]"
          onClick={() => {
            leave();
            setRead(visit);
            guide.read(tip);
          }}
        >
          {t('gotIt')}
        </Button>
        <Button
          variant="quiet"
          className="text-[14px]"
          onClick={() => {
            leave();
            guide.turnOff();
          }}
        >
          {t('skip')}
        </Button>
      </div>
    </aside>
  );
}
