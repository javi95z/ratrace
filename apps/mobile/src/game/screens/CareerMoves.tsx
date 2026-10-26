import { careerArt } from '@ratrace/content';
import type { Order, WorkQuote } from '@ratrace/engine';
import { memo, useCallback } from 'react';
import { Toggle } from '../../ui/kit';
import { useGame, useKnows, useT, useWords } from '../context';

const isMove = (order: { type: string; action?: string }) => order.type === 'focus' && order.action === 'careerMove';
/** The move ordered this round, by its id: a word, so another order draws nothing here. */
const chosenOf = (orders: readonly Order[]): string | null => ((orders.find(isMove) as { move?: string } | undefined)?.move ?? null);

/**
 * The moves the player's career makes at the rung they are on, each a point of focus: a switch,
 * with what it is, the chance it comes off and how many rounds it takes. One a round at most, as
 * any use of focus. Nothing where the rung makes none, and nothing of a move that cannot be made now.
 */
export function CareerMoves({ work, left }: { work: WorkQuote; left: number }) {
  const t = useT('work');
  const { text } = useWords();
  const career = useGame((s) => s.view?.player.life.career?.id ?? null);
  const chosen = useGame((s) => chosenOf(s.orders));
  const setOrder = useGame((s) => s.setOrder);
  // The same for every move and every drawing, so a move's switch is drawn again only when what it shows changes (`MoveSwitch` is memoised).
  const choose = useCallback((move: string, on: boolean) => setOrder(isMove, on ? { type: 'focus', action: 'careerMove', move } : null), [setOrder]);
  // A life begun before careers had moves of their own is played under rules that know none.
  const known = useKnows()('focus:careerMove');
  if (!known || career === null || work.moves.length === 0) return null;
  return (
    <>
      {work.moves.map((move) => {
        const told = text.careers[career]?.moves?.[move.id];
        if (!told) return null;
        const on = chosen === move.id;
        // A move that cannot be made now (tried too lately) is not shown at all.
        if (move.lock !== null && !on) return null;
        const reason = move.lock === 'move-resting' ? t('moveResting') : null;
        const progress = move.rounds > 1 ? t('moveRounds', { done: move.progress, rounds: move.rounds }) : null;
        return (
          <MoveSwitch
            key={move.id}
            move={move.id}
            on={on}
            disabled={!on && left < 1}
            label={told.name}
            hint={[told.about, reason ?? t('moveChance', { pct: move.chancePct }), progress].filter(Boolean).join(' · ')}
            icon={careerArt(career)}
            onChoose={choose}
          />
        );
      })}
    </>
  );
}

/** One move's switch, drawn again only when what it shows changes: an order of another kind leaves it as it is. */
const MoveSwitch = memo(function MoveSwitch({ move, on, disabled, label, hint, icon, onChoose }: { move: string; on: boolean; disabled: boolean; label: string; hint: string; icon: string; onChoose(move: string, on: boolean): void }) {
  return <Toggle on={on} onChange={(next) => onChoose(move, next)} disabled={disabled} label={label} hint={hint} icon={icon} />;
});
