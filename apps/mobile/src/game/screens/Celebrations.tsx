import { rarityOf } from '@ratrace/content';
import { momentsOf } from '@ratrace/core/game/moments';
import { useReducer } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAskReview, useGame } from '../context';
import { acceptReward, rewardAccepted } from '../rewardsAccepted';
import { EscapeMoment, firstEscapeOf } from './EscapeMoment';
import { MilestoneBanner, useCelebration } from './Milestones';
import { RewardSheet, type GoodMoment, type Reward } from './Rewards';

/** The rarest badge first. */
const RARER = ['legendary', 'rare', 'uncommon', 'common'] as const;

/**
 * What the step on screen brought. The life's first way out of the rat race has the whole screen before anything else (EscapeMoment.tsx), and the
 * player is asked then to rate the game in its store (game/askReview.ts). The rest in one standard sheet over its result, a step at a time
 * (Rewards.tsx): the way out (won again) and the first million first
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
  // The life's first way out, which has the screen to itself: its key, or nothing.
  const firstOut = useGame((s) => firstEscapeOf(s)?.key ?? '');
  const plan = useCelebration();
  const askReview = useAskReview();
  const [, accepted] = useReducer((n: number) => n + 1, 0);
  const all: GoodMoment[] = told === '' ? [] : told.split(' ').map((each) => {
    const [key, kind, round] = each.split('|');
    return kind === 'escape' ? { key, kind, round: Number(round) } : { key, kind: 'million' };
  });
  const escapeKey = `${gameId ?? ''}:escape:${firstOut}`;
  const moments = all.filter((each) => each.key !== firstOut);
  if (earned.length === 0 && unlocked.length === 0 && reached.length === 0 && all.length === 0) return null;
  // The milestone each moment is, where the step reached it: its first time ever or its record is the moment's to say.
  const MOMENT_MILESTONE = { escape: 'escaped', million: 'worth1m' } as const;
  const leadOf = (moment: GoodMoment) => reached.find((each) => each.id === MOMENT_MILESTONE[moment.kind]) ?? null;
  const covered = new Set(all.map((moment) => MOMENT_MILESTONE[moment.kind]));
  const milestones = plan.where === 'sheet' || plan.where === 'moment' ? [plan.lead, ...plan.others].filter((each) => !covered.has(each.id as 'escaped' | 'worth1m')) : [];
  const badges = [...earned].sort((a, b) => RARER.indexOf(rarityOf(a)) - RARER.indexOf(rarityOf(b)));
  const rewards: Reward[] = [
    ...moments.map((moment) => ({ kind: 'moment' as const, id: moment.key, moment, lead: leadOf(moment) })),
    ...milestones.map((each) => ({ kind: 'milestone' as const, id: each.id, reached: each })),
    ...badges.map((id) => ({ kind: 'badge' as const, id })),
    ...(over ? [] : unlocked.map((id) => ({ kind: 'life' as const, id }))),
  ];

  // The way out on the whole screen until it is taken in; the sheet of the rest waits for its turn behind it.
  const out = firstOut === '' ? null : all.find((each) => each.key === firstOut);
  const escaping = out !== undefined && out !== null && !rewardAccepted(escapeKey);

  return (
    <>
      {plan.where === 'banner' ? <MilestoneBanner plan={{ ...plan, badges: [] }} lifeId={lifeId} /> : null}
      {out ? (
        <EscapeMoment
          open={escaping}
          round={out.kind === 'escape' ? out.round : 0}
          lead={leadOf(out)}
          onClose={() => {
            acceptReward(escapeKey);
            accepted();
          }}
          onGone={askReview}
        />
      ) : null}
      {rewards.length > 0 ? <RewardSheet rewards={rewards} gameId={gameId} taken={seen} waiting={escaping} /> : null}
    </>
  );
}
