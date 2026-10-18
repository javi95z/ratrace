'use client';

import { careerArt } from '@ratrace/content';
import type { WorkQuote } from '@ratrace/engine';
import { useGame, useKnows, useT, useWords } from '@/game/context';
import { Toggle } from '@/ui/kit';

/**
 * The moves the player's career makes at the rung they are on, each a point of focus: a switch,
 * with what it is, the chance it comes off and how many rounds it takes. One a round at most, as
 * any use of focus. Nothing where the rung makes none.
 */
export function CareerMoves({ work, left }: { work: WorkQuote; left: number }) {
  const t = useT('work');
  const { text } = useWords();
  const view = useGame((s) => s.view);
  const orders = useGame((s) => s.orders);
  const setOrder = useGame((s) => s.setOrder);
  const career = view?.player.life.career ?? null;
  // A life begun before careers had moves of their own is played under rules that know none.
  const known = useKnows()('focus:careerMove');
  if (!known || career === null || work.moves.length === 0) return null;
  const isMove = (order: { type: string; action?: string }) => order.type === 'focus' && order.action === 'careerMove';
  const chosen = (orders.find(isMove) as { move?: string } | undefined)?.move;
  return (
    <>
      {work.moves.map((move) => {
        const told = text.careers[career.id]?.moves?.[move.id];
        if (!told) return null;
        const on = chosen === move.id;
        const reason = move.lock === 'move-resting' ? t('moveResting') : null;
        const progress = move.rounds > 1 ? t('moveRounds', { done: move.progress, rounds: move.rounds }) : null;
        return (
          <Toggle
            key={move.id}
            on={on}
            onChange={(next) => setOrder(isMove, next ? { type: 'focus', action: 'careerMove', move: move.id } : null)}
            disabled={!on && (left < 1 || move.lock !== null)}
            label={told.name}
            hint={[told.about, reason ?? t('moveChance', { pct: move.chancePct }), progress].filter(Boolean).join(' · ')}
            icon={careerArt(career.id)}
          />
        );
      })}
    </>
  );
}
