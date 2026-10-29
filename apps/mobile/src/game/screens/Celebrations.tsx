import { rarityOf } from '@ratrace/content';
import { momentsOf } from '@ratrace/core/game/moments';
import { useShallow } from 'zustand/react/shallow';
import { useGame } from '../context';
import { MilestoneBanner, useCelebration } from './Milestones';
import { RewardSheet, type GoodMoment, type Reward } from './Rewards';

/** The rarest badge first. */
const RARER = ['legendary', 'rare', 'uncommon', 'common'] as const;

/**
 * What the step on screen brought, in one standard sheet over its result, a step at a time (Rewards.tsx): the way out and the first million first
 * (the moments the round stops for, momentsOf), then the milestones of the life that have the whole screen, then the badges earned for the first
 * time ever, the rarest first, then the lives unlocked. A milestone's banner stops nothing and stays with the result (Milestones.tsx). The lives a
 * life's last step unlocked wait for its end (End.tsx), where one can begin at once. It says what the session and the round store reported;
 * whether a badge was earned, or a milestone reached, is never judged here. `seen` is what a scene shows as accepted already.
 */
export function Celebrations({ seen = [] }: { seen?: readonly string[] }) {
  const earned = useGame(useShallow((s) => s.earned));
  const unlocked = useGame(useShallow((s) => s.unlocked));
  const reached = useGame(useShallow((s) => s.reached));
  const lifeId = useGame((s) => s.lifeId) ?? '';
  const gameId = useGame((s) => s.gameId) ?? null;
  const over = useGame((s) => s.view?.finished === true);
  // The way out and the first million the step brought, as one string so that the round is drawn again only when they change.
  const told = useGame((s) =>
    momentsOf(s)
      .filter((each) => each.kind === 'escape' || each.kind === 'million')
      .map((each) => `${each.key}|${each.kind}|${each.kind === 'escape' ? each.round : ''}`)
      .join(' '),
  );
  const plan = useCelebration();
  const moments: GoodMoment[] = told === '' ? [] : told.split(' ').map((each) => {
    const [key, kind, round] = each.split('|');
    return kind === 'escape' ? { key, kind, round: Number(round) } : { key, kind: 'million' };
  });
  if (earned.length === 0 && unlocked.length === 0 && reached.length === 0 && moments.length === 0) return null;
  // The milestone each moment is, where the step reached it: its first time ever or its record is the moment's to say.
  const MOMENT_MILESTONE = { escape: 'escaped', million: 'worth1m' } as const;
  const leadOf = (moment: GoodMoment) => reached.find((each) => each.id === MOMENT_MILESTONE[moment.kind]) ?? null;
  const covered = new Set(moments.map((moment) => MOMENT_MILESTONE[moment.kind]));
  const milestones = plan.where === 'sheet' || plan.where === 'moment' ? [plan.lead, ...plan.others].filter((each) => !covered.has(each.id as 'escaped' | 'worth1m')) : [];
  const badges = [...earned].sort((a, b) => RARER.indexOf(rarityOf(a)) - RARER.indexOf(rarityOf(b)));
  const rewards: Reward[] = [
    ...moments.map((moment) => ({ kind: 'moment' as const, id: moment.key, moment, lead: leadOf(moment) })),
    ...milestones.map((each) => ({ kind: 'milestone' as const, id: each.id, reached: each })),
    ...badges.map((id) => ({ kind: 'badge' as const, id })),
    ...(over ? [] : unlocked.map((id) => ({ kind: 'life' as const, id }))),
  ];

  return (
    <>
      {plan.where === 'banner' ? <MilestoneBanner plan={{ ...plan, badges: [] }} lifeId={lifeId} /> : null}
      {rewards.length > 0 ? <RewardSheet rewards={rewards} gameId={gameId} taken={seen} /> : null}
    </>
  );
}
