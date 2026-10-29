import { rarityOf } from '@ratrace/content';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Sheet } from '../../ui/overlay';
import { useGame, useT } from '../context';
import { MilestoneBanner, MilestoneBig, useCelebration } from './Milestones';
import { RewardSheet, type Reward } from './Rewards';

/** The rarest badge first. */
const RARER = ['legendary', 'rare', 'uncommon', 'common'] as const;

/**
 * What the step on screen earned for the first time ever: badges, and lives unlocked, each a reward in the standard sheet over the step's result
 * (Rewards.tsx); and the milestones of the life it reached (Milestones.tsx). A milestone that has the whole screen, or the moment that already has
 * it, carries the step's badges inside it, so that a step is never two celebrations of the same badge; a milestone's banner stops nothing and
 * carries none, its badges given the reward sheet. The lives a life's last step unlocked wait for its end (End.tsx), where one can begin at once.
 * It says what the session and the round store reported; whether a badge was earned, or a milestone reached, is never judged here.
 * It reads the round only for those lists, and is drawn again only when what is in them changes. `seen` is what a scene shows as accepted already.
 */
export function Celebrations({ seen = [] }: { seen?: readonly string[] }) {
  const common = useT('common');
  const milestone = useT('milestone');
  const earned = useGame(useShallow((s) => s.earned));
  const unlocked = useGame(useShallow((s) => s.unlocked));
  const reached = useGame(useShallow((s) => s.reached));
  const lifeId = useGame((s) => s.lifeId) ?? '';
  const gameId = useGame((s) => s.gameId) ?? null;
  const over = useGame((s) => s.view?.finished === true);
  const plan = useCelebration();
  // The step whose milestone had the whole screen and was moved on from.
  const [done, setDone] = useState<unknown>(null);
  const big = plan.where === 'sheet' ? plan : null;
  const [bigHeld, setBigHeld] = useState(big);
  if (big !== null && big.lead !== bigHeld?.lead) setBigHeld(big);
  if (earned.length === 0 && unlocked.length === 0 && reached.length === 0) return null;
  const bigOpen = big !== null && done !== reached;
  // The badges a milestone's whole screen (or the moment's) does not carry, then the lives, each in turn.
  const badges = plan.where === 'badges' || plan.where === 'banner' ? [...earned].sort((a, b) => RARER.indexOf(rarityOf(a)) - RARER.indexOf(rarityOf(b))) : [];
  const rewards: Reward[] = [...badges.map((id) => ({ kind: 'badge' as const, id })), ...(over ? [] : unlocked.map((id) => ({ kind: 'life' as const, id })))];

  return (
    <>
      {bigHeld !== null ? (
        <Sheet open={bigOpen} onClose={() => setDone(reached)} title={milestone(`names.${bigHeld.lead.id}`)} closeLabel={common('close')} tone="gold">
          <MilestoneBig plan={bigHeld} lifeId={lifeId} onDone={() => setDone(reached)} />
        </Sheet>
      ) : null}
      {/* Moved on from the whole screen, the milestone stays with the step's result as its banner. */}
      {plan.where === 'banner' ? <MilestoneBanner plan={{ ...plan, badges: [] }} lifeId={lifeId} /> : big !== null && !bigOpen ? <MilestoneBanner plan={{ ...big, badges: [] }} lifeId={lifeId} /> : null}
      {rewards.length > 0 ? <RewardSheet rewards={rewards} gameId={gameId} taken={seen} waiting={bigOpen} /> : null}
    </>
  );
}
