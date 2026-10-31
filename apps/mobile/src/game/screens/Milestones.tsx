import { celebrationOf } from '@ratrace/core/game/lifeMilestones';
import type { Celebration } from '@ratrace/core/game/lifeMilestones';
import { momentsOf } from '@ratrace/core/game/moments';
import { useShallow } from 'zustand/react/shallow';
import { useGame } from '../context';

/*
 * The milestones of a life, celebrated in every life (core's lifeMilestones.ts decides which a step reached, once a life): each a step of the round's
 * sheet (Rewards.tsx), as a badge is. The step's badges follow the milestone in the same sheet, or come inside the moment that already has the screen.
 */

/** How the step on screen is celebrated: in the moment that already has the screen (the first million, the way out), a step of the sheet, or, with no milestone, the badges as they always were. */
export function useCelebration(): Celebration {
  const reached = useGame(useShallow((s) => s.reached));
  const earned = useGame(useShallow((s) => s.earned));
  // Only which moment has the screen, and only with a milestone to carry: the screen is drawn again for nothing else of the round.
  const moment = useGame((s) => (s.reached.length === 0 ? null : (momentsOf(s).find((each) => each.kind === 'escape' || each.kind === 'million')?.kind ?? null)));
  if (reached.length === 0) return { where: 'badges' };
  return celebrationOf({ reached, earned, moment: moment as 'escape' | 'million' | null });
}
